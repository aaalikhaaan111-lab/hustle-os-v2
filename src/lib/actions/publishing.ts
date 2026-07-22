"use server";

import { revalidatePath, updateTag } from "next/cache";
import { getTranslations } from "next-intl/server";
import { isLocale } from "@/i18n/locale";
import { getProjectById } from "@/lib/build/queries";
import { parseStage3ProjectState, sanitizeStage3Output } from "@/lib/build/stage3Types";
import { loadProjectPublicationState, publicProjectCacheTag } from "@/lib/publishing/queries";
import { hasUsableProjectName, slugCollisionCandidate, slugifyProjectName } from "@/lib/publishing/slug";
import type { PublicationActionResult } from "@/lib/publishing/types";
import { getSiteUrl } from "@/lib/site";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function failure(error: string): PublicationActionResult {
  return { error, publication: null, publicUrl: null, message: null };
}

async function ownedOutput(projectId: string) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) return { supabase, user: null, project: null, output: null };
  const project = await getProjectById(supabase, user.id, projectId);
  const stage3 = parseStage3ProjectState(project?.snapshot_fields);
  const output = sanitizeStage3Output(stage3?.output, stage3?.direction?.projectType);
  return { supabase, user, project, output };
}

function invalidatePublication(projectId: string, slug: string) {
  updateTag(publicProjectCacheTag(slug));
  revalidatePath(`/p/${slug}`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

async function successResult(
  projectId: string,
  slug: string,
  message: string,
): Promise<PublicationActionResult> {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) return failure(message);
  const publication = await loadProjectPublicationState(supabase, projectId, user.id);
  return {
    error: null,
    publication,
    publicUrl: `${getSiteUrl()}/p/${slug}`,
    message,
  };
}

export async function publishProjectAction(projectId: string): Promise<PublicationActionResult> {
  const t = await getTranslations("publishing");
  if (!UUID_PATTERN.test(projectId)) return failure(t("errorInvalid"));
  const { supabase, user, project, output } = await ownedOutput(projectId);
  if (!user) return failure(t("errorSession"));
  if (!project) return failure(t("errorUnauthorized"));
  if (!output) return failure(t("errorMissingOutput"));
  if (!hasUsableProjectName(output.identity.name)) return failure(t("errorNameRequired"));
  if (!isLocale(project.locale)) return failure(t("errorInvalid"));

  const { data: existing } = await supabase
    .from("project_publications")
    .select("slug, is_published")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing?.is_published) {
    return successResult(projectId, existing.slug, t("alreadyLive"));
  }

  if (existing) {
    const { error } = await supabase
      .from("project_publications")
      .update({
        output,
        locale: project.locale,
        is_published: true,
        published_at: new Date().toISOString(),
      })
      .eq("project_id", projectId)
      .eq("user_id", user.id);
    if (error) return failure(t("errorPublish"));
    invalidatePublication(projectId, existing.slug);
    return successResult(projectId, existing.slug, t("republishedSuccess"));
  }

  const baseSlug = slugifyProjectName(output.identity.name);
  let insertedSlug: string | null = null;
  for (let attempt = -1; attempt < 5; attempt += 1) {
    const slug = attempt === -1 ? baseSlug : slugCollisionCandidate(baseSlug, projectId, attempt);
    const { error } = await supabase.from("project_publications").insert({
      project_id: projectId,
      user_id: user.id,
      slug,
      locale: project.locale,
      output,
      is_published: true,
    });
    if (!error) {
      insertedSlug = slug;
      break;
    }
    if (error.code !== "23505") return failure(t("errorPublish"));
  }

  if (!insertedSlug) return failure(t("errorSlug"));
  invalidatePublication(projectId, insertedSlug);
  return successResult(projectId, insertedSlug, t("publishedSuccess"));
}

export async function updatePublishedVersionAction(projectId: string): Promise<PublicationActionResult> {
  const t = await getTranslations("publishing");
  if (!UUID_PATTERN.test(projectId)) return failure(t("errorInvalid"));
  const { supabase, user, project, output } = await ownedOutput(projectId);
  if (!user) return failure(t("errorSession"));
  if (!project) return failure(t("errorUnauthorized"));
  if (!output) return failure(t("errorMissingOutput"));
  if (!isLocale(project.locale)) return failure(t("errorInvalid"));

  const { data: publication } = await supabase
    .from("project_publications")
    .select("slug, is_published")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!publication?.is_published) return failure(t("errorNotLive"));

  const { error } = await supabase
    .from("project_publications")
    .update({ output, locale: project.locale })
    .eq("project_id", projectId)
    .eq("user_id", user.id);
  if (error) return failure(t("errorUpdate"));

  invalidatePublication(projectId, publication.slug);
  return successResult(projectId, publication.slug, t("updatedSuccess"));
}

export async function unpublishProjectAction(projectId: string): Promise<PublicationActionResult> {
  const t = await getTranslations("publishing");
  if (!UUID_PATTERN.test(projectId)) return failure(t("errorInvalid"));
  const { supabase, user, project } = await ownedOutput(projectId);
  if (!user) return failure(t("errorSession"));
  if (!project) return failure(t("errorUnauthorized"));

  const { data: publication } = await supabase
    .from("project_publications")
    .select("slug, is_published")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!publication) return failure(t("errorNotLive"));

  if (publication.is_published) {
    const { error } = await supabase
      .from("project_publications")
      .update({ is_published: false })
      .eq("project_id", projectId)
      .eq("user_id", user.id);
    if (error) return failure(t("errorUnpublish"));
  }

  invalidatePublication(projectId, publication.slug);
  return successResult(projectId, publication.slug, t("unpublishedSuccess"));
}
