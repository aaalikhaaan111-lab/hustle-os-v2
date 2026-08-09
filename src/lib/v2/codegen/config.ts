import "server-only";

export { GENERATION_LIMITS } from "@/lib/v2/gemini/config";

/**
 * Codegen's provider configuration.
 *
 * The prototype resolved a Gemini key and a Gemini model. Production generates
 * through Anthropic, so this resolves the key the rest of the product already
 * uses and pins a model by exact id.
 *
 * `server-only` at the top is the enforcement: if any client component ever
 * pulls this in, the build fails rather than shipping key resolution into a
 * browser bundle. The key itself is never returned — callers get a boolean and
 * a model name, and the transport reads the environment itself.
 */

/** Pinned, not an alias: an alias can change behaviour without a deploy. */
export const DEFAULT_CODEGEN_MODEL = "claude-sonnet-5" as const;

const FORBIDDEN_MODEL_SUFFIXES = ["-latest", "-preview", "-exp", "-experimental"];

export type CodegenConfig =
  | { ok: true; model: string }
  | { ok: false; message: string };

export function resolveCodegenConfig(): CodegenConfig {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, message: "No provider key is configured." };
  }
  const model = process.env.CODEGEN_MODEL ?? DEFAULT_CODEGEN_MODEL;
  if (FORBIDDEN_MODEL_SUFFIXES.some((suffix) => model.endsWith(suffix))) {
    return { ok: false, message: "A pinned model id is required; aliases are refused." };
  }
  return { ok: true, model };
}
