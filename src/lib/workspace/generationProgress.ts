/**
 * Generation progress, from the stages the pipeline actually reports.
 *
 * WHAT THIS REPLACED. The progress list mixed two unrelated things. Three of
 * its four rows were ticked from what the project already held — a saved
 * concept, a saved audience, a chosen direction — so they were green before the
 * generation began and had nothing to do with it. Only the fourth row moved,
 * and it summarised the whole pipeline. The list looked like progress and was
 * mostly a summary of the past.
 *
 * WHAT IS TRUE. `generation_jobs.progress_stage` carries exactly five values,
 * written by the pipeline itself: `queued`, `preparing`, `generating`,
 * `saving`, `completed`. Every row below is one of them, in the order they
 * occur, and a row is done only because the run has passed it.
 *
 * WHAT IS DELIBERATELY ABSENT. Any finer breakdown. "Designing the structure"
 * and "building the interface" would be two lines for one stage — the model
 * call, the gate and the repair all report `generating` — so a list that
 * separated them would be inventing detail the system does not have. No
 * percentage either: nothing measures one.
 */

import type { JobStage } from "@/lib/jobs/generationJobs";

/** The order the pipeline moves through. Index is progress. */
export const GENERATION_STAGES: readonly JobStage[] = [
  "queued",
  "preparing",
  "generating",
  "saving",
  "completed",
] as const;

/** Message key per stage, in the `stage3` namespace. */
export const STAGE_LABEL_KEYS: Record<JobStage, string> = {
  queued: "progressQueued",
  preparing: "progressPreparing",
  generating: "progressGenerating",
  saving: "progressSaving",
  completed: "progressCompleted",
};

export interface GenerationProgressRow {
  stage: JobStage;
  labelKey: string;
  state: "done" | "active" | "waiting";
}

/**
 * The rows to show for a run.
 *
 * `succeeded` is treated as `completed` rather than read from the stage column:
 * the row reports success before the rebuilt project reaches the workspace, and
 * "Opening your app" is the honest description of that gap — something did
 * finish, and what remains is this screen catching up.
 *
 * A stage the job has not reported yet reads as `queued`, which is where every
 * job starts. That is a statement about the run, not a guess: a claimed job with
 * no stage written has not begun a stage.
 */
export function generationProgress(
  stage: JobStage | null,
  phase: "queued" | "running" | "succeeded" | "failed" | "idle" | "creating_job" | "retrying" | "stale",
): GenerationProgressRow[] {
  const current: JobStage = phase === "succeeded" ? "completed" : stage ?? "queued";
  const index = Math.max(0, GENERATION_STAGES.indexOf(current));

  return GENERATION_STAGES.map((entry, position) => ({
    stage: entry,
    labelKey: STAGE_LABEL_KEYS[entry],
    state: position < index ? "done" : position === index ? "active" : "waiting",
  }));
}
