/**
 * First-version generation, as a durable run.
 *
 * This function is pure orchestration and nothing else. It holds no provider
 * client, opens no database connection and imports no Node module — the
 * workflow compiler runs it in a sandbox so that a run can be replayed
 * deterministically after a crash or a deploy, and anything non-deterministic
 * in here would break that guarantee. Every side effect lives in a step.
 *
 * THE SHAPE IS THE BUDGET. The pipeline's ceiling has always been two provider
 * requests: one generation, and at most one repair that only some failures earn.
 * Inline, that was enforced by a counter inside `generateApp`. Here it is
 * enforced by the code path — `requestGeneration` is called once, `requestRepair`
 * is called at most once, and neither step retries — which is a stronger
 * guarantee than a counter, because a replay re-runs the same path and finds
 * the same completed steps rather than resetting a tally.
 *
 * WHAT A REPLAY DOES. Nothing visible. Completed steps are not re-executed;
 * their recorded results are handed back. If the run is retried from the start,
 * `beginGeneration` finds the job already finished or the project already
 * holding an application and stops before spending anything.
 */

import {
  beginGeneration,
  evaluateGeneration,
  evaluateRepair,
  failGeneration,
  persistGeneratedApp,
  requestGeneration,
  requestRepair,
  type StepJobRef,
  type Verdict,
} from "./steps";

export interface FirstVersionWorkflowInput extends StepJobRef {
  /** What to build, already composed. This function does not author briefs. */
  brief: string;
  locale: string;
  model: string;
}

export type FirstVersionWorkflowResult =
  | { outcome: "generated" }
  | { outcome: "skipped"; reason: string }
  | { outcome: "failed"; code: string; message: string };

export async function generateFirstVersionWorkflow(
  input: FirstVersionWorkflowInput,
): Promise<FirstVersionWorkflowResult> {
  "use workflow";

  const ref: StepJobRef = { jobId: input.jobId, projectId: input.projectId, userId: input.userId };

  const start = await beginGeneration(ref);
  if (!start.proceed) return { outcome: "skipped", reason: start.reason ?? "nothing to do" };

  const generated = await requestGeneration(ref, { brief: input.brief });
  if (!generated.ok) {
    // A transport failure says nothing about the project, so it never buys a
    // repair — the same rule the inline pipeline applied.
    await failGeneration(ref, {
      code: "provider_unavailable",
      message: `App runtime failed: ${generated.code}.`,
    });
    return { outcome: "failed", code: generated.code, message: generated.message };
  }

  let verdict: Verdict = await evaluateGeneration(ref, generated.text);

  // The one repair. Only when the failure is the kind a second request can act
  // on, and only ever once.
  if (!verdict.ok && verdict.plan) {
    const plan = verdict.plan;
    const issues = verdict.issues;
    const repaired = await requestRepair(ref, { brief: input.brief, issues, plan });
    if (!repaired.ok) {
      await failGeneration(ref, {
        code: "invalid_output",
        message: `App runtime failed: ${verdict.code}.`,
      });
      return { outcome: "failed", code: verdict.code, message: verdict.message };
    }
    verdict = await evaluateRepair(ref, { text: repaired.text, plan });
  }

  if (!verdict.ok) {
    await failGeneration(ref, { code: "invalid_output", message: `App runtime failed: ${verdict.code}.` });
    return { outcome: "failed", code: verdict.code, message: verdict.message };
  }

  const saved = await persistGeneratedApp(ref, {
    app: verdict.app,
    model: input.model,
    locale: input.locale,
  });
  if (!saved.ok) {
    await failGeneration(ref, { code: "save_failed", message: saved.message ?? "Saving failed." });
    return { outcome: "failed", code: "save_failed", message: saved.message ?? "Saving failed." };
  }

  return { outcome: "generated" };
}
