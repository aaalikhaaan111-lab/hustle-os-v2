/**
 * The refund a failed generation is owed.
 *
 *   npx tsx scripts/quota-release.test.mts
 *
 * THE PRODUCTION CASE THIS REPRODUCES. On 2026-08-11 a first-version
 * generation was killed by the platform's 300 s function ceiling. The stale
 * sweep ended the job and released its unit — against the wrong key:
 *
 *   first_version_generation              5 -> 4    a legacy row nothing reads
 *   first_version_generation:2026-08-11   1 -> 1    the row that gates the user
 *
 * The person lost a generation to a failure that was not theirs. The limit is
 * enforced per UTC day, `reserveUsage` charges the day key, and both sweeps
 * were handed something else — the bare metric name in one case, today's
 * resolved key in the other.
 *
 * The counter arithmetic is Postgres and is not reachable from here, so this
 * pins the two halves that are: the key every caller composes, and the rules
 * the release obeys, modelled exactly as the migration states them and checked
 * against the migration's own text.
 *
 * Offline.
 */

import { readFileSync } from "node:fs";
import { isDailyMetric, usageKeyFor, type AiUsageMetric } from "../src/lib/ai/usageLimits";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const jobs = read("src/lib/jobs/generationJobs.ts");
const migration = read("supabase/migrations/20260811180000_fix_stale_release_daily_key.sql");
const accounting = read("supabase/migrations/20260802212000_add_generation_job_usage_accounting.sql");

/* ── 1. the callers pass a base metric, never a resolved key ─────────────── */

// This is where the defect actually lived. A sweep ends many jobs at once, so
// it cannot be handed one correct key — it has to compose one per job.
const sweepCalls = jobs.match(/rpc\("expire_stale_generation_jobs(?:_for_user)?",\s*\{[^}]*\}/g) ?? [];
check("both sweeps are called", sweepCalls.length === 2, `found ${sweepCalls.length}`);
for (const call of sweepCalls) {
  const name = /expire_stale_generation_jobs_for_user/.test(call) ? "account sweep" : "project sweep";
  check(`${name} passes the base metric, not a resolved key`,
    /p_metric:\s*metric\b/.test(call) && !/p_metric:\s*usageKeyFor/.test(call), call.slice(0, 120));
  check(`${name} says whether the metric is daily`, /p_metric_daily:\s*isDailyMetric\(metric\)/.test(call));
}

// The direct release keeps composing its key in TypeScript, from the job's own
// reservation timestamp — that path was always right and must stay that way.
check("the direct release refunds the day the unit was taken from",
  /usageKeyFor\(metric,\s*reservedAt\)/.test(jobs));
check("and reads that timestamp from the job row",
  /select\("usage_reserved_at"\)/.test(jobs));

/* ── 2. the sweep's key and the reservation's key are the same key ───────── */

check("the migration derives the key from the job's own reservation",
  /usage_key_for_job\(p_metric,\s*p_metric_daily,\s*v_job\.usage_reserved_at\)/.test(migration));
check("and neither sweep passes p_metric straight through any more",
  !/release_generation_job_usage\(\s*v_job\.id,\s*p_metric\s*\)/.test(migration));
