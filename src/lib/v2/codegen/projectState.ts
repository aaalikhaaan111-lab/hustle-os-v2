/**
 * How a generated site is stored on a project, and how it is read back.
 *
 * WHAT IS STORED, AND WHY IT IS THE BUNDLE RATHER THAN THE PAGE. The compiler
 * turns a bundle into a complete document per route, and those documents are
 * mostly base64 image bytes — a route with three assets serialises to about
 * 43 KB where the markup that arranges them is under 4 KB. Storing the compiled
 * documents would put a few hundred kilobytes of mostly-duplicated image data
 * into a JSON column that is read on every workspace load. So the bundle is
 * stored and the compile is repeated on read, which is pure, local and cheap.
 *
 * The important consequence is a safety one, and it is the reason this is worth
 * the recompute: the full gate runs again on every read, in the caller's
 * `compileCodegenBundle`. A bundle that was accepted by an older, weaker gate
 * does not get to keep rendering after the gate is tightened — it fails closed
 * and the project shows no preview rather than a page nobody would approve
 * today. Storing compiled HTML would have frozen every past decision into the
 * database permanently.
 *
 * This module is only the shape gate in front of that: it decides whether the
 * stored value is a codegen record at all. It deliberately does not scan
 * markup, because every caller compiles immediately afterwards and scanning
 * twice would be the same work done twice — see the integration test, which
 * pins the safety claim to the compile rather than to `parseCodegenState`.
 *
 * The content pack is stored beside the bundle rather than re-derived from the
 * artifact, so a later edit to the artifact cannot silently change the words on
 * an already-generated page. Regenerating is an explicit act.
 *
 * Everything read back from the database is treated as untrusted input. It was
 * written by an earlier version of this code, which is not the same as being
 * written by this version of this code.
 */

import { CODEGEN_BUDGETS } from "./budgets";
import type { ContentPack } from "./content";
import { CONTENT_KEY_PATTERN } from "./content";
import { validateCodegenEnvelope, type CodegenBundleV1 } from "./envelope";

export const CODEGEN_STATE_VERSION = 1;

export interface CodegenProjectState {
  version: typeof CODEGEN_STATE_VERSION;
  kind: "codegen";
  /** The model's accepted bundle, exactly as the gate approved it. */
  bundle: CodegenBundleV1;
  /** The words the bundle's tokens resolve against, frozen at generation. */
  content: ContentPack;
  /** ISO timestamp. Display and diagnostics only; never used for ordering. */
  generatedAt: string;
  /** Which model produced it, for canary comparison. */
  model: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Reads stored codegen state, or returns null.
 *
 * Null is the only failure mode on purpose. A malformed or outdated record
 * means "this project has no generated site", which the workspace already knows
 * how to show. Throwing would turn a bad row into a broken page, and repairing
 * would mean rendering something nobody generated.
 */
export function parseCodegenState(value: unknown): CodegenProjectState | null {
  const raw = record(value);
  if (!raw) return null;
  if (raw.kind !== "codegen" || raw.version !== CODEGEN_STATE_VERSION) return null;

  // Re-validated rather than cast: this is the same envelope check a model's
  // output gets, applied to a value that has been through a database round trip
  // and a JSON serialiser since anyone last looked at it.
  const envelope = validateCodegenEnvelope(raw.bundle);
  if (!envelope.ok) return null;

  const content = record(raw.content);
  if (!content) return null;
  const pack: Record<string, string> = {};
  for (const [key, entry] of Object.entries(content)) {
    if (!CONTENT_KEY_PATTERN.test(key)) return null;
    if (typeof entry !== "string") return null;
    if (entry.length > CODEGEN_BUDGETS.maxContentValueChars) return null;
    pack[key] = entry;
  }
  if (Object.keys(pack).length > CODEGEN_BUDGETS.maxContentKeys) return null;

  const generatedAt = typeof raw.generatedAt === "string" && ISO.test(raw.generatedAt)
    ? raw.generatedAt
    : null;
  if (!generatedAt) return null;

  const model = typeof raw.model === "string" && raw.model.length > 0 && raw.model.length <= 80
    ? raw.model
    : null;
  if (!model) return null;

  return {
    version: CODEGEN_STATE_VERSION,
    kind: "codegen",
    bundle: envelope.bundle,
    content: pack,
    generatedAt,
    model,
  };
}

/** Reads codegen state out of a project's snapshot JSON. */
export function readCodegenState(snapshotFields: unknown): CodegenProjectState | null {
  return parseCodegenState(record(snapshotFields)?.codegen);
}

/** Writes codegen state into a project's snapshot JSON, leaving the rest alone. */
export function mergeCodegenState(
  snapshotFields: unknown,
  state: CodegenProjectState | null,
): Record<string, unknown> {
  const snapshot = record(snapshotFields) ?? {};
  if (!state) {
    const rest = { ...snapshot };
    delete rest.codegen;
    return rest;
  }
  return { ...snapshot, codegen: state };
}
