/**
 * The structured answers a project carries, and how they are stored.
 *
 * These six are the allowlist. The AI proposal schema, the server-side save
 * validation and the workspace's own reads all derive from it, so a field the
 * assistant offers to save can only ever be one of these — never an arbitrary
 * database column.
 *
 * This file used to also assemble "snapshot rows" by joining roadmap tasks to
 * their saved outputs, for a project-state panel the workspace no longer
 * renders. That went with the tables it read; what remains is the part the
 * current product actually uses.
 */

export const STRUCTURED_FIELDS = [
  "problem",
  "audience",
  "solution",
  "evidence",
  "first_version",
  "test_results",
] as const;

export type StructuredField = (typeof STRUCTURED_FIELDS)[number];

export function isStructuredField(value: unknown): value is StructuredField {
  return typeof value === "string" && (STRUCTURED_FIELDS as readonly string[]).includes(value);
}

/** The label a structured field is shown under, for naming it in conversation. */
export const FIELD_TO_LABELKEY: Record<StructuredField, string> = {
  problem: "snapProblem",
  audience: "snapAudience",
  solution: "snapSolution",
  evidence: "snapEvidence",
  first_version: "snapFirstVersion",
  test_results: "snapTesting",
};

/** Reads the stored snapshot_fields JSONB into a validated, typed record. */
export function parseSnapshotFields(raw: unknown): Partial<Record<StructuredField, string>> {
  if (!raw || typeof raw !== "object") return {};
  const out: Partial<Record<StructuredField, string>> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (isStructuredField(key) && typeof value === "string" && value.trim().length > 0) {
      out[key] = value;
    }
  }
  return out;
}
