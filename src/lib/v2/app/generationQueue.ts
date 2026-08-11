import "server-only";

/**
 * The messages first-version generation runs on, and how they are sent.
 *
 * Two message shapes, because the pipeline has exactly two provider calls and
 * each needs a function of its own — that is the whole reason any of this
 * exists. A generation message becomes a repair message only when the gate says
 * a second request is worth paying for.
 *
 * The repair message carries its plan rather than leaving it somewhere to be
 * looked up. `planRepair` already decided patch-or-rewrite from the failure,
 * and re-deriving that decision in another invocation would mean re-running the
 * gate on a response nobody kept. Messages may be up to 100 MB; the largest
 * plan here is a validated project plus the files a diagnostic named, which is
 * a few hundred kilobytes at worst.
 *
 * IDEMPOTENCY. Every send carries a key derived from the job, so the queue
 * itself refuses a duplicate publish. That is the outer of two guards and the
 * weaker one — it stops a second *send*, not a second *delivery*. The guard
 * that actually protects the money is `claimProviderRequest`, which the
 * consumer wins at most once per phase. See the migration for why both exist.
 */

import { send } from "@vercel/queue";
import type { JobRef, SerialPlan } from "./stages";

/** One topic. Both phases travel on it, distinguished by `phase`. */
export const GENERATION_TOPIC = "ventrio-app-generation";

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

/**
 * How long a message may wait before it is dropped.
 *
 * Well beyond any run: a generation is minutes, and the stale sweep gives up on
 * a job after five. An hour means a queue backlog can never resurrect work for
 * a job that was already refunded and closed — the consumer's own guards would
 * refuse it anyway, but expiring it costs nothing and keeps the topic clean.
 */
const RETENTION_SECONDS = 3_600;

export type EnqueueResult = { ok: true; messageId: string } | { ok: false; message: string };

export async function enqueueGeneration(input: Omit<GenerateMessage, "phase">): Promise<EnqueueResult> {
  return publish({ ...input, phase: "generate" }, `generate:${input.jobId}`);
}

export async function enqueueRepair(input: Omit<RepairMessage, "phase">): Promise<EnqueueResult> {
  return publish({ ...input, phase: "repair" }, `repair:${input.jobId}`);
}

async function publish(message: GenerationMessage, idempotencyKey: string): Promise<EnqueueResult> {
  try {
    const { messageId } = await send(GENERATION_TOPIC, message, {
      idempotencyKey,
      retentionSeconds: RETENTION_SECONDS,
    });
    // The id is only for the log line. A publish that returned without throwing
    // is queued whether or not the response carried one.
    return { ok: true, messageId: messageId ?? "(unreported)" };
  } catch (error) {
    /**
     * A failed publish means nothing is queued and nothing will be.
     *
     * The caller has to treat that as a failed generation and refund, rather
     * than leaving a row that says `running` with no work behind it — which is
     * exactly the state the old synchronous timeout used to leave, and the
     * reason this pipeline was rebuilt.
     */
    return {
      ok: false,
      message: error instanceof Error ? error.message : "The generation could not be queued.",
    };
  }
}
