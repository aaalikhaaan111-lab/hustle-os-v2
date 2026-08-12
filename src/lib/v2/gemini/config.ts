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

/**
 * Per-stage time budgets, and the deadline derived from them.
 *
 * WHY THIS IS COMPUTED RATHER THAN WRITTEN DOWN. The old `totalTimeoutMs` was
 * a hand-picked 240 s sitting next to stage budgets that summed to 330 s. The
 * shortfall was documented as a known risk and then found the expensive way:
 * across three paid canary runs the generation took 204 s, 153 s and 232 s, and
 * the repair that followed each was handed whatever was left of the 240 s —
 * 35.6 s, 86.9 s and 7.9 s. All three repairs timed out. The repair budget was
 * fiction, and every run paid for a request that never had time to finish.
 *
 * A total that is written independently of the stages will drift away from
 * them again, so it is no longer written independently. `deadlineFor` sums the
 * stages a run will actually use and adds one slack allowance. The invariant is
 * asserted in the pipeline test rather than trusted to whoever edits next.
 *
 * These numbers are large. Generation genuinely takes minutes, and the honest
 * response to that is a budget that admits it — not a deadline that cuts the
 * work off and reports a timeout the operator cannot act on. Where a run this
 * long may execute is a separate question, recorded in the runtime notes: a
 * serverless function limit is a deployment constraint, not a reason to
 * pretend the model is faster than it is.
 */
export const STAGE_BUDGETS = {
  /** Short, structured, historically well under this. */
  brief: 60_000,
  /**
   * The main generation. The slowest observed paid run was 232 s; this is that
   * plus roughly 30% headroom, because a budget set at the observed maximum
   * turns normal variance into a failure.
   */
  generate: 300_000,
  /**
   * The repair. Given a real budget of its own rather than the remainder.
   *
   * Smaller than `generate` deliberately: a repair edits a bundle it was handed
   * and should not be rewriting it from scratch. If repairs routinely need the
   * full generation budget, the repair prompt is wrong and that is worth
   * finding out rather than papering over.
   */
  repair: 180_000,
} as const;

export type GenerationStage = keyof typeof STAGE_BUDGETS;

/**
 * The hard ceiling on one queue-consumer invocation, and the request budgets
 * that have to fit inside it.
 *
 * A queue consumer executes as a Vercel Function, so it inherits that platform's
 * maximum duration — 300 s on this account's plan, where 300 s is both the
 * default and the maximum and cannot be raised. `STAGE_BUDGETS.generate` is
 * exactly 300 s, which is fine for an offline canary and impossible for a consumer:
 * a request allowed to spend the whole ceiling leaves nothing for the parse,
 * the gate and the return, so the platform kills the invocation instead of the
 * request timing out cleanly.
 *
 * These are the budgets the queued path uses instead. The slowest of seventeen
 * measured live Gemini requests was 186.5 s, so 240 s is that plus about 29%
 * headroom while still leaving 60 s inside the function. The repair keeps its
 * existing 180 s, which already fits.
 *
 * This is a deployment constraint, not a change to how generation works: the
 * prompts, the budgets in tokens, the gate and the one-repair ceiling are all
 * untouched. What changed is that the two requests no longer share one function.
 */
export const FUNCTION_CEILING_MS = 300_000;

export const CONSUMER_BUDGETS = {
  generate: 240_000,
  repair: STAGE_BUDGETS.repair,
} as const;

/**
 * Room a consumer needs for everything that is not the provider call.
 *
 * Asserted rather than trusted: the pipeline test checks each budget against
 * the ceiling, so raising one without raising the other fails a test instead of
 * failing in production five minutes into a paid generation.
 */
export const CONSUMER_OVERHEAD_MS = 30_000;

/**
 * Slack for everything that is not the provider call: parsing, gating,
 * compiling, and the database writes around them.
 */
export const PIPELINE_SLACK_MS = 30_000;

/**
 * The deadline for a run that may use exactly these stages.
 *
 * Callers pass the stages they will actually attempt, so a run configured
 * without a repair is not held open for a repair budget it will never spend.
 */
export function deadlineFor(stages: readonly GenerationStage[]): number {
  return stages.reduce((total, stage) => total + STAGE_BUDGETS[stage], 0) + PIPELINE_SLACK_MS;
}

export const GENERATION_LIMITS = {
  /** Brief, artifact, and at most one repair. Enforced by the transport too. */
  maxRequests: 3,
  /** Per request, default. A hung call must not hold a server action open. */
  requestTimeoutMs: STAGE_BUDGETS.brief,
  /** The main generation stage. */
  stageBTimeoutMs: STAGE_BUDGETS.generate,
  /** The repair stage, which now has a budget instead of a remainder. */
  repairTimeoutMs: STAGE_BUDGETS.repair,
  /**
   * Whole pipeline. Derived, never hand-written — see the note above.
   *
   * Codegen runs generate + repair; the brief stage belongs to the older
   * two-stage pipeline and is included so the ceiling covers the longest run
   * any current caller can start.
   */
  totalTimeoutMs: deadlineFor(["brief", "generate", "repair"]),
  maxOutputTokensBrief: 4_000,
  /**
   * The documented output ceiling for gemini-3.6-flash.
   *
   * Was 32,000, sized for the old page-schema artifact. A live canary asked
   * for a project-management app, wrote 30,436 tokens of a multi-file project
   * and was cut off mid-string with `MAX_TOKENS`. The budget was the limit,
   * not the model. Truncation is still reported as truncation and still buys
   * no repair — a bigger budget makes the failure rarer, not survivable.
   */
  maxOutputTokensArtifact: 65_536,
  maxOutputTokensRepair: 32_000,
  /**
   * The ceiling for a rewrite repair, which reproduces the whole project.
   *
   * A rewrite used to be handed `maxOutputTokensArtifact` on the grounds that
   * it *is* a generation — true of the work, and wrong as a budget, because a
   * repair also has to fit inside a consumer deadline that a generation does
   * not. At 65,536 the model may legitimately write a response that cannot
   * finish in time, and the run is then killed by the clock rather than told
   * anything useful. That is what the 2026-08-11 production repair did.
   *
   * Sized from what rewrites actually emit. Every one that completed produced
   * between 23,572 and 26,732 output tokens; the single truncated attempt
   * wanted more than 29,944. 40,000 clears all of them with room, and bounds
   * the worst case to roughly the deadline — so an over-large project now
   * reports `too_large`, which names the problem, instead of timing out, which
   * does not.
   */
  maxOutputTokensRepairRewrite: 40_000,
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
