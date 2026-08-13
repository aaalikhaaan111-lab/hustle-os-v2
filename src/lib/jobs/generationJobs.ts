import "server-only";

import { createServiceClient } from "@/lib/supabase/public";
import { AI_USAGE_LIMITS, usagePeriodFor, usageKeyFor, type AiUsageMetric, type UsageReservation } from "@/lib/ai/usage";

/**
 * Durable state for long-running AI generation.
 *
 * WHAT THIS DOES AND DOES NOT GUARANTEE — read before extending.
 *
 * The row is durable. The *execution* is not. Generation runs inside the same
 * server action that creates the job, because the deployment has no worker, no
 * queue and no background runtime, and adding one for a single operation would
 * be far more machinery than the problem deserves. If that request is killed —
 * a serverless timeout, a deploy, a lost connection — the model call dies with
 * it and the row is left saying `running` forever.
 *
 * That is what `heartbeat_at` is for. Every real stage boundary writes one, so
 * a job that has stopped breathing can be told apart from one that is merely
 * slow, marked failed, and offered as a retry. It means the interface can
 * always answer "is this still happening?" honestly, which is the actual
 * requirement — not that the work survives, but that the person is never left
 * watching a spinner that will never resolve.
 *
 * The same reasoning applies to quota. A crash skips every catch block, so a
 * reservation held only in this request's memory would be lost with it — which
 * is why `usage_reserved_at` and `usage_released_at` live on the job row and
 * every transition goes through a database function. See
 * supabase/migrations/*_add_generation_job_usage_accounting.sql.
 *
 * Writes use the service client deliberately: `generation_jobs` has a SELECT
 * policy and nothing else, so no client can create a job, mark one succeeded,
 * rewrite an error or reset an attempt count.
 */

/** Real code boundaries, not a timed performance. */
export type JobStage = "queued" | "preparing" | "generating" | "saving" | "completed";

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

/** Short machine codes; the interface owns the wording shown to a person. */
export type JobErrorCode =
  | "no_direction"
  | "limit_reached"
  | "provider_unavailable"
  | "invalid_output"
  | "save_failed"
  | "stale"
  | "usage_check_failed"
  | "unknown";

/**
 * Failures that never reached the model and never held quota.
 *
 * They still get a job row — the row is how the interface explains what
 * happened — but they must not consume retry budget. Someone who is out of
 * free generations would otherwise burn all three attempts on rows that did no
 * work, and end up locked out of a project by a limit rather than by failure.
 */
const COSTLESS_ERROR_CODES: readonly string[] = ["limit_reached", "usage_check_failed"];

export interface GenerationJob {
  id: string;
  projectId: string;
  status: JobStatus;
  progressStage: JobStage | null;
  errorCode: JobErrorCode | null;
  errorMessage: string | null;
  attemptCount: number;
  startedAt: string | null;
  heartbeatAt: string | null;
  finishedAt: string | null;
  /** Set once this job holds a unit of quota; cleared by nothing. */
  usageReservedAt: string | null;
  /** Set once that unit has been given back. Never set twice. */
  usageReleasedAt: string | null;
  createdAt: string;
}

/**
 * How long a `running` job may go without a heartbeat before it is presumed
 * dead. Generation itself is one uninterrupted 30-90s model call with no
 * boundary to report from, so this has to comfortably exceed the slowest
 * realistic call — five minutes, not thirty seconds, or a slow-but-healthy
 * generation would be killed while it was still working.
 */
export const STALE_AFTER_MS = 5 * 60 * 1000;

const KIND = "first_version" as const;

type JobRow = {
  id: string;
  project_id: string;
  status: JobStatus;
  progress_stage: string | null;
  error_code: string | null;
  error_message: string | null;
  attempt_count: number;
  started_at: string | null;
  heartbeat_at: string | null;
  finished_at: string | null;
  usage_reserved_at: string | null;
  usage_released_at: string | null;
  created_at: string;
};

