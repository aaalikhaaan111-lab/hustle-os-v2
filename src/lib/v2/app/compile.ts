import "server-only";

/**
 * Compiling a generated project without letting it touch the machine.
 *
 * THE THREAT. A bundler is a program that reads paths a stranger chose and
 * executes plugin code while doing it. Point esbuild at a directory and it will
 * happily resolve `../../../../etc/passwd`, follow a symlink, or pull a package
 * from node_modules that the validator never saw. So the generated project is
 * never written to disk and the bundler is never allowed to look at one:
 * everything resolves through an in-memory plugin whose entire world is the
 * validated file map.
 *
 * Four properties, each enforced here rather than assumed:
 *
 *   1. NO FILESYSTEM. Every resolve returns a virtual namespace path or fails.
 *      There is no fallback to `node_modules`, no `resolveDir`, no `--outdir`.
 *   2. NO NETWORK. Runtime libraries are marked external and resolved by the
 *      preview's import map, so the build never fetches and never needs to.
 *   3. NO PLUGINS FROM THE PROJECT. esbuild config is a constant in this file.
 *   4. BOUNDED. Wall-clock and output size are checked, and a build that runs
 *      long is abandoned rather than waited on.
 *
 * The compile is also the second, independent check on imports. The validator
 * scans source text; esbuild resolves for real. A specifier that slips past the
 * regex still has to come back through `onResolve`, which knows only the file
 * map and the allowlist — so the bundler disagreeing with the validator is a
 * refusal, not a surprise.
 */

import { build, type Plugin } from "esbuild";
import { APP_BUDGETS, type GeneratedAppV1 } from "./contract";
import { isAllowedImport, RUNTIME_TEMPLATES, type RuntimeTemplateId } from "./runtime";

export interface CompileDiagnostic {
  /** Project-relative file, when esbuild could attribute it to one. */
  file?: string;
  line?: number;
  column?: number;
  text: string;
}

export type AppCompileResult =
  | {
      ok: true;
      /** The bundled ES module. Ventrio serves this; it is never written to disk. */
      code: string;
      bytes: number;
      durationMs: number;
      warnings: CompileDiagnostic[];
    }
  | {
      ok: false;
      code: "build_failed" | "budget_output" | "timeout" | "internal";
      errors: CompileDiagnostic[];
      durationMs: number;
    };

const VIRTUAL = "ventrio-app";

/**
 * The entry module, written by Ventrio.
 *
 * It is generated here rather than taken from the project because it is the
 * one file that decides what gets mounted and what the app is allowed to see.
 * It also installs the error reporting the repair loop depends on: a generated
 * app that throws during render must produce a diagnostic, not a blank frame.
 */
function entrySource(template: RuntimeTemplateId): string {
  const { root } = RUNTIME_TEMPLATES[template];
  return `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "/${root}";

// Errors are reported to the host through the preview protocol, which is the
// only channel out of the sandbox. Without this a render failure is a blank
// frame and the repair pass has nothing to work from.
function report(kind, message, stack) {
  try {
    window.parent.postMessage({
      source: "ventrio-preview",
      version: 1,
      type: "runtime-error",
      payload: { kind: kind, message: String(message).slice(0, 2000), stack: String(stack || "").slice(0, 4000) },
    }, "*");
  } catch (_) { /* the host may be gone; never throw from the reporter */ }
}

window.addEventListener("error", (e) => report("error", e.message, e.error && e.error.stack));
window.addEventListener("unhandledrejection", (e) => report("unhandledrejection", e.reason, e.reason && e.reason.stack));

const node = document.getElementById("root");
try {
  createRoot(node).render(<StrictMode><App /></StrictMode>);
  window.parent.postMessage({ source: "ventrio-preview", version: 1, type: "ready", payload: {} }, "*");
} catch (error) {
  report("mount", error && error.message, error && error.stack);
}
`;
}

/**
 * Resolves everything from the in-memory map, and nothing from anywhere else.
 *
 * The two `onResolve` arms are exhaustive by construction: a specifier is
 * either a runtime library (external, resolved later by the import map) or a
 * project file (virtual). Anything that matches neither throws, which fails the
 * build with a message naming the specifier.
 */
function virtualFiles(files: Record<string, string>, entry: string): Plugin {
  return {
    name: "ventrio-virtual-fs",
    setup(pluginBuild) {
      pluginBuild.onResolve({ filter: /.*/ }, (args) => {
        if (args.path === entry) return { path: entry, namespace: VIRTUAL };

        // Bare specifiers: allowed libraries only, and left external so the
        // build neither reads node_modules nor emits their source.
        if (!args.path.startsWith(".") && !args.path.startsWith("/")) {
          if (isAllowedImport(args.path)) return { path: args.path, external: true };
          return { errors: [{ text: `"${args.path}" is not available in the Ventrio runtime.` }] };
        }

        const from = args.importer && args.namespace === VIRTUAL ? args.importer : entry;
        const resolved = resolveInMap(files, from, args.path);
        if (!resolved) {
          return { errors: [{ text: `Cannot resolve "${args.path}" from "${from}".` }] };
        }
        return { path: resolved, namespace: VIRTUAL };
      });

      pluginBuild.onLoad({ filter: /.*/, namespace: VIRTUAL }, (args) => {
        if (args.path === entry) {
          return { contents: files[entry], loader: "tsx" };
        }
        const contents = files[args.path];
        if (contents === undefined) {
          return { errors: [{ text: `"${args.path}" is not part of this project.` }] };
        }
        return { contents, loader: loaderFor(args.path) };
      });
    },
  };
}

