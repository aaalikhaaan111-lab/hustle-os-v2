import "server-only";

/**
 * The shape of a generation job's work, as the executor receives it.
 *
 * This used to send messages to Vercel Queues. It no longer sends anything:
 * generation executes in an external worker that polls `generation_jobs` for
 * rows carrying a payload, because three attempts to run a multi-minute
 * provider call inside a Vercel function failed in three different ways and
 * none was fixable from inside the function.
 *
 * The types stayed. They are the contract between the action that records a
 * job and the code that runs it, and that contract did not change when the
 * thing running it moved — `runGeneratePhase` still takes exactly this.
 */

import type { JobRef, SerialPlan } from "./stages";

export interface GenerateMessage extends JobRef {
  phase: "generate";
  brief: string;
  locale: string;
  model: string;
}

export interface RepairMessage extends JobRef {
  phase: "repair";
  brief: string;
  locale: string;
  model: string;
  issues: string[];
  plan: SerialPlan;
}

export type GenerationMessage = GenerateMessage | RepairMessage;

export type EnqueueResult = { ok: true; messageId: string } | { ok: false; message: string };

/**
 * The repair hand-off, kept for the disabled repair path.
 *
 * `appRepairEnabled` is off in production, so nothing reaches this. It returns
 * a failure rather than pretending to queue, so that turning the flag on
 * without giving the worker a repair path fails loudly instead of silently
 * losing the second half of a run.
 */
export async function enqueueRepair(_input: Omit<RepairMessage, "phase">): Promise<EnqueueResult> {
  void _input;
  return { ok: false, message: "Repair execution is not wired to the external worker." };
}