function present(row: JobRow): GenerationJob {
  return {
    id: row.id,
    projectId: row.project_id,
    status: row.status,
    progressStage: (row.progress_stage as JobStage | null) ?? null,
    errorCode: (row.error_code as JobErrorCode | null) ?? null,
    errorMessage: row.error_message,
    attemptCount: row.attempt_count,
    startedAt: row.started_at,
    heartbeatAt: row.heartbeat_at,
    finishedAt: row.finished_at,
    usageReservedAt: row.usage_reserved_at,
    usageReleasedAt: row.usage_released_at,
    createdAt: row.created_at,
  };
}

/** True when a running job has stopped reporting and should be given up on. */
export function isStale(job: GenerationJob, now = Date.now()): boolean {
  if (job.status !== "running" && job.status !== "queued") return false;
  const last = job.heartbeatAt ?? job.startedAt ?? job.createdAt;
  return now - new Date(last).getTime() > STALE_AFTER_MS;
}

const SELECT =
  "id, project_id, status, progress_stage, error_code, error_message, attempt_count, started_at, heartbeat_at, finished_at, usage_reserved_at, usage_released_at, created_at";

/** The most recent first-version job for a project, whatever its state. */
export async function latestJob(projectId: string, userId: string): Promise<GenerationJob | null> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("generation_jobs")
    .select(SELECT)
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("kind", KIND)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return present(data as JobRow);
}

/**
 * Every job row this project has ever had, costless ones included.
 *
 * Used only to derive a fresh `request_id`. It must count rows rather than
 * attempts, because the idempotency constraint is on the row: reusing a number
 * that a limit-reached row already took would collide and block generation
 * entirely.
 */
export async function jobCountSoFar(projectId: string, userId: string): Promise<number> {
  const service = createServiceClient();
  const { count } = await service
    .from("generation_jobs")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("kind", KIND);
  return count ?? 0;
}

/**
 * How many attempts this project has actually spent.
 *
 * THE DEFECT THIS FIXES. The cap used to count rows, so three failures ended a
 * project permanently — whatever caused them. In practice what caused them was
 * us: a function timeout, a suspended invocation, a validator that read prose
 * as a frame escape. A person who did nothing wrong lost the project, and the
 * cap is per project and permanent, so there was no way back.
 *
 * An attempt is spent when the job kept the unit of quota it reserved. That is
 * already recorded, and it is exactly the right question:
 *
 *   reserved, never released  →  it succeeded, or it failed in a way we charged
 *                                for. It counts.
 *   reserved and released     →  it was refunded. Ventrio failed, or the gate
 *                                refused the output. It does not count.
 *   never reserved            →  it never got as far as spending anything —
 *                                out of quota, or the check itself broke.
 *
 * So the guarantee is simple: if the person was not charged, the project is not
 * consumed. Uncontrolled retrying is bounded separately — see `jobsSoFar`.
 */
export async function attemptsSoFar(projectId: string, userId: string): Promise<number> {
  const service = createServiceClient();
  const { count } = await service
    .from("generation_jobs")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("kind", KIND)
    .not("usage_reserved_at", "is", null)
    .is("usage_released_at", null);
  return count ?? 0;
}

/**
 * Every attempt this project has made, refunded or not.
 *
 * The backstop `attemptsSoFar` deliberately does not provide. A refunded
 * failure costs the person nothing and should not consume their project — but
 * some refunded failures still cost a real provider request, so "retry as often
 * as you like" is not a position either. This bounds the loop without charging
 * anyone for our own faults.
 *
 * Costless rows are excluded on the same reasoning as before: a row that was
 * refused for having no quota left did no work and should not count against
 * anything.
 */
export async function jobsSoFar(projectId: string, userId: string): Promise<number> {
  const service = createServiceClient();
  const { count } = await service
    .from("generation_jobs")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("kind", KIND)
    .or(`error_code.is.null,error_code.not.in.(${COSTLESS_ERROR_CODES.join(",")})`);
  return count ?? 0;
}

