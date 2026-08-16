import "server-only";

/**
 * Ventrio's runtime libraries, compiled into browser ES modules.
 *
 * WHAT THIS HAS TO ACHIEVE. A generated app imports `react`, `lucide-react` and
 * so on as bare specifiers. Inside an opaque-origin sandbox there is no network
 * and no bundler, so an import map has to make those names resolve to bytes
 * Ventrio compiled — never a CDN, which would be a network dependency and a
 * supply chain in one.
 *
 * WHY ONE GRAPH INSTEAD OF ONE BUNDLE PER LIBRARY. The obvious design — build
 * each library separately with the others marked external — fails twice, and
 * both failures are worth recording because both look like bugs in the
 * generated app:
 *
 *   1. `react-dom/client` requires `react-dom` internally. With `react-dom`
 *      external that became a cross-bundle CommonJS import whose interop lost
 *      the named exports, and the app died on "createRoot is not a function".
 *   2. Marking `react` external inside a CommonJS library leaves esbuild
 *      emitting `__require("react")` in ESM output, which throws
 *      "Dynamic require of react is not supported" at load.
 *
 * Both are the same root cause: CommonJS and ES modules interoperate badly
 * *across* bundle boundaries. So there are no boundaries. Everything is
 * compiled into a single graph in which React appears exactly once — which is
 * also the property that matters most, because two React copies make every
 * hook throw "invalid hook call" from inside whichever dependency lost.
 *
 * The core exposes each library as a namespace on one exported object. Tiny
 * facade modules, generated in the browser where the core's blob URL is known,
 * give each bare specifier the named exports an import map needs.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { build } from "esbuild";
import { isAllowedImport, RUNTIME_LIBRARIES, RUNTIME_OVERRIDES } from "./runtime";

const execFileAsync = promisify(execFile);

export interface RuntimeBundle {
  /** One ES module exporting `__libs`: specifier → module namespace. */
  core: string;
  /** Specifier → its named exports, for building facades in the browser. */
  names: Record<string, string[]>;
}

const ALL_ENTRIES = RUNTIME_LIBRARIES.map((library) => library.name);

/**
 * The names a library exports, discovered in a clean child process.
 *
 * Needed because esbuild's lexer cannot enumerate a CommonJS namespace whose
 * entry is a dynamic re-export — React's is literally
 * `module.exports = require("./cjs/react.production.js")`, and esbuild reports
 * zero exports for it. Node's ESM loader does recover the names.
 *
 * It has to be a child process because the answer depends on export
 * conditions, conditions are process-wide, and this code runs inside Next
 * where `react-server` is active — under which `react-dom/client` resolves to a
 * stub that throws on import. NODE_OPTIONS is stripped rather than inherited,
 * because that is how the condition reaches a child in the first place.
 */
async function exportedNames(specifier: string): Promise<string[]> {
  const script = `import(${JSON.stringify(specifier)})`
    + `.then((m) => { process.stdout.write(JSON.stringify(Object.keys(m))); })`
    + `.catch((e) => { process.stderr.write(String(e && e.message)); process.exit(1); });`;

  const env = { ...process.env };
  delete env.NODE_OPTIONS;

  const { stdout } = await execFileAsync(
    process.execPath,
    ["--conditions=browser", "--input-type=module", "-e", script],
    { cwd: process.cwd(), timeout: 20_000, maxBuffer: 8 * 1024 * 1024, env },
  );

  return (JSON.parse(stdout) as string[])
    .filter((key) => key !== "default" && key !== "__esModule")
    // Only real identifiers can appear in a destructuring or export list.
    .filter((key) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key))
    .sort();
}

/**
 * Compiles the requested libraries into one graph.
 *
 * No externals at all: every dependency any of them has is resolved and
 * included here, which is precisely what keeps CommonJS interop inside a single
 * bundle where esbuild handles it correctly.
 */
