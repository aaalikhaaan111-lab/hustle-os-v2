import "server-only";

import type { Stage3ProjectOutput } from "@/lib/build/stage3Types";
import { AnthropicCodegenTransport } from "./anthropicTransport";
import { TRUSTED_ASSETS } from "./assets";
import { resolveCodegenConfig } from "./config";
import { generateCodegenBundle } from "./generate";
import { buildCodegenBrief, codegenRoutesFor } from "./projectBrief";
import { projectContentPack } from "./projectContent";
import { CODEGEN_STATE_VERSION, type CodegenProjectState } from "./projectState";

/**
 * Generates a real project's site through the codegen path.
 *
 * This is the seam the canary runs across. Everything above it — the intake,
 * the artifact, the job row, the quota unit — is unchanged; everything below it
 * is the sandboxed contract the prototype established. Swapping which renderer
 * a project uses is one boolean, which is what makes the comparison honest.
 *
 * It returns state to store, never a page. The caller persists it inside the
 * same transaction-shaped sequence as the artifact, so a project can never end
 * up with a bundle recorded and no artifact behind it.
 */

/** Off unless deliberately enabled. The fixed renderer is still what ships. */
export function codegenRenderingEnabled(): boolean {
  return process.env.VENTRIO_CODEGEN_RENDER === "1";
}

export type CodegenRenderResult =
  | { ok: true; state: CodegenProjectState; requestCount: number; durationMs: number }
  | { ok: false; code: string; message: string; issues?: string[]; requestCount: number };

export interface CodegenRenderInput {
  output: Stage3ProjectOutput;
  intake?: { productType?: string; designDirection?: string } | null;
  locale: string;
}

export async function renderProjectWithCodegen(
  input: CodegenRenderInput,
): Promise<CodegenRenderResult> {
  const config = resolveCodegenConfig();
  if (!config.ok) {
    return { ok: false, code: "unconfigured", message: config.message, requestCount: 0 };
  }

  const content = projectContentPack(input.output);
  const brief = buildCodegenBrief(input);
  const routes = codegenRoutesFor(input.output);

  /**
   * Imagery follows the artifact's own decision.
   *
   * `imageryStrategy: "none"` is a real answer, not an absence — a type-led
   * page that never reserves space for a picture beats one that frames a
   * placeholder. Passing an empty registry in that case tells both the prompt
   * and the gate there are no pictures, and the gate then refuses any layout
   * that implies one. That pairing is what stops an empty visual column.
   */
  const assets = input.output.design.imageryStrategy === "none" ? new Map() : TRUSTED_ASSETS;

  const result = await generateCodegenBundle(
    { model: config.model, brief, content, routes, assets },
    new AnthropicCodegenTransport(config.model),
  );

  if (!result.ok) {
    return {
      ok: false,
      code: result.code,
      message: result.message,
      issues: result.issues,
      requestCount: result.telemetry.requestCount,
    };
  }

  // `generateCodegenBundle` has already compiled and accepted the bundle; what
  // is stored is the bundle itself, recompiled on every read. See projectState.
  return {
    ok: true,
    state: {
      version: CODEGEN_STATE_VERSION,
      kind: "codegen",
      bundle: result.bundle,
      content,
      generatedAt: new Date().toISOString(),
      model: config.model,
    },
    requestCount: result.telemetry.requestCount,
    durationMs: result.telemetry.totalLatencyMs,
  };
}
