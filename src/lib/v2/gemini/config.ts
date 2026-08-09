import "server-only";

/**
 * Server-only configuration for V2 generation.
 *
 * Importing `server-only` at the top is the enforcement, not a convention: if
 * any client component ever pulls this module in — directly or through a
 * barrel — the build fails rather than shipping the key resolution logic to a
 * browser bundle.
 */

/**
 * The pinned model. Not a `-latest`, `-preview` or `-exp` alias: an alias can
 * change what the schema is validated against without a deploy, and this
 * pipeline's whole safety argument rests on the response shape being stable.
 */
export const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash" as const;

/** Rejects the alias families outright rather than trusting the operator. */
const FORBIDDEN_MODEL_SUFFIXES = ["-latest", "-preview", "-exp", "-experimental"];

export const GENERATION_LIMITS = {
  /** Brief, artifact, and at most one repair. Enforced by the transport too. */
  maxRequests: 3,
  /** Per request, default. A hung call must not hold a server action open. */
  requestTimeoutMs: 90_000,
  /**
   * Stage B and its repair only.
   *
   * A live stage-B generation took 88.0 s against the 90 s default and came
   * within two seconds of a spurious timeout. MIME-only generation is far
   * slower than structured output was, because the model now writes the whole
   * document unaided.
   *
   * FOLLOW-UP RISK, deliberately not fixed here: `totalTimeoutMs` is still
   * 240 s, so a worst-case full run (90 + 120 + 120 = 330 s) would be cut off
   * by the pipeline-wide deadline before the repair could finish. Raising it
   * also runs into the hosting platform's own function limit, which is a
   * separate decision about where generation should execute.
   */
  stageBTimeoutMs: 120_000,
  /** Whole pipeline, across all three requests. */
  totalTimeoutMs: 240_000,
  maxOutputTokensBrief: 4_000,
  maxOutputTokensArtifact: 32_000,
  maxOutputTokensRepair: 32_000,
  /** Refuse absurd payloads before parsing rather than after. */
  maxResponseBytes: 400_000,
  maxFounderPromptChars: 2_000,
} as const;

export type ConfigResult =
  | { ok: true; apiKey: string; model: string }
  | { ok: false; code: "missing_api_key" | "bad_model"; message: string };

/**
 * Resolves the key and model, failing closed.
 *
 * The key is returned but never logged, never included in an error, and never
 * crosses a server boundary — the only consumer is the transport, in the same
 * process. `message` on the failure branch is written to be safe to show a
 * user verbatim.
 */
export function resolveGeminiConfig(env: NodeJS.ProcessEnv = process.env): ConfigResult {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return {
      ok: false,
      code: "missing_api_key",
      message: "Gemini is not configured on this server.",
    };
  }

  const model = (env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL).trim();
  if (!model) {
    return { ok: false, code: "bad_model", message: "No Gemini model configured." };
  }
  if (FORBIDDEN_MODEL_SUFFIXES.some((suffix) => model.endsWith(suffix))) {
    return {
      ok: false,
      code: "bad_model",
      message: `Model "${model}" is a moving alias; pin an exact version.`,
    };
  }

  return { ok: true, apiKey: apiKey.trim(), model };
}

/** Presence check for surfaces that must not touch the value at all. */
export function isGeminiConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim());
}
