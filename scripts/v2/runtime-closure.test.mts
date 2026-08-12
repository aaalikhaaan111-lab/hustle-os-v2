/**
 * Proves the traced package closure is enough to rebuild a generated app.
 *
 * WHY THIS TEST EXISTS. The workspace rebuilds a stored application on every
 * read, bundling the runtime libraries out of `node_modules`. On Vercel only
 * traced files exist, and `outputFileTracingIncludes` is fed by
 * `runtimeClosure()` — so a package the closure misses is present in every
 * developer's `node_modules` and absent in production. That asymmetry is the
 * whole problem: it cannot fail locally, it fails only after a real generation,
 * and what the person sees is an error page where their application should be.
 *
 * It happened twice. First because nothing traced the libraries at all, then
 * because `recharts` imports `react-is` and declares it only as a peer.
 *
 * So this does not read manifests — reading manifests is the thing under test.
 * It builds a `node_modules` containing the closure and nothing else, points
 * the real bundler at it, and lets esbuild answer. A missing package fails here,
 * by name, in a few seconds.
 */

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, symlinkSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { build } from "esbuild";
import { runtimeClosure } from "../../src/lib/v2/app/runtimeClosure.js";
import { RUNTIME_LIBRARIES } from "../../src/lib/v2/app/runtime.js";

let checks = 0;
const check = (label: string, fn: () => void): void => {
  fn();
  checks += 1;
  void label;
};

const REPO = resolve(import.meta.dirname, "../..");

/**
 * A tree holding exactly the closure, by symlink.
 *
 * Symlinks rather than copies because the closure is ~16 000 files and the
 * point is which package directories exist, not their bytes. Scoped names get
 * their parent directory created first, the way npm lays them out.
 */
function isolatedTree(packages: readonly string[]): string {
  const root = mkdtempSync(join(tmpdir(), "ventrio-closure-"));
  for (const name of packages) {
    const target = join(REPO, "node_modules", name);
    if (!existsSync(target)) continue;
    const link = join(root, "node_modules", name);
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(target, link, "dir");
  }
  return root;
}

/**
 * The same bundle `runtimeBundle.ts` performs, against the isolated tree.
 *
 * Kept in step with `buildCore` by hand rather than imported: that module is
 * `server-only` and hard-codes `resolveDir: process.cwd()`, which is precisely
 * the line this needs to vary. The options that matter for resolution —
 * `bundle`, `platform`, the entry shape — are what is copied.
 */
async function bundleAgainst(root: string, specifiers: readonly string[]): Promise<string[]> {
  const contents = specifiers
    .map((spec, i) => `import * as __m${i} from ${JSON.stringify(spec)};\nexport { __m${i} };`)
    .join("\n");

  try {
    await build({
      stdin: { contents, resolveDir: root, loader: "js" },
      bundle: true,
      /**
       * Without this the isolation is theatre.
       *
       * esbuild resolves through a symlink's real path by default, so a package
       * linked in from the repo would go on finding the repo's whole
       * `node_modules` by walking up from there — and the first version of this
       * test passed against a closure with `react-is` deliberately removed.
       * Preserving symlinks keeps resolution inside the temporary tree, which is
       * the shape Vercel actually ships: a flat directory of traced packages.
       */
      preserveSymlinks: true,
      write: false,
      format: "esm",
      target: "es2022",
      platform: "browser",
      minify: false,
      logLevel: "silent",
      define: { "process.env.NODE_ENV": '"production"' },
    });
    return [];
  } catch (error) {
    const failures = (error as { errors?: { text: string }[] }).errors ?? [];
    return failures.map((failure) => failure.text);
  }
}

async function main(): Promise<void> {
  // `runtimeClosure` reads relative paths, the way it does under `next build`.
  process.chdir(REPO);
  const packages = runtimeClosure();

  check("the closure covers every runtime library", () => {
    for (const library of RUNTIME_LIBRARIES) {
      // A subpath entry such as `react-dom/client` ships inside its package.
      const pkg = library.name.startsWith("@")
        ? library.name.split("/").slice(0, 2).join("/")
        : library.name.split("/")[0]!;
      assert.ok(packages.includes(pkg), `${pkg} is missing from the closure`);
    }
  });

  check("react and react-dom are roots, not incidental", () => {
    assert.ok(packages.includes("react"));
    assert.ok(packages.includes("react-dom"));
  });

  check("the closure is deduplicated and ordered", () => {
    assert.deepEqual(packages, [...new Set(packages)].sort());
  });

  check("a closure this small would not be believable", () => {
    assert.ok(packages.length > 20, `closure is only ${packages.length} packages`);
  });

  // The actual proof.
  const specifiers = [...new Set(["react", "react-dom", "react-dom/client", "react/jsx-runtime",
    ...RUNTIME_LIBRARIES.map((library) => library.name)])];

  const root = isolatedTree(packages);
  try {
    const unresolved = await bundleAgainst(root, specifiers);
    check("every runtime library bundles against the closure alone", () => {
      assert.deepEqual(
        unresolved,
        [],
        `the traced closure is incomplete — production would fail on:\n  ${unresolved.join("\n  ")}`,
      );
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }

  /**
   * Negative control.
   *
   * Without it, a bundler that silently resolved nothing would pass everything
   * above. Dropping one package the libraries genuinely need must break the
   * build — and name that package.
   */
  const withoutReactIs = packages.filter((name) => name !== "react-is");
  if (withoutReactIs.length < packages.length) {
    const crippled = isolatedTree(withoutReactIs);
    try {
      const unresolved = await bundleAgainst(crippled, specifiers);
      check("removing a needed package fails, and says which", () => {
        assert.ok(unresolved.length > 0, "a missing package went unnoticed — this test proves nothing");
        assert.ok(
          unresolved.some((text) => text.includes("react-is")),
          `expected react-is to be named, got: ${unresolved.join("; ")}`,
        );
      });
    } finally {
      rmSync(crippled, { recursive: true, force: true });
    }
  }

  console.log(`runtime-closure: ${checks} checks passed (${packages.length} packages)`);
}

await main();
