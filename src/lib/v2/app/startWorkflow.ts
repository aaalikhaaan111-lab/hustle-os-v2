import "server-only";

/**
 * Handing generation to the durable runtime.
 *
 * The seam between the server action and the workflow. It exists so the action
 * keeps the shape it always had — authenticate, sweep, claim, reserve, hand off
 * — and gains one line rather than a second copy of anything.
 *
 * The handoff is deliberately the last thing the action does. Everything that
 * decides whether generation may happen at all has already happened by the time
 * this is called, so a run only ever starts for a job that was genuinely
 * claimed and a unit of quota that was genuinely reserved.
 *
 * Idempotency is the job row's, not this function's. `start()` is only reached
 * after `claimJob` succeeded, and the partial unique index makes that succeed
 * once per attempt — so exactly one run exists per job, and a replayed
 * submission never reaches here at all.
 */

import { start } from "workflow/api";
import { generateFirstVersionWorkflow } from "@/workflows/firstVersion";
import { resolveGeminiConfig } from "@/lib/v2/gemini/config";

export type WorkflowHandoff =
  | { ok: true; runId: string }
  | { ok: false; code: "not_configured" | "enqueue_failed"; message: string };

export async function startFirstVersionWorkflow(input: {
  jobId: string;
  projectId: string;
  userId: string;
  brief: string;
  locale: string;
}): Promise<WorkflowHandoff> {
  const config = resolveGeminiConfig();
  if (!config.ok) return { ok: false, code: "not_configured", message: config.message };

  try {
    const run = await start(generateFirstVersionWorkflow, [
      {
        jobId: input.jobId,
        projectId: input.projectId,
        userId: input.userId,
        brief: input.brief,
        locale: input.locale,
        model: config.model,
      },
    ]);
    return { ok: true, runId: run.runId };
  } catch (error) {
    // Enqueueing failed, so nothing is running and nothing will. The caller
    // refunds and fails the job rather than leaving a row that says `running`
    // with no run behind it — which is the exact state the timeout used to
    // leave behind, and the reason any of this exists.
    return {
      ok: false,
      code: "enqueue_failed",
      message: error instanceof Error ? error.message : "The generation run could not be enqueued.",
    };
  }
}
