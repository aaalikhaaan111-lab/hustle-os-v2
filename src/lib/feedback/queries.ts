import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { sanitizeFeedbackAnalysis, type FeedbackAnalysisState } from "@/lib/feedback/types";

type Client = SupabaseClient<Database>;
type FeedbackRow = Database["public"]["Tables"]["project_feedback_analyses"]["Row"];

const ANALYSIS_LOCK_MS = 5 * 60 * 1000;

export function responseFingerprint(responseIds: string[], responseCount: number): string {
  return createHash("sha256")
    .update(`${responseCount}\n${[...responseIds].sort().join("\n")}`)
    .digest("hex");
}

export function feedbackStateFromRow(
  row: FeedbackRow | null,
  responseIds: string[],
  responseCount: number,
): FeedbackAnalysisState {
  const fingerprint = responseFingerprint(responseIds, responseCount);
  const analysis = row?.analysis
    ? sanitizeFeedbackAnalysis(row.analysis, row.analyzed_response_count ?? responseCount)
    : null;
  const analyzedFingerprint = row?.analyzed_response_fingerprint ?? null;
  const feedbackChanged = !!analysis && analyzedFingerprint !== fingerprint;
  const analyzedResponseCount = analysis ? row?.analyzed_response_count ?? null : null;
  const analysisStarted = row?.analysis_started_at
    ? new Date(row.analysis_started_at).getTime()
    : 0;

  return {
    analysis,
    analyzedResponseCount,
    analyzedAt: analysis ? row?.analyzed_at ?? null : null,
    isCurrent: !!analysis && !feedbackChanged,
    feedbackChanged,
    newResponseCount: analyzedResponseCount === null
      ? responseCount
      : Math.max(0, responseCount - analyzedResponseCount),
    analyzing: analysisStarted > Date.now() - ANALYSIS_LOCK_MS,
  };
}

export async function loadFeedbackAnalysisState(
  supabase: Client,
  projectId: string,
  userId: string,
  responseIds: string[],
  responseCount: number,
): Promise<FeedbackAnalysisState> {
  const { data } = await supabase
    .from("project_feedback_analyses")
    .select("project_id, publication_id, user_id, analysis, analyzed_response_count, analyzed_response_fingerprint, analyzed_at, analysis_started_at, created_at, updated_at")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  return feedbackStateFromRow(data, responseIds, responseCount);
}

export async function loadResponseIds(
  supabase: Client,
  projectId: string,
  userId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("project_responses")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1000);
  return (data ?? []).map((row) => row.id);
}
