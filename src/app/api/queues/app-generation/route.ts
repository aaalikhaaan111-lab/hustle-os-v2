import { handleCallback } from "@vercel/queue";
import { runGeneratePhase, runRepairPhase } from "@/lib/v2/app/runGeneration";
import type { GenerationMessage } from "@/lib/v2/app/generationQueue";

/**
 * Where queued generation work actually executes.
 *
 * An ordinary route handler, deliberately. The previous attempt at this used a
 * durable-workflow SDK whose own generated endpoints live under
 * `/.well-known/workflow/`, and those did not resolve on the deployment — the
 * function was built and invoked, and Next inside it answered with the
 * not-found page. Purpose-built handlers at this path shape were proved to work
 * on the same deployment before any of this was written.
 *
 * One invocation per provider call. The generation phase may spend up to 240 s
 * inside Gemini and the repair 180 s, both comfortably under the platform's
 * 300 s function ceiling, which is what the old single synchronous request
 * could not manage with two calls in it.
 */

// The platform maximum on this plan. `CONSUMER_BUDGETS` keeps the provider call
// well inside it; this is the outer bound, not the expected duration.
export const maxDuration = 300;

export const POST = handleCallback<GenerationMessage>(
  async (message, metadata) => {
    const result =
      message.phase === "repair" ? await runRepairPhase(message) : await runGeneratePhase(message);

    /**
     * One line per delivery. The delivery count is here because "did this run
     * twice" is the question every invariant turns on; the gate's issues are
     * here because without them a run of failures cannot be diagnosed at all.
     *
     * Bounded to the first few and truncated, because this is a diagnosis aid
     * and not a place to spill a project into the log.
     */
    const issues = "issues" in result ? result.issues : undefined;
    console.log("[ventrio-generation]", JSON.stringify({
      phase: message.phase,
      jobId: message.jobId,
      delivery: metadata.deliveryCount,
      outcome: result.outcome,
      ...(result.outcome === "failed" ? { code: result.code } : {}),
      ...(result.outcome === "skipped" ? { reason: result.reason } : {}),
      ...(issues?.length ? { issueCount: issues.length, issues: issues.slice(0, 6).map((i) => i.slice(0, 200)) } : {}),
    }));
  },
  {
    /**
     * Long enough for the whole invocation, and re-extended while it runs.
     *
     * The lease has to outlive the handler or the message is redelivered mid-
     * generation and a second Gemini request is paid for. The SDK re-extends
     * automatically — proved on this project with a 200 s handler that saw
     * exactly one delivery — and this ceiling is the belt to that's braces.
     */
    visibilityTimeoutSeconds: 600,

    /**
     * Never retry. A retry is a second paid generation nobody asked for.
     *
     * `acknowledge` drops the message instead of redelivering it, so a handler
     * that throws ends the delivery for good. The job is not left dangling:
     * every failure path inside the run has already marked the job failed and
     * released its quota, and anything that escapes that is caught by the stale
     * sweep, which refunds on the same terms.
     */
    retry: () => ({ acknowledge: true }),
  },
);
