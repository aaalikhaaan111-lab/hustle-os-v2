/**
 * The generation worker.
 *
 * WHY THIS PROCESS EXISTS. Generation takes two to four minutes, and three
 * attempts to run it inside a Vercel function failed in three different ways:
 * a 300 s timeout that killed the work mid-flight; and twice an invocation that
 * simply stopped executing — heartbeats, the provider abort and the consumer's
 * own wall-clock deadline all ceasing in the same instant, with no logs, until
 * the platform reaped it. None of those is addressable from inside the
 * function, because the thing that stopped was the function.
 *
 * So the execution plane moved and nothing else did. Vercel still owns auth,
 * the intake, project creation, the job row, the quota reservation, polling,
 * the workspace, publishing and every public route. This process owns exactly
 * one sentence:
 *
 *     a job with a payload → Gemini → parse → validate → compile → persist
 *
 * WHAT IT IS NOT. Not a second job model. `generation_jobs` remains the single
 * source of truth, and this reads and advances the same rows the web app
 * created. Not a second accounting system: the quota unit was reserved by the
 * action before this ever saw the job, and the refund goes through the same
 * database function. Not a second pipeline: `runGeneratePhase` is the code the
 * queue consumer ran, imported unchanged.
 *
 * The loop is deliberately dull. Poll, claim one, run it, write the result,
 * sleep, repeat. No Redis, no second database, no sockets, no framework.
 */

import { claimableJobs, expireStaleForUser } from "../src/lib/jobs/generationJobs";
import { runGeneratePhase } from "../src/lib/v2/app/runGeneration";
import type { GenerateMessage } from "../src/lib/v2/app/generationQueue";

/** How long to wait when there was nothing to do. */
const IDLE_MS = Number(process.env.VENTRIO_WORKER_IDLE_MS ?? 5_000);
/** How long to wait after an unexpected error, so a broken loop cannot spin. */
const BACKOFF_MS = Number(process.env.VENTRIO_WORKER_BACKOFF_MS ?? 30_000);
/** How often to sweep abandoned jobs, in poll ticks. */
const SWEEP_EVERY = Number(process.env.VENTRIO_WORKER_SWEEP_EVERY ?? 12);

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GEMINI_API_KEY",
] as const;

function log(event: string, fields: Record<string, unknown> = {}): void {
  // One line per event, structured. Never a prompt, never generated source,
  // never a key — the fields below are ids, codes, counts and durations.
  console.log("[ventrio-worker]", JSON.stringify({ event, at: new Date().toISOString(), ...fields }));
}

/**
 * Fails before starting rather than at the first job.
 *
 * A worker missing its Supabase key would otherwise look healthy, poll forever,
 * find nothing, and give no indication that generations were piling up.
 */