function loaderFor(path: string): "tsx" | "ts" | "jsx" | "js" | "css" | "json" {
  if (path.endsWith(".tsx")) return "tsx";
  if (path.endsWith(".ts")) return "ts";
  if (path.endsWith(".jsx")) return "jsx";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".json")) return "json";
  return "js";
}

/**
 * Path resolution over the map, with extension and index inference.
 *
 * Mirrors what a bundler does for a real directory, minus every case that
 * reaches outside it. A resolution that would climb above the project returns
 * null instead of walking up — the map has no parent, and pretending otherwise
 * is how a traversal becomes a read.
 */
function resolveInMap(
  files: Record<string, string>,
  importer: string,
  specifier: string,
): string | null {
  const base = specifier.startsWith("/")
    ? []
    : importer.split("/").slice(0, -1);
  const parts = specifier.replace(/^\//, "").split("/");
  const out = [...base];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (out.length === 0) return null;
      out.pop();
      continue;
    }
    out.push(part);
  }
  const joined = out.join("/");
  if (!joined) return null;

  const candidates = [
    joined,
    `${joined}.tsx`, `${joined}.ts`, `${joined}.jsx`, `${joined}.js`,
    `${joined}.css`, `${joined}.json`,
    `${joined}/index.tsx`, `${joined}/index.ts`, `${joined}/index.jsx`, `${joined}/index.js`,
  ];
  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(files, candidate)) return candidate;
  }
  return null;
}

export async function compileGeneratedApp(app: GeneratedAppV1): Promise<AppCompileResult> {
  const startedAt = Date.now();
  const elapsed = () => Date.now() - startedAt;

  const template = app.runtime.template as RuntimeTemplateId;
  const entry = RUNTIME_TEMPLATES[template].entry;

  // Ventrio's entry is added to the map here, after validation refused any
  // project that tried to supply its own.
  const files: Record<string, string> = { ...app.files, [entry]: entrySource(template) };

  try {
    const result = await withTimeout(
      build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: "esm",
        target: "es2022",
        platform: "browser",
        jsx: "automatic",
        minify: false,
        sourcemap: false,
        // Kept so a runtime error can be attributed to a generated file.
        logLevel: "silent",
        // No absolute paths from this machine end up in the output.
        absWorkingDir: "/",
        plugins: [virtualFiles(files, entry)],
        // Belt and braces: even if a resolve slipped through, these never
        // become part of the bundle.
        external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime",
          "react-router-dom", "framer-motion", "lucide-react", "recharts", "clsx", "date-fns"],
        define: { "process.env.NODE_ENV": '"production"' },
      }),
      APP_BUDGETS.maxCompileMs,
    );

    if (result === TIMED_OUT) {
      return { ok: false, code: "timeout", errors: [{ text: `The build exceeded ${APP_BUDGETS.maxCompileMs} ms.` }], durationMs: elapsed() };
    }

    const output = result.outputFiles?.[0];
    if (!output) {
      return { ok: false, code: "internal", errors: [{ text: "The build produced no output." }], durationMs: elapsed() };
    }

    const code = output.text;
    const bytes = Buffer.byteLength(code, "utf8");
    if (bytes > APP_BUDGETS.maxCompiledBytes) {
      return {
        ok: false,
        code: "budget_output",
        errors: [{ text: `The bundle is ${bytes} B, over the ${APP_BUDGETS.maxCompiledBytes} B limit.` }],
        durationMs: elapsed(),
      };
    }

    return { ok: true, code, bytes, durationMs: elapsed(), warnings: result.warnings.map(toDiagnostic) };
  } catch (error) {
    // esbuild throws a structured failure; anything else is ours.
    const errors = (error as { errors?: unknown }).errors;
    if (Array.isArray(errors)) {
      return { ok: false, code: "build_failed", errors: errors.map(toDiagnostic), durationMs: elapsed() };
    }
    return {
      ok: false,
      code: "internal",
      errors: [{ text: error instanceof Error ? error.message : "The build did not complete." }],
      durationMs: elapsed(),
    };
  }
}

const TIMED_OUT = Symbol("timed-out");

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<typeof TIMED_OUT>((resolve) => { timer = setTimeout(() => resolve(TIMED_OUT), ms); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

interface EsbuildMessage {
  text?: unknown;
  location?: { file?: unknown; line?: unknown; column?: unknown } | null;
}

function toDiagnostic(message: unknown): CompileDiagnostic {
  const m = message as EsbuildMessage;
  const location = m.location ?? null;
  return {
    text: typeof m.text === "string" ? m.text : "Unknown build problem.",
    file: typeof location?.file === "string" ? location.file : undefined,
    line: typeof location?.line === "number" ? location.line : undefined,
    column: typeof location?.column === "number" ? location.column : undefined,
  };
}
