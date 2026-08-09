import "server-only";

/**
 * Validate → compile → document. The deterministic part of app generation.
 *
 * Everything here is pure with respect to the provider: given the same bundle
 * it produces the same document, every time, with no network and no clock
 * dependence. That matters because it is what lets a paid response be replayed
 * offline through a later version of the gate — the lesson from the codegen
 * canary, where three paid bundles were recoverable only because nothing in the
 * path between the response and the verdict needed the provider again.
 *
 * Failure is always terminal and always specific. Each stage names the file and
 * the rule, because the output of a failure here becomes the input to the one
 * bounded repair the pipeline allows, and "it did not work" is not something a
 * model can act on.
 */

import { compileGeneratedApp, type CompileDiagnostic } from "./compile";
import { buildSandboxDocument } from "./sandbox";
import { getRuntimeBundle } from "./runtimeBundle";
import { validateGeneratedApp, type AppIssue } from "./validate";
import type { GeneratedAppV1 } from "./contract";

export type AppBuildResult =
  | {
      ok: true;
      app: GeneratedAppV1;
      /** The complete document for the sandboxed frame. */
      document: string;
      compiledBytes: number;
      documentBytes: number;
      compileMs: number;
      warnings: CompileDiagnostic[];
    }
  | { ok: false; stage: "validate"; issues: AppIssue[] }
  | { ok: false; stage: "compile"; code: string; errors: CompileDiagnostic[] };

export interface BuildOptions {
  /** Ventrio-owned asset id → data URI, exposed to the app as a lookup table. */
  assets?: Record<string, string>;
}

export async function buildGeneratedApp(
  value: unknown,
  options: BuildOptions = {},
): Promise<AppBuildResult> {
  const validation = validateGeneratedApp(value);
  if (!validation.ok) return { ok: false, stage: "validate", issues: validation.issues };
  const app = validation.app;

  const compiled = await compileGeneratedApp(app);
  if (!compiled.ok) {
    return { ok: false, stage: "compile", code: compiled.code, errors: compiled.errors };
  }

  // Only the assets the project actually declared are exposed. A project that
  // declares none gets none — the sandbox has no way to reach an asset it was
  // not handed, so this is the whole of the asset boundary.
  const declared = new Set(app.assets ?? []);
  const assets: Record<string, string> = {};
  for (const [id, uri] of Object.entries(options.assets ?? {})) {
    if (declared.has(id)) assets[id] = uri;
  }

  /**
   * Only the libraries this project declared are shipped into the sandbox.
   *
   * Shipping all ten produced a 1.8 MB document for an app importing three of
   * them — recharts and framer-motion dominate — and every preview paid that.
   * Narrowing it is also the smaller surface: a library that is not in the
   * import map is not reachable from inside the sandbox at all, so an import
   * that somehow evaded both the validator and the bundler still finds nothing
   * to resolve against.
   *
   * The template's own imports are always included: Ventrio's entry module
   * mounts with them, so their absence would be a build that cannot start.
   */
  const needed = [
    "react", "react-dom", "react-dom/client", "react/jsx-runtime",
    ...app.runtime.dependencies,
  ];
  const runtime = await getRuntimeBundle(needed);

  const document = buildSandboxDocument({
    code: compiled.code,
    css: compiled.css,
    runtimeCore: runtime.core,
    runtimeNames: runtime.names,
    lang: app.metadata.locale,
    title: app.metadata.name,
    assets,
  });

  return {
    ok: true,
    app,
    document,
    compiledBytes: compiled.bytes,
    documentBytes: Buffer.byteLength(document, "utf8"),
    compileMs: compiled.durationMs,
    warnings: compiled.warnings,
  };
}

/**
 * A failure, phrased for the model that has to fix it.
 *
 * Deliberately concrete: paths, rules and compiler messages, with no advice
 * attached. A repair prompt that editorialises ("consider simplifying") gets a
 * rewrite; one that states the twelve exact problems gets twelve fixes.
 */
export function describeFailure(result: Extract<AppBuildResult, { ok: false }>): string[] {
  if (result.stage === "validate") {
    return result.issues.map((issue) => `${issue.path}: ${issue.code} — ${issue.detail}`);
  }
  return result.errors.map((error) => {
    const where = error.file
      ? `${error.file}${error.line ? `:${error.line}${error.column ? `:${error.column}` : ""}` : ""}`
      : "build";
    return `${where}: ${error.text}`;
  });
}
