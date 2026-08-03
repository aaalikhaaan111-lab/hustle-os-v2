import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { AI_USAGE_LIMITS, type AiUsageMetric } from "@/lib/ai/usage";
import type { Database } from "@/types/supabase";

/**
 * The single place the workspace reads usage from.
 *
 * Product units, not plumbing: the workspace never shows tokens, model names or
 * API cost. Three of the four counters below are backed by the real
 * `user_ai_usage` ledger and the same `AI_USAGE_LIMITS` the server enforces, so
 * what the popover shows is what the next action will actually be allowed to do.
 *
 * `trackedSessions` has no ledger yet — visitor tracking is not built — so it is
 * reported as unavailable rather than as a zero that looks like real data. When
 * the tracking ledger lands, fill it in here and nothing else has to change.
 */
export interface UsageCounter {
  used: number;
  limit: number;
  /** False when nothing records this yet; the UI says so instead of showing 0. */
  available: boolean;
}

export interface WorkspaceUsage {
  projectBuilds: UsageCounter;
  aiChanges: UsageCounter;
  evolutionCredits: UsageCounter;
  trackedSessions: UsageCounter;
}

/** Which real ledger metric backs each product-facing counter. */
const BACKED_BY: Record<"projectBuilds" | "aiChanges" | "evolutionCredits", AiUsageMetric> = {
  projectBuilds: "first_version_generation",
  aiChanges: "project_edit",
  evolutionCredits: "discovery_turn",
};

const unavailable = (limit: number): UsageCounter => ({ used: 0, limit, available: false });

export function emptyWorkspaceUsage(): WorkspaceUsage {
  return {
    projectBuilds: unavailable(AI_USAGE_LIMITS.first_version_generation),
    aiChanges: unavailable(AI_USAGE_LIMITS.project_edit),
    evolutionCredits: unavailable(AI_USAGE_LIMITS.discovery_turn),
    trackedSessions: unavailable(0),
  };
}

/**
 * Reads the caller's own usage rows. RLS scopes `user_ai_usage` to the signed-in
 * user, so this takes the request-scoped client rather than the service role.
 */
export async function loadWorkspaceUsage(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<WorkspaceUsage> {
  const usage = emptyWorkspaceUsage();

  const { data, error } = await supabase
    .from("user_ai_usage")
    .select("metric, used")
    .eq("user_id", userId);

  if (error || !data) {
    // A failed read is not the same as "you have used nothing" — leave the
    // counters marked unavailable so the popover stays honest.
    return usage;
  }

  const byMetric = new Map(data.map((row) => [row.metric, row.used ?? 0]));

  for (const [key, metric] of Object.entries(BACKED_BY) as [keyof typeof BACKED_BY, AiUsageMetric][]) {
    usage[key] = {
      used: byMetric.get(metric) ?? 0,
      limit: AI_USAGE_LIMITS[metric],
      available: true,
    };
  }

  return usage;
}