/**
 * Claims the right to generate. Returns null when another job is already in
 * flight — the partial unique index makes that a database guarantee rather
 * than a hopeful check, so two simultaneous clicks cannot both proceed.
 */
export async function claimJob(
  projectId: string,
  userId: string,
  requestId: string,
  attemptCount: number
): Promise<GenerationJob | null> {
  const service = createServiceClient();
  const now = new Date().toISOString();
  const { data, error } = await service
    .from("generation_jobs")
    .insert({
      project_id: projectId,
      user_id: userId,
      kind: KIND,
      status: "running",
      request_id: requestId,
      progress_stage: "preparing",
      attempt_count: attemptCount,
      started_at: now,
      heartbeat_at: now,
    })
    .select(SELECT)
    .single();
  // 23505 is either the active-job index or an exact request replay. Both mean
  // "someone already has this"; neither is an error worth surfacing.
  if (error || !data) return null;
  return present(data as JobRow);
}

/** Records a real stage boundary and proves the request is still alive. */
export async function beat(jobId: string, stage: JobStage): Promise<void> {
  const service = createServiceClient();
  await service
    .from("generation_jobs")
    .update({ progress_stage: stage, heartbeat_at: new Date().toISOString() })
    .eq("id", jobId);
}

/**
 * Claims the right to make one provider request, at most once per phase.
 *
 * THE PROBLEM THIS SOLVES. Generation runs from a queue now, and a queue
 * delivers at least once. A redelivered message re-enters the consumer with the
 * same arguments and no memory of the first attempt, so "one generation, at
 * most one repair" cannot be a counter in the handler — it has to be state.
 *
 * `expected` is the counter's value this phase requires: 0 for the generation,
 * 1 for the repair. The database checks and increments under one row lock, so a
 * second delivery finds the counter already moved and is refused, and two
 * deliveries racing cannot both proceed. Ordering falls out of the same rule —
 * a repair cannot claim before a generation has.
 *
 * Returns false rather than throwing. A refusal is the normal outcome for a
 * duplicate and the caller's job is simply to stop, not to treat it as an error.
 */
export async function claimProviderRequest(jobId: string, expected: number): Promise<boolean> {
  const service = createServiceClient();
  const { data, error } = await service.rpc("claim_generation_provider_request", {
    p_job_id: jobId,
    p_expected: expected,
  });
  if (error) {
    console.error("[ventrio-generation-job-error]", JSON.stringify({
      operation: "claim_generation_provider_request",
      expected,
      message: error.message,
    }));
    // Fail closed. An unreachable guard must never let a paid request through.
    return false;
  }
  return data === true;
}

/**
 * What a job needs in order to be executed by something other than the request
 * that created it.
 *
 * The composed brief, the locale and the pinned model — the arguments the
 * generation was always about, which used to travel in a queue message and were
 * never written down. Nothing secret goes in here: the worker reads its own API
 * key from its own environment.
 */
export interface GenerationPayload {
  brief: string;
  locale: string;
  model: string;
}

/** Records the payload, so an external executor can find the work and run it. */
export async function savePayload(jobId: string, payload: GenerationPayload): Promise<boolean> {
  const service = createServiceClient();
  const { error } = await service
    .from("generation_jobs")
    .update({ payload: payload as unknown as never })
    .eq("id", jobId);
  if (error) {
    console.error("[ventrio-generation-job-error]", JSON.stringify({
      operation: "save_payload",
      message: error.message,
    }));
    return false;
  }
  return true;
}

export interface ClaimableJob {
  id: string;
  projectId: string;
  userId: string;
  payload: GenerationPayload;
}

/**
 * Jobs an executor may pick up, oldest first.
 *
 * Deliberately a plain read, not a claim. Selecting is not the same as owning:
 * two workers may return the same row here and exactly one will win
 * `claimProviderRequest`, which is the compare-and-swap that actually decides.
 * Keeping those separate means the claim stays the single place that has to be
 * atomic, and it is already the mechanism that bounds provider spend.
 *
 * A job whose `provider_requests` is already 1 is excluded: it has been claimed,
 * and if its executor died the stale sweep will end and refund it rather than
 * letting a second worker pay for the same generation.
 */
