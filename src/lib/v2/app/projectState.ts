/**
 * The generated application, as it lives in a project row.
 *
 * Deliberately the same shape of solution as `codegen/projectState.ts`, for the
 * same reasons: the source is stored, never the compiled output, and it is
 * re-validated and re-compiled on every read. A project accepted by an older,
 * weaker gate stops rendering the moment the gate is tightened, instead of
 * being grandfathered in by virtue of already being in the database.
 *
 * That property is not theoretical here. Canary 1's generated app is in the
 * archive with nine remote image URLs that today's validator refuses; storing
 * its compiled document would have frozen that decision permanently.
 *
 * Everything read back is untrusted input. It was written by an earlier version
 * of this code, which is not the same as being written by this version.
 */

import { validateGeneratedApp } from "./validate";
import type { GeneratedAppV1 } from "./contract";

export const APP_STATE_VERSION = 1;

export interface AppProjectState {
  version: typeof APP_STATE_VERSION;
  kind: "app";
  /** The project the gate approved, exactly as it approved it. */
  app: GeneratedAppV1;
  /** ISO timestamp. Display and diagnostics only; never used for ordering. */
  generatedAt: string;
  /** Which model produced it. */
  model: string;
}

/** Where the state lives inside `projects.snapshot_fields`. */
export const APP_STATE_KEY = "app_runtime";

const ISO = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Reads stored state, or returns null.
 *
 * Null is the only failure mode. A malformed, outdated or now-refused record
 * means "this project has no generated application", which the workspace
 * already knows how to show. Throwing would turn a bad row into a broken page,
 * and repairing would mean rendering something nobody generated.
 *
 * The full validator runs here rather than a shape check: it is the same
 * function the generation path used, so what is refused on write is refused on
 * read, and the rules can only get stricter.
 */
export function parseAppState(value: unknown): AppProjectState | null {
  const raw = record(value);
  if (!raw) return null;
  if (raw.kind !== "app" || raw.version !== APP_STATE_VERSION) return null;
  if (typeof raw.generatedAt !== "string" || !ISO.test(raw.generatedAt)) return null;
  if (typeof raw.model !== "string" || raw.model.length === 0 || raw.model.length > 120) return null;

  const validation = validateGeneratedApp(raw.app);
  if (!validation.ok) {
    console.error("[ventrio-app-runtime]", JSON.stringify({
      operation: "read_stored_state",
      issues: validation.issues.slice(0, 5).map((issue) => `${issue.path}: ${issue.code}`),
    }));
    return null;
  }

  return { version: APP_STATE_VERSION, kind: "app", app: validation.app, generatedAt: raw.generatedAt, model: raw.model };
}

/** Pulls the state out of a project's snapshot fields. */
export function readAppState(snapshotFields: unknown): AppProjectState | null {
  const raw = record(snapshotFields);
  if (!raw) return null;
  return parseAppState(raw[APP_STATE_KEY]);
}

/**
 * Writes the state into a snapshot object, leaving every other field alone.
 *
 * Returns a new object; the caller decides whether to persist it. Passing null
 * is a no-op rather than a delete, because a failed regeneration must not erase
 * the version a project already has.
 */
export function mergeAppState(
  snapshotFields: Record<string, unknown>,
  state: AppProjectState | null,
): Record<string, unknown> {
  if (!state) return snapshotFields;
  return { ...snapshotFields, [APP_STATE_KEY]: state as unknown as Record<string, unknown> };
}
