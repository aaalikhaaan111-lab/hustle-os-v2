import type { PreviewSpec, ProjectState } from "@/components/workspace-ui/parts";
import { parseSnapshotFields } from "@/lib/build/snapshot";
import { parseStage3ProjectState } from "@/lib/build/stage3Types";
import type { ProjectPublicationSummary } from "@/lib/publishing/queries";
import type { Database } from "@/types/supabase";

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];

/**
 * Turns a real project row into what the approved components need to draw it.
 *
 * Everything here is *derived* from stored fields — never invented. The preview
 * shape comes from the project's own `project_type`, and the accent from a
 * stable hash of its id, so a project looks the same on every screen and two
 * projects are told apart at a glance. Nothing is claimed that the row does not
 * already say.
 */
export interface PresentedProject {
  id: string;
  name: string;
  summary: string | null;
  state: ProjectState;
  updated: string;
  hasOutput: boolean;
  preview: PreviewSpec;
}

/** Which composition suits each real project type. */
const SHAPE_BY_TYPE: Record<string, PreviewSpec["shape"]> = {
  digital_product: "form",
  service: "booking",
  content_media: "archive",
  community_social: "directory",
};

/** A small fixed palette, chosen per project by a stable hash of its id. */
const ACCENTS = ["#5d6bff", "#2f7d6b", "#a4622c", "#6b5bd2", "#3f7cc4", "#a1497a"];

function accentFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return ACCENTS[hash % ACCENTS.length];
}

/** Short relative age so a list of projects is scannable. */
export function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function presentProject(
  project: ProjectRow,
  publication?: ProjectPublicationSummary
): PresentedProject {
  const snapshot = parseSnapshotFields(project.snapshot_fields);
  const stage3 = parseStage3ProjectState(project.snapshot_fields);
  const hasOutput = Boolean(stage3?.output);

  return {
    id: project.id,
    name: project.name?.trim() || "Untitled project",
    summary: stage3?.output?.identity.description ?? stage3?.direction?.concept ?? snapshot.solution ?? null,
    // "proposal" is reserved for a real proposed next version. Nothing produces
    // one yet, so no project can be given that state by accident.
    state: publication?.isPublished ? "published" : "draft",
    updated: relativeTime(project.updated_at),
    hasOutput,
    preview: {
      shape: SHAPE_BY_TYPE[project.project_type] ?? "form",
      accent: accentFor(project.id),
    },
  };
}