export async function claimableJobs(limit = 5): Promise<ClaimableJob[]> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("generation_jobs")
    .select("id, project_id, user_id, payload")
    .eq("kind", KIND)
    .in("status", ["queued", "running"])
    .eq("provider_requests", 0)
    .not("payload", "is", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error || !data) return [];

  const jobs: ClaimableJob[] = [];
  for (const row of data) {
    const payload = row.payload as unknown as Partial<GenerationPayload> | null;
    // A row whose payload is unusable is left alone rather than half-run; the
    // stale sweep ends it on the same terms as any other abandoned job.
    if (!payload || typeof payload.brief !== "string" || !payload.brief.trim()) continue;
    if (typeof payload.locale !== "string" || typeof payload.model !== "string") continue;
    jobs.push({
      id: row.id,
      projectId: row.project_id,
      userId: row.user_id,
      payload: { brief: payload.brief, locale: payload.locale, model: payload.model },
    });
  }
  return jobs;
}

export async function finishSucceeded(jobId: string): Promise<void> {
  const service = createServiceClient();
  const now = new Date().toISOString();
  await service
    .from("generation_jobs")
    .update({ status: "succeeded", progress_stage: "completed", heartbeat_at: now, finished_at: now })
    .eq("id", jobId);
}

export async function finishFailed(
  jobId: string,
  code: JobErrorCode,
  message: string
): Promise<void> {
  const service = createServiceClient();
  const now = new Date().toISOString();
  await service
    .from("generation_jobs")
    .update({
      status: "failed",
      error_code: code,
      error_message: message.slice(0, 2000),
      heartbeat_at: now,
      finished_at: now,
    })
    .eq("id", jobId);
}

/**
 * Reserves the one unit of quota this job will spend, recording the fact on the
 * job itself so the reservation survives the process that made it.
 *
 * This replaces a bare `consumeAiUsage` call for first-version generation. The
 * difference matters: a counter that only the running request knows about
 * cannot be refunded by anything else once that request is gone.
 */
export async function reserveUsage(
  jobId: string,
  userId: string,
  metric: AiUsageMetric
): Promise<UsageReservation> {
  const limit = AI_USAGE_LIMITS[metric];
  const service = createServiceClient();
  const { data, error } = await service.rpc("reserve_generation_job_usage", {
    p_job_id: jobId,
    p_user_id: userId,
    p_metric: usageKeyFor(metric),
    p_limit: limit,
  });
  const row = data?.[0];
  if (error || !row) {
    console.error("[ventrio-ai-usage-error]", JSON.stringify({
      operation: "reserve_generation_job_usage",
      metric,
      message: error?.message ?? "no_rows_returned",
    }));
    // Fail closed, exactly as consumeAiUsage does: a broken reservation must
    // never let an unmetered model call through.
    return { allowed: false, used: limit, limit, checkFailed: true };
  }
  if (!row.allowed) return { allowed: false, used: row.used_count, limit, checkFailed: false };
  return { allowed: true, used: row.used_count, limit };
}

/**
 * Gives back this job's unit. Safe to call more than once and safe to call for
 * a job that never reserved — the database decides whether anything is owed,
 * so no caller has to reason about it.
 */
export async function releaseUsage(jobId: string, metric: AiUsageMetric): Promise<boolean> {
  const service = createServiceClient();

  // Refund the day the unit was actually taken from, not today's.
  //
  // A daily allowance lives under a per-day key, so a job that reserved before
  // midnight and failed after it would otherwise credit the new day for a unit
  // the old one still holds — the user would gain a generation and yesterday's
  // counter would stay stuck. The reservation timestamp is on the job row, so
  // the original key can be reconstructed exactly.
  const { data: jobRow } = await service
    .from("generation_jobs")
    .select("usage_reserved_at")
    .eq("id", jobId)
    .maybeSingle();
  const reservedAt = jobRow?.usage_reserved_at ? new Date(jobRow.usage_reserved_at) : new Date();

  const { data, error } = await service.rpc("release_generation_job_usage", {
    p_job_id: jobId,
    p_metric: usageKeyFor(metric, reservedAt),
  });
  if (error) {
    console.error("[ventrio-ai-usage-error]", JSON.stringify({
      operation: "release_generation_job_usage",
      metric,
      message: error.message,
    }));
    return false;
  }
  return data === true;
}

