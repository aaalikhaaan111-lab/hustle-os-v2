/**
 * Reading what `generateFirstVersionAction` actually said.
 *
 * THE DEFECT THIS FIXES. `/create` tested `!generation.output` and called
 * anything else a failure. That was correct while generation ran inside the
 * request and returned a finished version. It stopped being correct when
 * execution moved to the external worker: the action now claims a job, reserves
 * the unit, and returns `{ error: null, output: null, jobId }` — a success —
 * because the work has two more minutes to run somewhere else.
 *
 * So the screen told people "Не удалось создать проект" while their project was
 * being built, and it was true every single time. Both projects created on
 * 2026-08-12 reported that message and both finished successfully ~2.5 minutes
 * later, charged once, with the app persisted. Nothing failed except the
 * reading.
 *
 * The rule, in one line: `error` means failure. An output or a job id means it
 * started. Neither means the action answered something this screen cannot
 * interpret alone — which is a real case, not a bug, and `check-job` sends it to
 * the job state to settle rather than guessing.
 */

import type { LimitReachedInfo } from "@/lib/ai/usage";
import type { FirstVersionJobView } from "@/lib/jobs/firstVersion";

/**
 * Structural on purpose: `Stage3Result` lives inside a `"use server"` module
 * and is not exported, and this needs to be importable from a test.
 */
export interface FirstVersionStartResult {
  error: string | null;
  output: unknown;
  jobId?: string | null;
  limitReached?: LimitReachedInfo;
}

export type FirstVersionStart =
  /** Generation is under way. Hand off to the workspace, which polls the job. */
  | { outcome: "started"; via: "output" | "job" }
  /** A real, permanent limit. Its own message, and no retry. */
  | { outcome: "limit-reached"; limit: LimitReachedInfo }
  /** A real failure. `error` is the server's message when it gave one. */
  | { outcome: "failed"; error: string | null }
  /** Undecidable from the reply alone — ask the job state. */
  | { outcome: "check-job" };

export function classifyFirstVersionStart(result: FirstVersionStartResult): FirstVersionStart {
  // Checked first: a limit is not a failure to retry, and it carries its own
  // message and its own upsell.
  if (result.limitReached) return { outcome: "limit-reached", limit: result.limitReached };

  // The only thing that means failure. It is already localised by the server.
  if (result.error) return { outcome: "failed", error: result.error };

  // A finished version, from a path that still generates inline.
  if (result.output) return { outcome: "started", via: "output" };

  // A claimed job: the unit is reserved, the worker will pick it up, and the
  // workspace can already show progress for it.
  if (typeof result.jobId === "string" && result.jobId.length > 0) {
    return { outcome: "started", via: "job" };
  }

  return { outcome: "check-job" };
}

/**
 * Whether the project is already building or already built.
 *
 * The action answers with no error, no output and no job id in two ordinary
 * situations: the project already has a version ("alreadyReady"), and a job
 * this caller did not claim is already in flight. Both are reasons to go to the
 * workspace, and neither is a reason to offer Retry — pressing it again is what
 * produced the duplicate states, since a second click cannot claim a job that
 * is already claimed and so falls down the same path forever.
 *
 * `hasOutput` covers the legacy renderer. A succeeded job covers the app
 * runtime, whose version is an application rather than an `output`.
 */
export function startedFromJobView(view: FirstVersionJobView): boolean {
  if (view.hasOutput) return true;
  const status = view.job?.status;
  return status === "queued" || status === "running" || status === "succeeded";
}