async function buildCore(specifiers: readonly string[]): Promise<string> {
  const imports = specifiers
    .map((spec, i) => `import * as __m${i} from ${JSON.stringify(spec)};`)
    .join("\n");

  /**
   * `RUNTIME_OVERRIDES` applied, as a plain object layered over the namespace.
   *
   * A module namespace object is frozen and its properties are non-writable, so
   * the substitution cannot be made in place — it has to be a copy. Spreading
   * preserves every other export untouched, and the replacement names are read
   * from the same namespace, so a rename in the package produces `undefined`
   * here rather than a wrong binding. `runtime-router.test.mts` asserts both
   * sides still exist, which is what turns that into a caught failure.
   *
   * The facades built in the browser destructure from this object, so a
   * generated app importing `BrowserRouter` receives `MemoryRouter` without
   * anything in the import map, the CSP or the facade generator changing.
   */
  const overridden = specifiers
    .map((spec, i) => {
      const overrides = RUNTIME_OVERRIDES[spec];
      if (!overrides) return null;
      const pairs = Object.entries(overrides)
        .map(([from, to]) => `  ${JSON.stringify(from)}: __m${i}[${JSON.stringify(to)}],`)
        .join("\n");
      return `const __o${i} = {\n  ...__m${i},\n${pairs}\n};`;
    })
    .filter((line): line is string => line !== null)
    .join("\n");

  const table = specifiers
    .map((spec, i) => `  ${JSON.stringify(spec)}: ${RUNTIME_OVERRIDES[spec] ? `__o${i}` : `__m${i}`},`)
    .join("\n");

  const result = await build({
    stdin: {
      contents: `${imports}\n${overridden}\nexport const __libs = {\n${table}\n};\n`,
      resolveDir: process.cwd(),
      loader: "js",
    },
    bundle: true,
    write: false,
    format: "esm",
    target: "es2022",
    platform: "browser",
    minify: true,
    sourcemap: false,
    logLevel: "silent",
    // Libraries branch on this; without it React ships its development build
    // and warns about everything a generated app legitimately does.
    define: { "process.env.NODE_ENV": '"production"' },
  });

  const output = result.outputFiles?.[0];
  if (!output) throw new Error("The runtime core produced no output.");
  return output.text;
}

/**
 * Cached per requested set.
 *
 * Keyed by the sorted specifier list so a project importing three libraries
 * does not pay for ten, while two projects importing the same three share one
 * compile. The promise is cached rather than the value, so concurrent first
 * callers wait on one build instead of starting several.
 */
const cache = new Map<string, Promise<RuntimeBundle>>();

export function getRuntimeBundle(specifiers: readonly string[] = ALL_ENTRIES): Promise<RuntimeBundle> {
  /**
   * Deduplicated and ordered, so the cache key is canonical, and filtered
   * through the same allowlist the validator applies — never wider.
   *
   * It used to admit only exact `RUNTIME_LIBRARIES` names. But `isAllowedImport`
   * deliberately permits documented subpaths (`date-fns/locale`,
   * `react-dom/client`), so the gate accepted an import the bundler then
   * silently dropped: the import map shipped without it and the browser failed
   * to resolve the specifier, killing the module graph before a single line of
   * the app ran. Sharing the allowlist is what keeps "allowed to import" and
   * "actually built" the same set.
   */
  const wanted = [...new Set(specifiers.filter((s) => isAllowedImport(s)))].sort();
  const key = wanted.join("|");

  const existing = cache.get(key);
  if (existing) return existing;

  const pending = (async (): Promise<RuntimeBundle> => {
    const core = await buildCore(wanted);
    const names: Record<string, string[]> = {};
    for (const specifier of wanted) {
      names[specifier] = await exportedNames(specifier);
    }
    return { core, names };
  })().catch((error: unknown) => {
    // A failed build must not be cached as a permanent failure.
    cache.delete(key);
    throw error;
  });

  cache.set(key, pending);
  return pending;
}

/** Test seam: forget the cache so a rebuild can be measured. */
export function resetRuntimeBundle(): void {
  cache.clear();
}
