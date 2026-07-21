"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  FILE_MAX_BYTES,
  FILE_MIME_ALLOWLIST,
  IMAGE_MAX_BYTES,
  IMAGE_MIME_ALLOWLIST,
  PROOF_DESCRIPTION_MAX,
  PROOF_TITLE_MAX,
  PROOF_URL_MAX,
  isProofType,
  isSafeHttpUrl,
  sanitizeFileName,
  type ProofItem,
  type ProofType,
} from "@/lib/build/proofTypes";

const BUCKET = "project-proofs";
const SIGNED_URL_TTL = 60 * 60; // 1 hour

type Client = SupabaseClient<Database>;
type ProofRow = Database["public"]["Tables"]["project_proofs"]["Row"];

// A cheap count for the workspace header. Resilient: returns 0 when the proofs
// table hasn't been migrated yet (or on any error) so the header still renders.
export async function getProofCount(supabase: Client, projectId: string): Promise<number> {
  const { count, error } = await supabase
    .from("project_proofs")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);
  if (error) return 0;
  return count ?? 0;
}

async function toProofItem(supabase: Client, row: ProofRow): Promise<ProofItem> {
  let fileUrl: string | null = null;
  if (row.file_path && (row.type === "image" || row.type === "file")) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(row.file_path, SIGNED_URL_TTL);
    fileUrl = data?.signedUrl ?? null;
  }
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    taskId: row.task_id,
    stage: row.stage,
    createdAt: row.created_at,
    linkUrl: row.type === "url" ? row.url : null,
    fileUrl,
  };
}

export interface LoadProofsResult {
  /** false when the proofs table/bucket isn't reachable yet. */
  available: boolean;
  proofs: ProofItem[];
}

// Lazily loads a project's proofs (with fresh signed URLs). Loaded on demand so
// the workspace never pulls the full proof history until the user opens it.
export async function loadProofs(projectId: string): Promise<LoadProofsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { available: false, proofs: [] };

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!project) return { available: false, proofs: [] };

  const { data, error } = await supabase
    .from("project_proofs")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return { available: false, proofs: [] };

  const proofs = await Promise.all((data ?? []).map((row) => toProofItem(supabase, row)));
  return { available: true, proofs };
}

export interface AddProofResult {
  error: string | null;
  proof: ProofItem | null;
}

/**
 * Adds one proof to a project (and optionally a task/stage). Handles all four
 * types; for image/file it validates size + MIME against an allowlist,
 * sanitizes the filename, and uploads to a private per-user folder in the
 * project-proofs bucket. All ownership checks happen server-side and user_id is
 * taken from the session — never from the client. Degrades gracefully when the
 * table/bucket hasn't been migrated yet.
 */
export async function addProof(formData: FormData): Promise<AddProofResult> {
  const t = await getTranslations("build");
  const fail = (msg: string): AddProofResult => ({ error: msg, proof: null });

  const projectId = String(formData.get("projectId") ?? "");
  const type = String(formData.get("type") ?? "");
  const title = String(formData.get("title") ?? "").trim().slice(0, PROOF_TITLE_MAX);
  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const description = descriptionRaw ? descriptionRaw.slice(0, PROOF_DESCRIPTION_MAX) : null;
  const urlRaw = String(formData.get("url") ?? "").trim();
  const taskIdRaw = String(formData.get("taskId") ?? "").trim();
  const stageRaw = String(formData.get("stage") ?? "").trim();
  const taskId = taskIdRaw.length > 0 ? taskIdRaw : null;
  const stage = stageRaw.length > 0 ? stageRaw : null;

  if (!isProofType(type)) return fail(t("errorInvalidInput"));
  if (title.length === 0) return fail(t("proofErrorTitleRequired"));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(t("errorSession"));

  // Verify the project (and task, if given) belong to the caller before any
  // storage work. RLS enforces this again on insert.
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!project) return fail(t("errorProjectNotFound"));

  if (taskId) {
    const { data: task } = await supabase
      .from("project_tasks")
      .select("id")
      .eq("id", taskId)
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!task) return fail(t("errorTaskNotFound"));
  }

  let url: string | null = null;
  let filePath: string | null = null;

  if (type === "url") {
    if (!isSafeHttpUrl(urlRaw) || urlRaw.length > PROOF_URL_MAX) {
      return fail(t("proofErrorInvalidUrl"));
    }
    url = urlRaw;
  } else if (type === "image" || type === "file") {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return fail(t("proofErrorFileRequired"));
    }
    const maxBytes = type === "image" ? IMAGE_MAX_BYTES : FILE_MAX_BYTES;
    const allowlist = type === "image" ? IMAGE_MIME_ALLOWLIST : FILE_MIME_ALLOWLIST;
    if (file.size > maxBytes) return fail(t("proofErrorFileTooLarge"));
    if (!allowlist.includes(file.type)) return fail(t("proofErrorFileType"));

    const safeName = sanitizeFileName(file.name);
    const path = `${user.id}/${projectId}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) return fail(t("proofErrorUploadFailed"));
    filePath = path;
  }
  // type === "note": nothing extra; title (+ optional description) is enough.

  const { data: inserted, error: insertError } = await supabase
    .from("project_proofs")
    .insert({
      project_id: projectId,
      task_id: taskId,
      user_id: user.id,
      type: type as ProofType,
      title,
      description,
      url,
      file_path: filePath,
      stage,
    })
    .select("*")
    .single();

  if (insertError || !inserted) {
    // Roll back an orphaned upload so a failed insert doesn't leak a file.
    if (filePath) await supabase.storage.from(BUCKET).remove([filePath]);
    return fail(t("proofErrorSaveFailed"));
  }

  revalidatePath("/build/workspace");
  return { error: null, proof: await toProofItem(supabase, inserted) };
}

export interface DeleteProofResult {
  error: string | null;
}

// Deletes a proof the caller owns, removing any uploaded file first.
export async function deleteProof(proofId: string): Promise<DeleteProofResult> {
  const t = await getTranslations("build");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("errorSession") };

  const { data: proof } = await supabase
    .from("project_proofs")
    .select("id, file_path")
    .eq("id", proofId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!proof) return { error: t("proofErrorNotFound") };

  if (proof.file_path) {
    await supabase.storage.from(BUCKET).remove([proof.file_path]);
  }

  const { error } = await supabase
    .from("project_proofs")
    .delete()
    .eq("id", proofId)
    .eq("user_id", user.id);
  if (error) return { error: t("proofErrorSaveFailed") };

  revalidatePath("/build/workspace");
  return { error: null };
}
