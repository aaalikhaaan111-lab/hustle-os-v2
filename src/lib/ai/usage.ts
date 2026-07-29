import "server-only";

import { createServiceClient } from "@/lib/supabase/public";

// Durable, account-wide free-tier limits. Keyed by the same `metric` strings
// used in the consume_ai_usage/release_ai_usage RPCs (see
// supabase/migrations/20260723120000_add_user_ai_usage.sql) — never by
// project id, so discarding/deleting a project cannot restore quota.
export const AI_USAGE_LIMITS = {
  discovery_turn: 12,
  first_version_generation: 1,
  project_edit: 5,
} as const;

export type AiUsageMetric = keyof typeof AI_USAGE_LIMITS;

// The structured "you're out of free X" state every quota-enforced action
// returns instead of a generic AI error, so the UI can render calm, specific
// copy rather than routing it through the normal error/retry path.
export interface LimitReachedInfo {
  metric: AiUsageMetric;
  used: number;
  limit: number;
}

export type UsageReservation =
  | { allowed: true; used: number; limit: number }
  // `checkFailed` distinguishes an infra hiccup (RPC errored/unreachable)
  // from a genuine limit-reached state, so callers don't show "you're out of
  // free generations" for what's actually a transient Supabase problem.
  | { allowed: false; used: number; limit: number; checkFailed: boolean };

/**
 * Atomically checks and reserves one unit of `metric` for `userId` against
 * `AI_USAGE_LIMITS[metric]`. Always uses the service-role client — this
 * table has no client-writable grant, and the RPC itself is
 * service-role-only, so this is the only code path that can move the
 * counter. Call this AFTER any existing per-request idempotency check
 * (e.g. `lastRequestId` / cached-output short-circuits) and BEFORE the
 * Anthropic call, so a replayed request never reaches this a second time
 * and a rejected request never touches the model.
 */
export async function consumeAiUsage(userId: string, metric: AiUsageMetric): Promise<UsageReservation> {
  const limit = AI_USAGE_LIMITS[metric];
  const service = createServiceClient();
  const { data, error } = await service.rpc("consume_ai_usage", {
    p_user_id: userId,
    p_metric: metric,
    p_limit: limit,
  });
  const row = data?.[0];
  if (error || !row) {
    console.error("[ventrio-ai-usage-error]", JSON.stringify({
      operation: "consume_ai_usage",
      metric,
      message: error?.message ?? "no_rows_returned",
    }));
    // Fail closed: if the quota check itself is broken, don't let a paid AI
    // call through unmetered.
    return { allowed: false, used: limit, limit, checkFailed: true };
  }
  if (!row.allowed) return { allowed: false, used: row.used_count, limit, checkFailed: false };
  return { allowed: true, used: row.used_count, limit };
}

/**
 * Compensating release for a reservation whose AI call then failed, errored,
 * or produced output that didn't pass validation/sanitization/save — call
 * from every failure branch after a successful `consumeAiUsage` reservation,
 * so a genuinely failed attempt never permanently costs the user their quota.
 * Best-effort: a failure here is logged, never thrown, so it can't mask the
 * original AI/save error the caller is already handling.
 */
export async function releaseAiUsage(userId: string, metric: AiUsageMetric): Promise<void> {
  const service = createServiceClient();
  const { error } = await service.rpc("release_ai_usage", { p_user_id: userId, p_metric: metric });
  if (error) {
    console.error("[ventrio-ai-usage-error]", JSON.stringify({
      operation: "release_ai_usage",
      metric,
      message: error.message,
    }));
  }
}
