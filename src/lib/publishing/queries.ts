import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isLocale } from "@/i18n/locale";
import { parsePublicationPayload, publicationDescription, publicationName } from "@/lib/publishing/payload";
import { isPublicSlug } from "@/lib/publishing/slug";
import { feedbackStateFromRow } from "@/lib/feedback/queries";
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
    .select("id, slug, locale, output, is_published, published_at, updated_at")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!publication || !isLocale(publication.locale)) return null;
  // Either shape, gate re-run on the way. A publication that no longer passes
  // is treated as absent rather than served half-built.
  const payload = parsePublicationPayload(publication.output);
  if (!payload) return null;

  const [{ count }, { data: recent }, { data: responseIds }, { data: feedbackRow }] = await Promise.all([
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
      .limit(20),
    supabase
      .from("project_responses")
      .select("id")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("project_feedback_analyses")
      .select("project_id, publication_id, user_id, analysis, analyzed_response_count, analyzed_response_fingerprint, analyzed_at, analysis_started_at, created_at, updated_at")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const responseCount = count ?? 0;

  return {
    slug: publication.slug,
    locale: publication.locale,
    output: payload.kind === "output" ? payload.output : null,
    app: payload.kind === "app" ? payload.app : null,
    name: publicationName(payload),
    isPublished: publication.is_published,
    publishedAt: publication.published_at,
    updatedAt: publication.updated_at,
    responseCount,
    recentResponses: (recent ?? []).map(toResponseItem),
    feedback: feedbackStateFromRow(
      feedbackRow,
      (responseIds ?? []).map((row) => row.id),
      responseCount,
    ),
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
  const payload = parsePublicationPayload(data.output);
  if (!payload) return null;

  return {
    slug: data.slug,
    locale: data.locale,
    output: payload.kind === "output" ? payload.output : null,
    app: payload.kind === "app" ? payload.app : null,
    name: publicationName(payload),
    description: publicationDescription(payload),
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

/**
 * The only numbers Ventrio can honestly report about a published project.
 *
 * WHAT IS DELIBERATELY ABSENT. Page views, visitors and sessions. Nothing
 * anywhere in the product records a request to a public page — there is no
 * pageview table, no beacon on `/p/[slug]`, no analytics provider — so a
 * "views" figure could only ever be a number made up on the page. The analytics
 * screen used to lean on that absence by listing what Ventrio *would* watch for;
 * this returns what it can actually count instead.
 *
 * `submitter_hash` is a per-submitter hash the publish flow already writes, so
 * distinct values are a real count of distinct people who responded — not of
 * people who visited, which remains unknown and unclaimed.
 */
export interface ProjectAnalytics {
  published: boolean;
  publishedAt: string | null;
  responseCount: number;
  uniqueSubmitters: number;
  firstResponseAt: string | null;
  lastResponseAt: string | null;
  /**
   * Responses per day, oldest first, with empty days filled in.
   *
   * The rows were already being fetched with their `created_at` and then thrown
   * away in favour of four scalars — so a real series was one reduce from being
   * available, and the analytics screen was showing numbers where it could show
   * a shape. Nothing new is queried for this.
   *
   * Empty days are included deliberately: a chart that omits them draws four
   * responses on four consecutive days and three weeks apart identically.
   */
  daily: Array<{ date: string; responses: number }>;
}

export async function loadProjectAnalytics(
  supabase: Client,
  userId: string,
  projectId: string,
): Promise<ProjectAnalytics> {
  const { data: publication } = await supabase
    .from("project_publications")
    .select("is_published, published_at")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  const { data: responses } = await supabase
    .from("project_responses")
    .select("submitter_hash, created_at")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  const rows = responses ?? [];

  const perDay = new Map<string, number>();
  for (const row of rows) {
    const day = row.created_at.slice(0, 10);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }

  const daily: Array<{ date: string; responses: number }> = [];
  if (rows.length > 0) {
    const first = new Date(`${rows[0].created_at.slice(0, 10)}T00:00:00Z`);
    const last = new Date(`${rows[rows.length - 1].created_at.slice(0, 10)}T00:00:00Z`);
    // Capped so a project published a year ago does not build 365 points for a
    // handful of responses; the window is the last 30 days of activity.
    const start = new Date(Math.max(first.getTime(), last.getTime() - 29 * 86_400_000));
    for (let d = new Date(start); d <= last; d.setUTCDate(d.getUTCDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      daily.push({ date: key, responses: perDay.get(key) ?? 0 });
    }
  }

  return {
    published: Boolean(publication?.is_published),
    publishedAt: publication?.published_at ?? null,
    responseCount: rows.length,
    uniqueSubmitters: new Set(rows.map((row) => row.submitter_hash)).size,
    firstResponseAt: rows[0]?.created_at ?? null,
    lastResponseAt: rows[rows.length - 1]?.created_at ?? null,
    daily,
  };
}
