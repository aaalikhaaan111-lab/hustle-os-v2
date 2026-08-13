/**
 * The free-tier limits, and when they refill.
 *
 * Kept out of usage.ts because that module is `server-only`, which throws the
 * moment anything outside a server bundle touches it — including a test. The
 * arithmetic here is pure and worth testing directly; the counter movements it
 * describes stay behind the service role.
 */

/**
 * Free first-version generations per account per UTC MONTH.
 *
 * WHY THIS IS MONTHLY. It was three per day, which is up to ninety a month. A
 * generation costs roughly $0.35 in provider spend, so one free account sitting
 * on the cap could spend about $32 a month — more than a paying subscriber
 * pays. The daily refill was written for a free tier whose cost was
 * conversation; it does not survive a free tier whose cost is inference.
 *
 * Three a month is the same number a person sees on their first day, and the
 * bound the business can actually carry: about $1.06 per free account.
 *
 * Configurable so the number can be tuned without a deploy, and so local and
 * preview environments can raise it for testing without anyone editing
 * production rows or committing a temporary value. Read once at module load.
 *
 * Validated rather than trusted: a missing, non-numeric, zero or negative
 * value falls back to the default, and it is capped, because the failure mode
 * of a typo here is unmetered paid generation. There is no value of this
 * variable that disables metering.
 */
const DEFAULT_FREE_GENERATIONS_PER_MONTH = 3;
const MAX_FREE_GENERATIONS_PER_MONTH = 100;

function freeGenerationsPerMonth(): number {
  const raw = process.env.VENTRIO_FREE_GENERATIONS_PER_MONTH;
  if (!raw) return DEFAULT_FREE_GENERATIONS_PER_MONTH;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_FREE_GENERATIONS_PER_MONTH;
  return Math.min(parsed, MAX_FREE_GENERATIONS_PER_MONTH);
}

// Durable, account-wide free-tier limits. Keyed by the same `metric` strings
// used in the consume_ai_usage/release_ai_usage RPCs (see
// supabase/migrations/20260723120000_add_user_ai_usage.sql) — never by
// project id, so discarding/deleting a project cannot restore quota.
export const AI_USAGE_LIMITS = {
  discovery_turn: 12,
  first_version_generation: freeGenerationsPerMonth(),
  project_edit: 5,
} as const;

export type AiUsageMetric = keyof typeof AI_USAGE_LIMITS;

export type UsagePeriod = "day" | "month" | "lifetime";

/**
 * Which metrics refill, and how often.
 *
 * Every free allowance used to be for life: one generation, twelve discovery
 * messages, five edits — ever. Each was enforced and refunded correctly; the
 * defect was permanence. An account that used its twelve discovery turns could
 * never start another creation conversation, so raising only the generation
 * limit would have moved the wall rather than removed it. That was found by
 * running the flow: "Реши сам и начинай." came back with "you have reached the
 * free message limit (12) for this conversation" on an account that still had
 * generations left.
 *
 * They then all became daily, which is right for the two that cost a
 * conversation and wrong for the one that costs a generation — see the note on
 * the monthly allowance above. So the period is per metric now: talking to
 * Ventrio refills every day, and having it build something refills every month.
 */
const USAGE_PERIOD: Record<AiUsageMetric, UsagePeriod> = {
  discovery_turn: "day",
  first_version_generation: "month",
  project_edit: "day",
};

/**
 * The ledger key a metric writes to.
 *
 * A daily allowance is expressed as a new key each UTC day, which is the
 * pattern this table was built for — `metric` is free-form text and already
 * carries composite keys elsewhere. Yesterday's row simply stops being read.
 * Chosen over a schema change deliberately: the counter functions are
 * service-role RPCs that fail closed, so shipping code that expects a
 * migration nobody has applied yet would block generation for everyone.
 *
 * `at` exists so a refund can be posted against the day the reservation was
 * actually taken from — see releaseUsage. Without it, a job that failed just
 * after midnight would credit today for a unit it took yesterday.
 */
export function usageKeyFor(metric: AiUsageMetric, at: Date = new Date()): string {
  const period = USAGE_PERIOD[metric];
  if (period === "lifetime") return metric;
  // `YYYY-MM-DD` for a day, `YYYY-MM` for a month. The two can never collide:
  // a monthly key is a strict prefix of a daily one and is ten characters
  // shorter, so yesterday's daily row and this month's monthly row are
  // different keys even for the same metric.
  return `${metric}:${at.toISOString().slice(0, period === "day" ? 10 : 7)}`;
}

/**
 * How this metric's allowance refills.
 *
 * Exported because the database needs it too: the stale sweep composes one
 * refund key per job from that job's own `usage_reserved_at`, so it has to be
 * told the granularity rather than assume a day. See
 * `usage_key_for_job(p_metric, p_metric_period, p_reserved_at)`.
 */
export function usagePeriodFor(metric: AiUsageMetric): UsagePeriod {
  return USAGE_PERIOD[metric];
}

/** True when this metric's allowance refills rather than running out for good. */
export function isDailyMetric(metric: AiUsageMetric): boolean {
  return USAGE_PERIOD[metric] === "day";
}

// The structured "you're out of free X" state every quota-enforced action
// returns instead of a generic AI error, so the UI can render calm, specific
// copy rather than routing it through the normal error/retry path.
export interface LimitReachedInfo {
  metric: AiUsageMetric;
  used: number;
  limit: number;
}
