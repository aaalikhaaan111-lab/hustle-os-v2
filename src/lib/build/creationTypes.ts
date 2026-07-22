import type { StartingStage } from "@/lib/build/types";

// ============================================================================
// AI creation flow (Stage 2) — shared types
// ============================================================================
// The creation experience is deliberately separate from the project mentor: its
// only job is understand → narrow → propose a realistic project → create it.
// It runs BEFORE a project exists, so it never touches the project_ai_* tables;
// the client holds the conversation (persisted to localStorage) and sends it to
// a stateless server action each turn.

// The four project presets Ventrio's V1 output engine supports. The AI infers
// one of these per direction; it is internal intelligence, not a user choice.
// Each is a valid projects.project_type (see the DB check + PROJECT_TYPE_OPTIONS).
export const V1_PRESETS = ["community_social", "service", "content_media", "digital_product"] as const;
export type V1Preset = (typeof V1_PRESETS)[number];

export function isV1Preset(value: unknown): value is V1Preset {
  return typeof value === "string" && (V1_PRESETS as readonly string[]).includes(value);
}

// Optional starting-point shortcuts on the first screen. Not a form field — the
// user can also just type. Mapped onto the existing starting_stage enum so the
// created project stays compatible with everything that reads that column.
export const CREATION_STARTING_POINTS = ["hobby", "skill", "idea", "problem", "unsure"] as const;
export type CreationStartingPoint = (typeof CREATION_STARTING_POINTS)[number];

export function isStartingPoint(value: unknown): value is CreationStartingPoint {
  return typeof value === "string" && (CREATION_STARTING_POINTS as readonly string[]).includes(value);
}

export function startingStageFor(point: CreationStartingPoint | null): StartingStage {
  switch (point) {
    case "hobby":
      return "interest";
    case "problem":
      return "problem";
    case "skill":
    case "idea":
      return "idea";
    case "unsure":
      return "interest";
    default:
      // Reached a concrete direction with no explicit starting point.
      return "idea";
  }
}

// One proposed project direction — everything the user needs to choose, plus the
// structured context persisted when they pick it.
export interface CreationDirection {
  name: string;
  concept: string; // one-sentence explanation
  forWho: string; // target user
  creates: string; // what Ventrio would create
  whyFits: string; // one short personalized reason
  projectType: V1Preset; // inferred preset
  problem: string; // initial problem/desire (persisted)
  audience: string; // target audience (persisted)
  niche: string; // short free-text topic/skill (persisted)
}

// Contextual controls are model-selected but rendered through a fixed,
// allowlisted client component. The model supplies content only, never markup.
export interface CreationChoice {
  id: string;
  title: string;
  description?: string;
}

export type CreationChoiceMode = "single" | "multiple";
export type CreationTransition = "none" | "focus" | "reveal";

// One turn of the creation AI: either a follow-up question (with optional quick
// choices) or a set of 2–3 proposed directions.
export interface CreationTurn {
  phase: "ask" | "propose";
  message: string;
  choices: CreationChoice[];
  choiceMode: CreationChoiceMode;
  directions: CreationDirection[];
  transition: CreationTransition;
}

export interface CreationMessage {
  role: "user" | "assistant";
  content: string;
}

// Field caps (server-enforced) so tampered client input can never write oversized
// values into the project.
export const CREATION_LIMITS = {
  message: 2000,
  name: 80,
  audience: 200,
  text: 600,
  niche: 80,
  choiceId: 48,
  choiceTitle: 80,
  choiceDescription: 180,
} as const;
