import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Stage3ProjectOutput } from "@/lib/build/stage3Types";
import { sanitizeStage3Output } from "@/lib/build/stage3Types";
import { responseFingerprint } from "@/lib/feedback/queries";
import { sanitizeFeedbackAnalysis } from "@/lib/feedback/types";
import type { Database } from "@/types/supabase";

interface ResponseRow {
  payload: unknown;
  created_at: string;
}

function payloadRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
      .map(([key, entry]) => [key, entry.trim().slice(0, 600)]),
  );
}

function redactPersonalData(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email removed]")
    .replace(/(?:\+?\d[\d ().-]{7,}\d)/g, "[phone removed]")
    .replace(/(?:^|\s)@[a-z0-9_]{3,32}\b/gi, " [handle removed]");
}

function isContactField(id: string, label: string, type: string): boolean {
  if (type === "email") return true;
  const value = `${id} ${label}`.toLowerCase();
  return /(name|phone|contact|email|telegram|whatsapp|имя|телефон|почт|контакт)/i.test(value);
}

export function compactResponseContext(output: Stage3ProjectOutput, rows: ResponseRow[]) {
  const safeFields = output.form.fields.filter(
    (field) => !isContactField(field.id, field.label, field.type),
  );
  const selectCounts: Record<string, Record<string, number>> = {};
  const responses = rows.slice(0, 60).map((row, index) => {
    const payload = payloadRecord(row.payload);
    const values = safeFields.flatMap((field) => {
      const value = payload[field.id];
      if (!value) return [];
      if (field.type === "select") {
        selectCounts[field.label] ??= {};
        selectCounts[field.label][value] = (selectCounts[field.label][value] ?? 0) + 1;
      }
      return [{ field: field.label, value: redactPersonalData(value) }];
    });
    return { response: index + 1, values };
  }).filter((response) => response.values.length > 0);

  return {
    formFields: safeFields.map((field) => ({
      id: field.id,
      label: field.label,
      type: field.type,
      options: field.options,
    })),
    selectCounts,
    responses,
    note: rows.length > 60
      ? "Only the 60 newest responses are included verbatim; totalResponseCount remains authoritative."
      : null,
  };
}

export function isFeedbackRequest(message: string): boolean {
  return /(feedback|responses?|responded|visitor|people\s+(say|said)|complain|cta|call to action|отклик|ответ|обратн|посетител|люд[ияи]|жалоб|кнопк|призыв)/i.test(message);
}

export async function loadFeedbackConversationContext(
  supabase: SupabaseClient<Database>,
  projectId: string,
  userId: string,
  preset: Stage3ProjectOutput["preset"],
) {
  const [{ data: publication }, { data: rows }, { count }, { data: responseIds }, { data: analysisRow }] = await Promise.all([
    supabase
      .from("project_publications")
      .select("output")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("project_responses")
      .select("payload, created_at")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("project_responses")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("user_id", userId),
    supabase
      .from("project_responses")
      .select("id")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("project_feedback_analyses")
      .select("analysis, analyzed_response_count, analyzed_response_fingerprint")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  const output = sanitizeStage3Output(publication?.output, preset);
  const totalResponseCount = count ?? 0;
  const currentFingerprint = responseFingerprint(
    (responseIds ?? []).map((row) => row.id),
    totalResponseCount,
  );
  const analysisIsCurrent = !!analysisRow?.analysis
    && analysisRow.analyzed_response_fingerprint === currentFingerprint;
  return {
    totalResponseCount,
    responses: output ? compactResponseContext(output, rows ?? []) : null,
    analysisFreshness: analysisIsCurrent ? "current" : analysisRow?.analysis ? "stale" : "none",
    newResponseCount: analysisRow?.analyzed_response_count === null
      || analysisRow?.analyzed_response_count === undefined
      ? totalResponseCount
      : Math.max(0, totalResponseCount - analysisRow.analyzed_response_count),
    latestAnalysis: analysisIsCurrent
      ? sanitizeFeedbackAnalysis(
        analysisRow.analysis,
        analysisRow.analyzed_response_count ?? totalResponseCount,
      )
      : null,
  };
}
