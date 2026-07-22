import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isLocale } from "@/i18n/locale";
import { sanitizeStage3Output } from "@/lib/build/stage3Types";
import { isPublicSlug } from "@/lib/publishing/slug";
import type {
  ProjectPublicationState,
  ProjectResponseItem,
  PublicProjectPublication,
} from "@/lib/publishing/types";
import { createPublicClient } from "@/lib/supabase/public";
import type { Database } from "@/types/supabase";

type Client = SupabaseClient<Database>;

function responsePayload(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const clean: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") clean[key.slice(0, 40)] = entry.slice(0, 2000);
  }
  return clean;
}

function toResponseItem(row: {
  id: string;
  payload: unknown;
  created_at: string;
}): ProjectResponseItem {
  return {
    id: row.id,
    payload: responsePayload(row.payload),
    createdAt: row.created_at,
  };
}

export async function loadProjectPublicationState(
  supabase: Client,
  projectId: string,
  userId: string,
): Promise<ProjectPublicationState | null> {
  const { data: publication } = await supabase
    .from("project_publications")
    .select("slug, locale, output, is_published, published_at, updated_at")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!publication || !isLocale(publication.locale)) return null;
  const output = sanitizeStage3Output(publication.output);
  if (!output) return null;

  const [{ count }, { data: recent }] = await Promise.all([
    supabase
      .from("project_responses")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("user_id", userId),
    supabase
      .from("project_responses")
      .select("id, payload, created_at")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  return {
    slug: publication.slug,
    locale: publication.locale,
    output,
    isPublished: publication.is_published,
    publishedAt: publication.published_at,
    updatedAt: publication.updated_at,
    responseCount: count ?? 0,
    recentResponses: (recent ?? []).map(toResponseItem),
  };
}

export interface ProjectPublicationSummary {
  slug: string;
  isPublished: boolean;
  responseCount: number;
}

export async function loadProjectPublicationSummaries(
  supabase: Client,
  userId: string,
): Promise<Map<string, ProjectPublicationSummary>> {
  const { data: publications } = await supabase
    .from("project_publications")
    .select("project_id, slug, is_published")
    .eq("user_id", userId);
  const counts = new Map<string, number>();
  await Promise.all((publications ?? []).map(async (publication) => {
    const { count } = await supabase
      .from("project_responses")
      .select("id", { count: "exact", head: true })
      .eq("project_id", publication.project_id)
      .eq("user_id", userId);
    counts.set(publication.project_id, count ?? 0);
  }));

  return new Map((publications ?? []).map((publication) => [
    publication.project_id,
    {
      slug: publication.slug,
      isPublished: publication.is_published,
      responseCount: counts.get(publication.project_id) ?? 0,
    },
  ]));
}

async function readPublicProject(slug: string): Promise<PublicProjectPublication | null> {
  if (!isPublicSlug(slug)) return null;
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .rpc("get_public_project", { p_slug: slug })
    .maybeSingle();

  // A missing row is a cacheable public 404. A transport/database failure is
  // not: throw so an outage cannot make a live project look unpublished for
  // the full cache window.
  if (error) throw new Error("Public project lookup failed.");
  if (!data || !isLocale(data.locale)) return null;
  const output = sanitizeStage3Output(data.output);
  if (!output) return null;

  return {
    slug: data.slug,
    locale: data.locale,
    output,
    publishedAt: data.published_at,
    updatedAt: data.updated_at,
  };
}

export function publicProjectCacheTag(slug: string): string {
  return `public-project:${slug}`;
}

async function readCachedPublicProject(slug: string): Promise<PublicProjectPublication | null> {
  if (!isPublicSlug(slug)) return null;
  return unstable_cache(
    () => readPublicProject(slug),
    ["public-project", slug],
    { revalidate: 3600, tags: [publicProjectCacheTag(slug)] },
  )();
}

export const getPublicProject = cache(readCachedPublicProject);
export const getUncachedPublicProject = readPublicProject;
