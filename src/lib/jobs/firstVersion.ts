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

export interface FirstVersionJobView {
  job: GenerationJob | null;
  /** True once a real first version exists, whatever the job history says. */
  hasOutput: boolean;
  attemptsRemaining: number;
}