/**
 * The same recovery, across every project this user owns.
 *
 * Quota is account-wide, so dead holds have to be cleared account-wide: a crash
 * while generating project A would otherwise keep the user blocked on project
 * B, curable only by reopening a project they had no reason to revisit. Call
 * this before the limit is read, never after — the point is that the counter
 * the reservation sees has already had dead holds removed from it.
 *
 * Returns how many jobs were ended, which is not the same as how many refunds
 * happened: a job that crashed before reserving is still ended, because leaving
 * it `running` would block the account's next generation outright, but it gets
 * no refund because it holds nothing.
 */
export async function expireStaleForUser(
  userId: string,
  metric: AiUsageMetric = "first_version_generation"
): Promise<number> {
  const service = createServiceClient();
  const cutoff = new Date(Date.now() - STALE_AFTER_MS).toISOString();
  // The base metric, not a resolved key: the sweep composes one key per job
  // from that job's own `usage_reserved_at`, so a hold taken yesterday is
  // refunded to yesterday. Passing a single resolved key here was only ever
  // approximately right, and passing a key at all is what broke the sweep below.
  const { data, error } = await service.rpc("expire_stale_generation_jobs_for_user", {
    p_user_id: userId,
    p_kind: KIND,
    p_metric: metric,
    p_metric_period: usagePeriodFor(metric),
    p_cutoff: cutoff,
  });
  if (error) {
    console.error("[ventrio-ai-usage-error]", JSON.stringify({
      operation: "expire_stale_generation_jobs_for_user",
      metric,
      message: error.message,
    }));
    return 0;
  }
  return data ?? 0;
}

/**
 * Marks abandoned jobs failed and refunds what they were holding, in one
 * transaction. Scoped to a single project, with the heartbeat cutoff re-checked
 * under the row lock, so a slow-but-healthy generation is never closed out.
 *
 * This is the read path's version: opening a project resolves that project's
 * own dead job so the screen never shows a spinner nobody will answer. The
 * account-wide sweep above is what runs before quota is spent.
 */
export async function expireStale(
  projectId: string,
  userId: string,
  metric: AiUsageMetric = "first_version_generation"
): Promise<boolean> {
  const service = createServiceClient();
  const cutoff = new Date(Date.now() - STALE_AFTER_MS).toISOString();
  /**
   * THE DEFECT THIS FIXES, observed in production on 2026-08-11.
   *
   * A daily allowance is enforced under a per-day key —
   * `first_version_generation:2026-08-11` — which is what `reserveUsage`
   * charges. This call passed the bare metric name instead, so the sweep
   * refunded a key nothing reserves. The production generation that was killed
   * by the function timeout came back with its day key still charged and a
   * legacy lifetime row decremented instead: the person lost a generation to a
   * failure that was not theirs, and the counter that governs them never moved.
   *
   * The key is now composed per job from that job's own reservation timestamp,
   * inside the transaction that ends it.
   */
  const { data, error } = await service.rpc("expire_stale_generation_jobs", {
    p_project_id: projectId,
    p_user_id: userId,
    p_kind: KIND,
    p_metric: metric,
    p_metric_period: usagePeriodFor(metric),
    p_cutoff: cutoff,
  });
  if (error) {
    console.error("[ventrio-ai-usage-error]", JSON.stringify({
      operation: "expire_stale_generation_jobs",
      metric,
      message: error.message,
    }));
    return false;
  }
  return (data ?? 0) > 0;
}
