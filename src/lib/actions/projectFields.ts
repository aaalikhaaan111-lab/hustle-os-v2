"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { isStructuredField, parseSnapshotFields, type StructuredField } from "@/lib/build/snapshot";

const STRUCTURED_VALUE_MAX_LENGTH = 500;

export interface SaveStructuredFieldResult {
  error: string | null;
  saved: { field: StructuredField; value: string } | null;
}

/**
 * Persists one confirmed answer from the conversation onto the project.
 *
 * When the assistant and the person agree on something worth keeping — who this
 * is for, what it does — that agreement is written here rather than left in the
 * transcript, so the next screen and the next model call both see it.
 *
 * Three things are enforced: the field must be on the allowlist rather than an
 * arbitrary column, the project must belong to the caller, and the value is
 * trimmed and length-capped. It writes to `projects.snapshot_fields` and
 * nothing else.
 *
 * Previously lived in lib/actions/build.ts alongside the retired task,
 * pathway and pitch actions; it is the only part of that module the current
 * product still calls.
 */
export async function saveStructuredFieldAction(
  projectId: string,
  field: string,
  value: string
): Promise<SaveStructuredFieldResult> {
  const t = await getTranslations("build");

  if (!isStructuredField(field)) {
    return { error: t("errorInvalidInput"), saved: null };
  }
  const trimmed = value.trim().slice(0, STRUCTURED_VALUE_MAX_LENGTH);
  if (trimmed.length === 0) {
    return { error: t("errorAnswerTooShort"), saved: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("errorSession"), saved: null };

  const { data: project } = await supabase
    .from("projects")
    .select("id, snapshot_fields")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!project) return { error: t("errorProjectNotFound"), saved: null };

  // Merge into the existing allowlisted map; parse discards anything unknown.
  const current = parseSnapshotFields(project.snapshot_fields);
  const next = { ...current, [field]: trimmed };

  const { error } = await supabase
    .from("projects")
    .update({ snapshot_fields: next })
    .eq("id", projectId)
    .eq("user_id", user.id);

  if (error) {
    return { error: t("errorSaveUnavailable"), saved: null };
  }

  revalidatePath(`/projects/${projectId}`);
  return { error: null, saved: { field, value: trimmed } };
}
