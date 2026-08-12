import type { GenerationJob } from "./generationJobs";

/**
 * The shape of first-version generation that both sides of the wire need.
 *
 * Kept out of the server action file because a `"use server"` module may only
 * export async functions — a plain constant there is a build error — and out of
 * generationJobs.ts because that one is `server-only` and this must be readable
 * from the Build screen.
 */

/** Retry is bounded so a persistently failing project cannot be hammered. */
export const MAX_FIRST_VERSION_ATTEMPTS = 3;

/**
 * The most times a project may try at all, refunded failures included.
 *
 * `MAX_FIRST_VERSION_ATTEMPTS` counts only attempts the person was charged for,
 * so our own failures can never end a project — that is the point of it. This is
 * the other half: a refunded failure still costs a real provider request, so
 * "retry forever" is not a position either. Deliberately generous, because
 * reaching it should mean something is genuinely wrong with the idea or the
 * service rather than that someone had a bad afternoon.
 */
export const MAX_FIRST_VERSION_JOBS = 10;

export interface FirstVersionJobView {
  job: GenerationJob | null;
  /** True once a real first version exists, whatever the job history says. */
  hasOutput: boolean;
  attemptsRemaining: number;
}