function checkEnvironment(): void {
  const missing = REQUIRED.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    // Names only. The values are the point of the check and never printed.
    log("startup_failed", { missing });
    process.exit(1);
  }
  if (process.env.VENTRIO_APP_RUNTIME !== "1") {
    log("startup_failed", { reason: "VENTRIO_APP_RUNTIME must be 1 for the worker to execute app-runtime jobs" });
    process.exit(1);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let running = true;
let inFlight: string | null = null;

/**
 * Runs one job, if there is one. Returns whether it did any work.
 *
 * The claim is inside `runGeneratePhase`: it calls `claimProviderRequest(id, 0)`,
 * a compare-and-swap under a row lock, before it touches the provider. Two
 * workers may read the same row from `claimableJobs` and exactly one will win —
 * the loser gets `skipped` and moves on without spending anything. That is also
 * why a crash mid-job cannot be re-run: the counter is already 1, no worker can
 * claim it again, and the stale sweep ends and refunds it instead.
 */
async function processOne(): Promise<boolean> {
  const jobs = await claimableJobs();
  if (jobs.length === 0) return false;

  for (const job of jobs) {
    const message: GenerateMessage = {
      phase: "generate",
      jobId: job.id,
      projectId: job.projectId,
      userId: job.userId,
      brief: job.payload.brief,
      locale: job.payload.locale,
      model: job.payload.model,
    };

    inFlight = job.id;
    const startedAt = Date.now();
    log("job_claimed", { jobId: job.id, projectId: job.projectId, briefChars: job.payload.brief.length });

    try {
      const result = await runGeneratePhase(message);
      log("job_finished", {
        jobId: job.id,
        outcome: result.outcome,
        durationMs: Date.now() - startedAt,
        ...(result.outcome === "failed"
          ? {
              code: result.code,
              issueCount: result.issues?.length ?? 0,
              // The provider's own words, bounded. `transport` alone does not
              // distinguish a refused request from a socket that died at 117s.
              detail: result.message.replace(/\s+/g, " ").slice(0, 200),
            }
          : {}),
        ...(result.outcome === "skipped" ? { reason: result.reason } : {}),
        // The gate's objections, bounded. Enough to tell one refusal from
        // another without copying a project into the log.
        ...(result.outcome === "failed" && result.issues?.length
          ? { issues: result.issues.slice(0, 4).map((issue) => issue.slice(0, 160)) }
          : {}),
      });
    } catch (error) {
      /**
       * The run threw rather than returning a failure.
       *
       * Nothing is written here on purpose. The job keeps its claim, so no other
       * worker will pay for it again, and the stale sweep ends and refunds it on
       * exactly the same terms as any abandoned job. Guessing at a status from
       * out here would be a second accounting path.
       */
      log("job_threw", {
        jobId: job.id,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? `${error.name}: ${error.message.slice(0, 200)}` : "unknown",
      });
    } finally {
      inFlight = null;
    }

    // One job per tick. A long generation should not delay the sweep or make
    // shutdown wait on a queue this process decided to drain.
    return true;
  }
  return false;
}

async function main(): Promise<void> {
  checkEnvironment();
  log("started", { idleMs: IDLE_MS, sweepEvery: SWEEP_EVERY });

  let ticks = 0;
  while (running) {
    try {
      const worked = await processOne();
      ticks += 1;

      /**
       * Recover jobs nobody will finish.
       *
       * The web app sweeps when someone opens a project or starts a generation,
       * which is the moment it matters for them. Nothing sweeps when a worker
       * dies mid-job and the person has closed the tab — so this does, on a
       * timer, using the same account-scoped function and the same refund rules.
       */
      if (ticks % SWEEP_EVERY === 0) {
        const stale = await sweepAbandoned();
        if (stale > 0) log("stale_recovered", { jobs: stale });
      }

      if (!worked) await sleep(IDLE_MS);
    } catch (error) {
      log("loop_error", {
        error: error instanceof Error ? `${error.name}: ${error.message.slice(0, 200)}` : "unknown",
      });
      await sleep(BACKOFF_MS);
    }
  }

  log("stopped", { inFlight });
}

/**
 * Sweeps abandoned jobs for every account that currently has one.
 *
 * `expireStaleForUser` is account-scoped because quota is, so the users with
 * work outstanding are read first and swept one at a time. There is no
 * all-accounts variant and this does not add one — it reuses the function the
 * web app already calls, which is what keeps the refund rules in one place.
 *
 * WHY THE STALENESS TEST BELOW IS NOT `heartbeat_at < cutoff`. That column is
 * nullable, and in SQL `null < anything` is null, not true — so a row with no
 * heartbeat is invisible to that filter. Every other place that answers this
 * question falls back through the timestamps that are never null:
 * `expire_stale_generation_jobs_for_user` uses
 * `coalesce(heartbeat_at, started_at, created_at)`, and `isStale` in
 * generationJobs.ts does the same. This query was the only one that did not,
 * which meant the worker could pass over exactly the jobs the function it calls
 * would have ended.
 *
 * No such row exists today: `claimJob` is the only insert and it always writes
 * a heartbeat. So this is a latent disagreement rather than a live defect — but
 * the whole point of this sweep is to be the thing that notices when something
 * has gone wrong in a way nobody predicted, and a candidate query that is
 * narrower than the function it feeds cannot do that job.
 *
 * Being over-inclusive here is free: the function re-checks the cutoff under a
 * row lock and is the authority on what actually gets ended.
 */
async function sweepAbandoned(): Promise<number> {
  const { createServiceClient } = await import("../src/lib/supabase/public");
  const service = createServiceClient();
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data } = await service
    .from("generation_jobs")
    .select("user_id")
    .eq("kind", "first_version")
    .in("status", ["queued", "running"])
    .or(
      `heartbeat_at.lt.${cutoff},`
      + `and(heartbeat_at.is.null,started_at.lt.${cutoff}),`
      + `and(heartbeat_at.is.null,started_at.is.null,created_at.lt.${cutoff})`,
    )
    .limit(50);

  const users = [...new Set((data ?? []).map((row) => row.user_id))];
  let ended = 0;
  for (const userId of users) ended += await expireStaleForUser(userId);
  return ended;
}

/**
 * Stop taking new work, and let the job in flight finish.
 *
 * A generation killed halfway is a job the sweep has to recover and a unit the
 * person waits five minutes to get back. Draining costs one deploy a couple of
 * minutes and costs them nothing.
 */
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    if (!running) return;
    running = false;
    log("draining", { signal, inFlight });
  });
}

void main();
