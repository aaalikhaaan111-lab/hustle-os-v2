import type { PreviewSpec, ProjectState } from "@/components/workspace-ui/parts";
import { parseSnapshotFields } from "@/lib/build/snapshot";
import { readAppState } from "@/lib/v2/app/projectState";
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
  updated: RelativeAge;
  hasOutput: boolean;
  /**
   * True only for the v2 application pipeline. A card can run one of these in
   * a frame; a stage-3 output has no such document and must not be asked for
   * one, or the fetch 404s and the card renders nothing at all.
   */
  hasApp: boolean;
  preview: PreviewSpec;
  /** Null when the project has no generated version yet. */
  content: PresentedPreviewContent | null;
  /**
   * A stored screenshot of the project running, or null until one exists.
   *
   * Captured once by the worker (`worker/captureTask.ts`) and served from
   * storage, so the gallery loads an image instead of running anything. It is
   * FIRST in the card's ladder: a real picture beats every drawing below it.
   */
  thumbnailUrl: string | null;
  /**
   * A v2 application's own shape: what it is called and the routes it answers.
   *
   * This is real data from the generated product — not a headline and palette
   * invented to look like a page. An application is source code, so there is
   * no picture of it short of running it, and running eighteen of them in a
   * gallery is what made the gallery slow. Its structure is the honest thing
   * that CAN be shown quickly, and it differs between apps, which is what a
   * gallery needs.
   */
  app: { name: string; description: string; routes: string[] } | null;
  /**
   * The public address, when the project is live. Already known here — the
   * publication summary this function receives carries the slug — so the card
   * can offer "copy link" without the gallery loading anything extra.
   */
  slug: string | null;
}

/**
 * THE REAL CONTENT OF A GENERATED PAGE, for a card that has to be recognisable.
 *
 * Project cards used to draw a decorative mock: a coloured bar, some grey rules
 * and a hashed accent, identical in every project except the hue. Six projects
 * therefore looked like six copies of one drawing, and finding "the chess one"
 * meant reading names.
 *
 * This is the page's OWN content — its headline, its eyebrow, its call to
 * action, its palette, drawn from `visual.palette`, which the generator chose
 * for that project. Nothing here is invented or hashed; a project with no
 * version yet returns null and the card says so rather than showing a mock of a
 * page that does not exist.
 *
 * The output already travels in `snapshot_fields`, which `listProjects` selects
 * in full — so this costs no extra query.
 */
export interface PresentedPreviewContent {
  eyebrow: string;
  headline: string;
  subheadline: string;
  ctaLabel: string;
  /** The project's own three-colour palette, as the generator chose it. */
  palette: [string, string, string];
  /** Real section headings, for the strip under the fold. */
  sections: string[];
}

/** Which composition suits each real project type. */
const SHAPE_BY_TYPE: Record<string, PreviewSpec["shape"]> = {
  digital_product: "form",
  service: "booking",
  content_media: "archive",
  community_social: "directory",
};

/** A small fixed palette, chosen per project by a stable hash of its id. */
/**
 * Project marks. Deliberately not the brand accent.
 *
 * These identify one project from another at a glance, so they have to differ
 * from each other — but the first was the old brand indigo, which made one
 * project in every list look like the selected one. The set is now clearly
 * "project colour", and the accent stays reserved for actions.
 */
const ACCENTS = ["#5b63d6", "#2f7d6b", "#a4622c", "#7a5bd2", "#3f7cc4", "#a1497a"];

export function accentFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return ACCENTS[hash % ACCENTS.length];
}

/**
 * Short relative age so a list of projects is scannable.
 *
 * Returned as a unit and a count rather than a formatted string: this runs on
 * the server, where the reader's language is not this module's business, and
 * the screens turn it into words through the message catalogue.
 */
export type RelativeAge =
  | { unit: "unknown" }
  | { unit: "today" }
  | { unit: "yesterday" }
  | { unit: "days" | "months" | "years"; value: number };

export function relativeAge(iso: string | null): RelativeAge {
  if (!iso) return { unit: "unknown" };
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return { unit: "today" };
  if (days === 1) return { unit: "yesterday" };
  if (days < 30) return { unit: "days", value: days };
  if (days < 365) return { unit: "months", value: Math.floor(days / 30) };
  return { unit: "years", value: Math.floor(days / 365) };
}

export function presentProject(
  project: ProjectRow,
  publication?: ProjectPublicationSummary
): PresentedProject {
  const snapshot = parseSnapshotFields(project.snapshot_fields);
  const stage3 = parseStage3ProjectState(project.snapshot_fields);
  /**
   * A PROJECT HAS A VERSION IF EITHER PIPELINE PRODUCED ONE.
   *
   * `hasOutput` only ever consulted `stage3.output`, but the v2 pipeline stores
   * its generated application under a different key entirely
   * (`snapshot_fields.app_runtime`). Every project built that way therefore
   * reported "no first version yet" in the gallery — including published ones,
   * whose version is not merely generated but live on the internet.
   */
  const appState = readAppState(project.snapshot_fields);
  const hasOutput = Boolean(stage3?.output) || appState !== null;

  return {
    id: project.id,
    // Left empty rather than filled with an English placeholder; the screens
    // supply the localised fallback.
    name: project.name?.trim() ?? "",
    summary: stage3?.output?.identity.description ?? stage3?.direction?.concept ?? snapshot.solution ?? null,
    // "proposal" is reserved for a real proposed next version. Nothing produces
    // one yet, so no project can be given that state by accident.
    state: publication?.isPublished ? "published" : "draft",
    updated: relativeAge(project.updated_at),
    hasOutput,
    hasApp: appState !== null,
    thumbnailUrl: project.thumbnail_url ?? null,
    preview: {
      shape: SHAPE_BY_TYPE[project.project_type] ?? "form",
      accent: accentFor(project.id),
    },
    slug: publication?.isPublished ? publication.slug : null,
    app: appState
      ? {
          name: appState.app.metadata.name,
          description: appState.app.metadata.description,
          routes: appState.app.routes.map((route) => route.title || route.path).slice(0, 5),
        }
      : null,
    content: stage3?.output
      ? {
          eyebrow: stage3.output.hero.eyebrow,
          headline: stage3.output.hero.headline,
          subheadline: stage3.output.hero.subheadline,
          ctaLabel: stage3.output.cta.label,
          palette: stage3.output.visual.palette,
          sections: stage3.output.sections
            .map((section) => ("title" in section && typeof section.title === "string" ? section.title : ""))
            .filter(Boolean)
            .slice(0, 3),
        }
      : null,
  };
}
