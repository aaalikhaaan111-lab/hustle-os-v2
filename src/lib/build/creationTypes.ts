import type { StartingStage } from "@/lib/build/types";

// ============================================================================
// AI creation flow (Stage 2) — shared types
// ============================================================================
// The creation experience is deliberately separate from the project mentor: its
// only job is understand → narrow → propose a realistic project → create it.
// It runs inside an unfinished project draft and persists its conversation and
// latest structured turn in the existing project_ai_* / snapshot infrastructure.
// Local storage holds only the opaque idempotency token used to resume safely.

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

// A compact, generation-ready summary of what discovery learned. The fields are
// intentionally small and live inside the existing Stage 3 snapshot; no new
// persistence system is needed. Older directions are upgraded with safe
// fallbacks by sanitizeCreationDirection.
export interface CreationCreativeBrief {
  startingMaterial: string;
  motivation: string;
  firstAudience: string;
  desiredExperience: string;
  personalIngredients: string[];
  constraints: string[];
  assumptions: string[];
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
  creativeBrief: CreationCreativeBrief;
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
  id?: string;
  role: "user" | "assistant";
  content: string;
}

export interface PersistedCreationDraft {
  projectId: string;
  conversationId: string;
  sessionId: string;
  projectName: string;
  messages: CreationMessage[];
  turn: CreationTurn | null;
  startingPoint: CreationStartingPoint | null;
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
  briefItem: 240,
} as const;

export function sanitizeCreationDirection(value: unknown): CreationDirection | null {
  if (!value || typeof value !== "object") return null;
  const direction = value as Record<string, unknown>;
  const clean = (input: unknown, max: number) =>
    typeof input === "string" ? input.trim().slice(0, max) : "";
  const name = clean(direction.name, CREATION_LIMITS.name);
  const concept = clean(direction.concept, CREATION_LIMITS.text);
  const forWho = clean(direction.forWho, CREATION_LIMITS.text);
  const creates = clean(direction.creates, CREATION_LIMITS.text);
  const whyFits = clean(direction.whyFits, CREATION_LIMITS.text);
  const problem = clean(direction.problem, CREATION_LIMITS.text);
  const audience = clean(direction.audience, CREATION_LIMITS.audience);
  const niche = clean(direction.niche, CREATION_LIMITS.niche) || "other";
  if (!isV1Preset(direction.projectType)) return null;
  if (!name || !concept || !forWho || !creates || !whyFits || !problem || !audience) return null;

  const brief = direction.creativeBrief && typeof direction.creativeBrief === "object"
    ? direction.creativeBrief as Record<string, unknown>
    : {};
  const cleanList = (input: unknown) => {
    if (!Array.isArray(input)) return [];
    const seen = new Set<string>();
    const items: string[] = [];
    for (const entry of input.slice(0, 6)) {
      const item = clean(entry, CREATION_LIMITS.briefItem);
      const key = item.toLocaleLowerCase();
      if (!item || seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
    return items;
  };
  const creativeBrief: CreationCreativeBrief = {
    startingMaterial: clean(brief.startingMaterial, CREATION_LIMITS.text) || niche,
    motivation: clean(brief.motivation, CREATION_LIMITS.text) || problem,
    firstAudience: clean(brief.firstAudience, CREATION_LIMITS.audience) || audience,
    desiredExperience: clean(brief.desiredExperience, CREATION_LIMITS.text) || creates,
    personalIngredients: cleanList(brief.personalIngredients),
    constraints: cleanList(brief.constraints),
    assumptions: cleanList(brief.assumptions),
  };
  return {
    name,
    concept,
    forWho,
    creates,
    whyFits,
    projectType: direction.projectType,
    problem,
    audience,
    niche,
    creativeBrief,
  };
}

export function sanitizeCreationTurn(value: unknown): CreationTurn | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.phase !== "ask" && candidate.phase !== "propose") return null;
  const message = typeof candidate.message === "string"
    ? candidate.message.trim().slice(0, CREATION_LIMITS.message)
    : "";
  if (!message) return null;

  const choices: CreationChoice[] = [];
  const seen = new Set<string>();
  for (const raw of (Array.isArray(candidate.choices) ? candidate.choices : []).slice(0, 6)) {
    if (!raw || typeof raw !== "object") continue;
    const choice = raw as Record<string, unknown>;
    const rawId = typeof choice.id === "string" ? choice.id.trim().toLowerCase() : "";
    const id = rawId.replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, CREATION_LIMITS.choiceId);
    const title = typeof choice.title === "string" ? choice.title.trim().slice(0, CREATION_LIMITS.choiceTitle) : "";
    const description = typeof choice.description === "string"
      ? choice.description.trim().slice(0, CREATION_LIMITS.choiceDescription)
      : "";
    if (!id || !title || seen.has(id)) continue;
    seen.add(id);
    choices.push(description ? { id, title, description } : { id, title });
  }

  const directions = (Array.isArray(candidate.directions) ? candidate.directions : [])
    .map(sanitizeCreationDirection)
    .filter((direction): direction is CreationDirection => direction !== null)
    .slice(0, 3);

  if (candidate.phase === "propose") {
    if (directions.length < 2) return null;
    return { phase: "propose", message, choices: [], choiceMode: "single", directions, transition: "reveal" };
  }

  return {
    phase: "ask",
    message,
    choices,
    choiceMode: candidate.choiceMode === "multiple" ? "multiple" : "single",
    directions: [],
    transition: candidate.transition === "focus" ? "focus" : "none",
  };
}
