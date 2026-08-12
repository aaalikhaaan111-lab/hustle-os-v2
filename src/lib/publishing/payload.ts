/**
 * What a publication holds, now that a project can be two different things.
 *
 * `project_publications.output` has always been one `Stage3ProjectOutput` — the
 * fixed page artifact. A project built by the app runtime has no such artifact;
 * it has an application. Rather than a second table, a second slug space and a
 * second public route, the column carries either, and this module owns telling
 * them apart.
 *
 * The discrimination is explicit and versioned rather than structural. Sniffing
 * for an `identity` key would work today and break the first time either shape
 * gains a field, and a published project is the one thing a person has actually
 * shown to somebody — it is not the place to be clever.
 *
 * A publication is a *snapshot*, deliberately. Editing the project does not
 * change what visitors see until the owner publishes again, which is what makes
 * publishing a decision rather than a side effect.
 */

import { parseAppState, type AppProjectState } from "@/lib/v2/app/projectState";
import { sanitizeStage3Output, type Stage3ProjectOutput } from "@/lib/build/stage3Types";
import type { GeneratedAppV1 } from "@/lib/v2/app/contract";

export const APP_PUBLICATION_KIND = "app" as const;
export const APP_PUBLICATION_VERSION = 1;

/** The stored shape for an app-runtime publication. */
export interface AppPublicationPayload {
  kind: typeof APP_PUBLICATION_KIND;
  version: number;
  app: GeneratedAppV1;
  /** Denormalised so a listing never has to parse the whole project. */
  name: string;
  description: string;
}

export type PublicationPayload =
  | { kind: "app"; app: GeneratedAppV1; name: string; description: string }
  | { kind: "output"; output: Stage3ProjectOutput };

/** Builds the payload to store for a project the app runtime built. */
export function appPublicationPayload(state: AppProjectState): AppPublicationPayload {
  return {
    kind: APP_PUBLICATION_KIND,
    version: APP_PUBLICATION_VERSION,
    app: state.app,
    name: state.app.metadata.name,
    description: state.app.metadata.description,
  };
}

/**
 * Reads a stored publication back, re-running the gate on the way.
 *
 * The application is validated again here rather than trusted, for the same
 * reason the workspace re-validates on every read: the rules move, and a
 * project stored under an older gate may no longer be one this version is
 * willing to serve. A publication that fails is `null` — the visitor gets a
 * not-found rather than a half-built page.
 */
export function parsePublicationPayload(value: unknown): PublicationPayload | null {
  if (value && typeof value === "object" && (value as { kind?: unknown }).kind === APP_PUBLICATION_KIND) {
    const raw = value as Partial<AppPublicationPayload>;
    if (raw.version !== APP_PUBLICATION_VERSION) return null;
    // `parseAppState` is the gate the workspace uses; reuse it rather than
    // re-deriving which rules a stored application has to satisfy.
    const state = parseAppState({
      version: 1,
      kind: "app",
      app: raw.app,
      generatedAt: new Date(0).toISOString(),
      model: "published",
    });
    if (!state) return null;
    return {
      kind: "app",
      app: state.app,
      name: typeof raw.name === "string" && raw.name.trim() ? raw.name : state.app.metadata.name,
      description: typeof raw.description === "string" ? raw.description : state.app.metadata.description,
    };
  }

  const output = sanitizeStage3Output(value);
  if (!output) return null;
  return { kind: "output", output };
}

/** The display name for either shape, for slugs and page titles. */
export function publicationName(payload: PublicationPayload): string {
  return payload.kind === "app" ? payload.name : payload.output.identity.name;
}

/** The description for either shape, for meta tags. */
export function publicationDescription(payload: PublicationPayload): string {
  return payload.kind === "app" ? payload.description : payload.output.identity.tagline;
}
