import "server-only";

/**
 * First-version generation, as the queue consumer runs it.
 *
 * Two entry points, one per message, because the pipeline has two provider
 * calls and each needs a whole function's worth of time. Between them the work
 * hands itself forward by publishing the next message; there is no state held
 * anywhere in between except the job row and the message itself.
 *
 * THE SHAPE IS THE BUDGET. The ceiling has always been two provider requests:
 * one generation, and at most one repair that only some failures earn. Here
 * that is three things at once —
 *
 *   - the code path calls the provider exactly once per entry point;
 *   - `claimProviderRequest` moves a counter on the job under a row lock, so a
 *     redelivered message is refused before it can spend anything;
 *   - the consumer disables the queue's own retries, so a throwing handler is
 *     not re-run either.
 *
 * The first alone would be enough if delivery were exactly once. It is not, so
 * the second is what the guarantee actually rests on.
 *
 * ORDER MATTERS. The claim comes before the provider call and after the cheap
 * read guards, so a duplicate that arrives while the first is still running is
 * turned away without a second request, and a message for a job that a stale
 * sweep already closed does nothing at all.
 */

import {
  claimProviderRequest,
  type JobErrorCode,
} from "@/lib/jobs/generationJobs";
import { enqueueRepair, type GenerateMessage, type RepairMessage } from "./generationQueue";
import { appRepairEnabled } from "./renderProject";
import type { DeadlineOptions } from "./stages";
import {
  beginGeneration,
  evaluateGeneration,
  evaluateRepair,
  failGeneration,
  persistGeneratedApp,
  requestGeneration,
  requestRepair,
  type JobRef,
  type Verdict,
} from "./stages";
import type { GeneratedAppV1 } from "./contract";

export type GenerationOutcome =
  | { outcome: "generated" }
  | { outcome: "queued-repair"; stage?: string; issues?: string[] }
  | { outcome: "skipped"; reason: string }
  | {
      outcome: "failed";
      code: string;
      message: string;
      /**
       * What the gate actually objected to.
       *
       * Carried out so the consumer can record it. Three production
       * generations failed the gate on 2026-08-11 and not one of them left a
       * trace of which rule it broke: the job row keeps a code, the log kept a
       * code, and the issue list was computed and dropped. "Are these the same
       * mistake three times, or three different ones?" was unanswerable, which
       * is the one question worth asking about a run of failures.
       */
      issues?: string[];
    };

/** The counter value each phase requires. Generation first, repair second. */
const GENERATE_EXPECTS = 0;
const REPAIR_EXPECTS = 1;

export async function runGeneratePhase(
  message: GenerateMessage,
  options: DeadlineOptions = {},
): Promise<GenerationOutcome> {
  const ref: JobRef = { jobId: message.jobId, projectId: message.projectId, userId: message.userId };

  const start = await beginGeneration(ref);
  if (!start.proceed) return { outcome: "skipped", reason: start.reason ?? "nothing to do" };

  // Past here a provider request will be made, so this is the last point at
  // which a duplicate can be turned away for free.
  if (!(await claimProviderRequest(ref.jobId, GENERATE_EXPECTS))) {
    return { outcome: "skipped", reason: "this generation was already claimed" };
  }

  const generated = await requestGeneration(ref, { brief: message.brief }, options);
  if (!generated.ok) {
    // A transport failure says nothing about the project, so it never buys a
    // repair — the same rule the inline pipeline applied.
    return fail(ref, "provider_unavailable", generated.code, generated.message);
  }

  const verdict: Verdict = await evaluateGeneration(ref, generated.text);
  if (verdict.ok) return persist(ref, verdict.app, message);

  /**
   * A second request, only if this deploy allows one.
   *
   * V1 does not. `appRepairEnabled` is off in production, so a refused first
   * pass ends here: the job fails cleanly, the quota unit goes back, and the
   * person is offered Retry. That keeps the live invariant at one provider
   * request per attempt and keeps every outcome inside a single invocation,
   * which is the one that has never stopped executing.
   */
  if (verdict.plan && appRepairEnabled()) {
    const queued = await enqueueRepair({
      jobId: ref.jobId,
      projectId: ref.projectId,
      userId: ref.userId,
      brief: message.brief,
      locale: message.locale,
      model: message.model,
      issues: verdict.issues,
      plan: verdict.plan,
    });
    if (!queued.ok) return fail(ref, "invalid_output", verdict.code, verdict.message, verdict.issues);
    // Recorded even though the run continues: the first response's objections
    // are what a repair is answering, and they are gone by the time it lands.
    return { outcome: "queued-repair", stage: verdict.code, issues: verdict.issues };
  }

  return fail(ref, "invalid_output", verdict.code, verdict.message, verdict.issues);
}

export async function runRepairPhase(
  message: RepairMessage,
  options: DeadlineOptions = {},
): Promise<GenerationOutcome> {
  const ref: JobRef = { jobId: message.jobId, projectId: message.projectId, userId: message.userId };

  const start = await beginGeneration(ref);
  if (!start.proceed) return { outcome: "skipped", reason: start.reason ?? "nothing to do" };

  if (!(await claimProviderRequest(ref.jobId, REPAIR_EXPECTS))) {
    return { outcome: "skipped", reason: "this repair was already claimed" };
  }

  const repaired = await requestRepair(ref, {
    brief: message.brief,
    issues: message.issues,
    plan: message.plan,
  }, options);
  if (!repaired.ok) return fail(ref, "invalid_output", repaired.code, repaired.message);

  const verdict = await evaluateRepair(ref, { text: repaired.text, plan: message.plan });
  if (!verdict.ok) return fail(ref, "invalid_output", verdict.code, verdict.message, verdict.issues);

  return persist(ref, verdict.app, message);
}

async function persist(
  ref: JobRef,
  app: GeneratedAppV1,
  message: { model: string; locale: string },
): Promise<GenerationOutcome> {
  const saved = await persistGeneratedApp(ref, { app, model: message.model, locale: message.locale });
  if (!saved.ok) return fail(ref, "save_failed", "save_failed", saved.message ?? "Saving failed.");
  return { outcome: "generated" };
}

async function fail(
  ref: JobRef,
  code: JobErrorCode,
  reportedCode: string,
  message: string,
  issues?: string[],
): Promise<GenerationOutcome> {
  await failGeneration(ref, { code, message: `App runtime failed: ${reportedCode}.` });
  return { outcome: "failed", code: reportedCode, message, issues };
}
