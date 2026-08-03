/**
 * The shapes the workspace will show once the product records them.
 *
 * Every one of these is deliberately empty today: there is no change ledger, no
 * version history table and no signal detection yet. They exist so the surfaces
 * that will render them are written against a real contract rather than against
 * invented sample data — and so the day the tables land, only the loaders below
 * change.
 */

export type ProjectChangeStatus = "pending" | "accepted" | "reverted";

export interface ProjectChange {
  id: string;
  /** Which part of the product moved — "Hero", "Response form", and so on. */
  area: string;
  summary: string;
  createdAt: string;
  status: ProjectChangeStatus;
}

export type ProjectVersionStatus = "draft" | "published" | "archived";

export interface ProjectVersionSummary {
  id: string;
  label: string;
  createdAt: string;
  /** Why this version exists, when it came from an observed pattern. */
  reason?: string;
  status: ProjectVersionStatus;
}

/** One repeated behaviour, once there is enough real use to call it repeated. */
export interface ProductSignal {
  id: string;
  kind: "completion" | "abandonment" | "repetition" | "backtracking" | "return";
  summary: string;
  observedSessions: number;
  detectedAt: string;
}

/**
 * No change ledger exists yet. This returns nothing rather than a plausible
 * list — an invented change record would be a claim about the user's project
 * that we cannot support.
 */
export function loadProjectChanges(): ProjectChange[] {
  return [];
}

/**
 * Publishing exists (`project_publications`), but it keeps one row per project
 * and overwrites it — there is no history to list yet. Until versions are
 * retained, this stays empty.
 */
export function loadProjectVersions(): ProjectVersionSummary[] {
  return [];
}

/** Signal detection is not implemented; nothing is inferred from a few rows. */
export function loadProductSignals(): ProductSignal[] {
  return [];
}