check("both sweeps were rewritten, not just one",
  (migration.match(/usage_key_for_job\(p_metric/g) ?? []).length === 2);
// The old signatures are dropped so an un-updated caller fails loudly rather
// than silently refunding the wrong key again — which is how this survived.
check("the four-argument project sweep is dropped",
  /drop function if exists public\.expire_stale_generation_jobs\(uuid, uuid, text, timestamptz, text\)/.test(migration));
check("the four-argument account sweep is dropped",
  /drop function if exists public\.expire_stale_generation_jobs_for_user\(uuid, text, timestamptz, text\)/.test(migration));

/**
 * The SQL and the TypeScript must agree on what a day is.
 *
 * `usageKeyFor` takes `toISOString().slice(0, 10)`, which is UTC. The migration
 * takes `to_char((reserved_at at time zone 'UTC')::date, 'YYYY-MM-DD')`. Both
 * are the UTC calendar date; a mismatch here would refund a neighbouring day
 * and be invisible except to whoever lost the generation.
 */
check("the migration composes the key in UTC",
  /to_char\(\(p_reserved_at at time zone 'UTC'\)::date, 'YYYY-MM-DD'\)/.test(migration));
check("and joins it to the metric with a colon", /p_metric \|\| ':' \|\|/.test(migration));

/** The TypeScript mirror of `usage_key_for_job`, for the model below. */
function sqlUsageKeyForJob(metric: string, daily: boolean, reservedAt: Date | null): string {
  if (!daily || reservedAt === null) return metric;
  return `${metric}:${reservedAt.toISOString().slice(0, 10)}`;
}

for (const iso of [
  "2026-08-11T15:51:08.834Z",
  "2026-08-11T00:00:00.000Z",
  "2026-08-11T23:59:59.999Z",
  "2026-01-01T00:00:00.000Z",
]) {
  const at = new Date(iso);
  check(`the sweep and the reservation agree on ${iso}`,
    sqlUsageKeyForJob("first_version_generation", true, at)
      === usageKeyFor("first_version_generation" as AiUsageMetric, at));
}

/* ── 3. the release rules, modelled as the migration states them ─────────── */

// Every guard below is quoted from release_generation_job_usage, which the new
// migration does not touch: idempotency was always its job and still is.
check("the release refuses a second refund", /if v_job\.usage_released_at is not null then return false/.test(accounting));
check("refuses to refund what was never reserved", /if v_job\.usage_reserved_at is null then return false/.test(accounting));
check("and refuses to refund work that succeeded", /if v_job\.status = 'succeeded' then return false/.test(accounting));
check("the counter never goes below zero", /greatest\(used - 1, 0\)/.test(accounting));

interface Job {
  id: string;
  status: "running" | "succeeded" | "failed";
  reservedAt: Date | null;
  releasedAt: Date | null;
}

class Ledger {
  readonly counters = new Map<string, number>();
  readonly jobs = new Map<string, Job>();

  used(key: string): number {
    return this.counters.get(key) ?? 0;
  }

  /** reserve_generation_job_usage, for a daily metric. */
  reserve(jobId: string, metric: AiUsageMetric, at: Date, limit: number): boolean {
    const job = this.jobs.get(jobId)!;
    if (job.reservedAt) return true; // a replay reports the existing reservation
    const key = usageKeyFor(metric, at);
    const used = this.used(key);
    if (used >= limit) return false;
    this.counters.set(key, used + 1);
    job.reservedAt = at;
    return true;
  }

  /** release_generation_job_usage, given a key the caller composed. */
  release(jobId: string, key: string): boolean {
    const job = this.jobs.get(jobId)!;
    if (!job.reservedAt) return false;
    if (job.releasedAt) return false;
    if (job.status === "succeeded") return false;
    this.counters.set(key, Math.max(this.used(key) - 1, 0));
    job.releasedAt = new Date();
    return true;
  }

  /** expire_stale_generation_jobs*, which compose one key per job. */
  sweep(metric: AiUsageMetric): number {
    let ended = 0;
    for (const job of this.jobs.values()) {
      if (job.status !== "running") continue;
      job.status = "failed";
      this.release(job.id, sqlUsageKeyForJob(metric, isDailyMetric(metric), job.reservedAt));
      ended += 1;
    }
    return ended;
  }
}

const METRIC: AiUsageMetric = "first_version_generation";
const RESERVED_AT = new Date("2026-08-11T15:51:08.834Z");
const DAY_KEY = usageKeyFor(METRIC, RESERVED_AT);

/* the production sequence, exactly: reserve, time out, sweep */
{
  const ledger = new Ledger();
  ledger.jobs.set("j1", { id: "j1", status: "running", reservedAt: null, releasedAt: null });
  // The legacy lifetime row the broken sweep decremented. Nothing reserves it;
  // nothing may refund it either.
  ledger.counters.set("first_version_generation", 5);

  const before = ledger.used(DAY_KEY);
  check("nothing is charged before the attempt", before === 0);

  check("the reservation is allowed", ledger.reserve("j1", METRIC, RESERVED_AT, 5));
  check("and charges the day key", ledger.used(DAY_KEY) === before + 1);

  check("the sweep ends the timed-out job", ledger.sweep(METRIC) === 1);
  check("the day key returns to its previous value", ledger.used(DAY_KEY) === before,
    `${ledger.used(DAY_KEY)} vs ${before}`);
  // The regression in one line: this is what moved instead, last time.
  check("and the legacy lifetime row is untouched", ledger.used("first_version_generation") === 5,
    String(ledger.used("first_version_generation")));
}

/* a repeated release must not decrement twice */
{
  const ledger = new Ledger();
  ledger.jobs.set("j1", { id: "j1", status: "running", reservedAt: null, releasedAt: null });
  ledger.reserve("j1", METRIC, RESERVED_AT, 5);
  const charged = ledger.used(DAY_KEY);

  ledger.sweep(METRIC);
  const afterFirst = ledger.used(DAY_KEY);
  check("the first release refunds", afterFirst === charged - 1);

  // Every way a second refund can be attempted: another sweep, and the direct
  // release the failure handler calls.
  ledger.jobs.get("j1")!.status = "running";
  ledger.sweep(METRIC);
  check("a second sweep refunds nothing", ledger.used(DAY_KEY) === afterFirst);
  check("and the direct release reports it did nothing",
    ledger.release("j1", usageKeyFor(METRIC, RESERVED_AT)) === false);
  check("the counter is still where it was", ledger.used(DAY_KEY) === afterFirst);
}

/* an explicit failure releases the same key a sweep would */
{
  const ledger = new Ledger();
  ledger.jobs.set("j1", { id: "j1", status: "running", reservedAt: null, releasedAt: null });
  ledger.reserve("j1", METRIC, RESERVED_AT, 5);
  ledger.jobs.get("j1")!.status = "failed";
  check("the failure handler refunds the reservation's own day",
    ledger.release("j1", usageKeyFor(METRIC, RESERVED_AT)));
  check("leaving nothing charged", ledger.used(DAY_KEY) === 0);
}

/* a job that crossed midnight is refunded to the day it took from */
{
  const ledger = new Ledger();
  ledger.jobs.set("j1", { id: "j1", status: "running", reservedAt: null, releasedAt: null });
  const lateAt = new Date("2026-08-11T23:58:00.000Z");
  ledger.reserve("j1", METRIC, lateAt, 5);
  const yesterday = usageKeyFor(METRIC, lateAt);
  const today = usageKeyFor(METRIC, new Date("2026-08-12T00:03:00.000Z"));
  check("the two days are different keys", yesterday !== today);

  ledger.sweep(METRIC);
  check("yesterday is refunded", ledger.used(yesterday) === 0);
  check("and today was never credited", ledger.used(today) === 0);
}

/* a successful job keeps its unit */
{
  const ledger = new Ledger();
  ledger.jobs.set("j1", { id: "j1", status: "running", reservedAt: null, releasedAt: null });
  ledger.reserve("j1", METRIC, RESERVED_AT, 5);
  ledger.jobs.get("j1")!.status = "succeeded";
  check("a succeeded job is not refunded", ledger.release("j1", DAY_KEY) === false);
  check("and its unit stays spent", ledger.used(DAY_KEY) === 1);
}

/* a job that never reserved is ended but not credited */
{
  const ledger = new Ledger();
  ledger.jobs.set("j1", { id: "j1", status: "running", reservedAt: null, releasedAt: null });
  check("the sweep still ends it", ledger.sweep(METRIC) === 1);
  check("and credits nothing", ledger.used(DAY_KEY) === 0);
}

/* ── report ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`FAILED ${failures.length} of ${passed + failures.length}`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`quota release: ${passed} checks passed`);
