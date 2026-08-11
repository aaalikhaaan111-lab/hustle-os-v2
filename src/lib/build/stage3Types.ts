import {
  isStartingPoint,
  isV1Preset,
  sanitizeCreationDirection,
  sanitizeCreationTurn,
  V1_PRESETS,
  type CreationDirection,
  type CreationStartingPoint,
  type CreationTurn,
  type V1Preset,
} from "@/lib/build/creationTypes";

export const STAGE3_VERSION = 1 as const;
export const STAGE3_STATUSES = ["exploring", "shaping", "proposed", "ready", "first_version_ready"] as const;
export type Stage3Status = (typeof STAGE3_STATUSES)[number];

export const OUTPUT_CTA_ACTIONS = ["join", "request", "contact", "follow", "subscribe", "waitlist", "feedback"] as const;
export type OutputCtaAction = (typeof OUTPUT_CTA_ACTIONS)[number];
export const OUTPUT_FIELD_TYPES = ["text", "email", "textarea", "select"] as const;
export type OutputFieldType = (typeof OUTPUT_FIELD_TYPES)[number];

// A curated set of hand-built visual identities. The model does not generate
// CSS — it picks whichever premium, pre-designed theme actually fits this
// idea (reasoning enforced in the prompt), and the renderer applies real,
// distinct typography/color/layout treatment per theme. "minimal" keeps the
// original dark look as one deliberate option, not the only one.
export const OUTPUT_THEMES = ["editorial", "atmospheric", "futuristic", "product", "minimal"] as const;
export type OutputTheme = (typeof OUTPUT_THEMES)[number];

// The hero's visual centerpiece, alongside the headline/subheadline — never
// text-only. "mockup" = abstract UI/app-chrome frame, "image" = a captioned
// image-placeholder block, "stat" = one big number+label callout.
export const HERO_VISUAL_KINDS = ["mockup", "image", "stat"] as const;
export type HeroVisualKind = (typeof HERO_VISUAL_KINDS)[number];

// The first version is a complete premium website built from ordered
// sections. Most sections are narrative/visual (story, showcase, stats,
// process); at most one section may instead be "interactive" — a quiz-style
// input -> scored result reveal, or a pick-a-card explorer -> written reveal,
// embedded like any other section when the idea genuinely benefits from a
// hands-on moment. Both experience kinds compute entirely client-side (no
// live AI call) so the embedded moment is instant, free, and works for
// anonymous public visitors.
export const EXPERIENCE_KINDS = ["quiz", "explorer"] as const;
export type ExperienceKind = (typeof EXPERIENCE_KINDS)[number];
export const QUIZ_STEP_KINDS = ["choice", "number"] as const;
export type QuizStepKind = (typeof QUIZ_STEP_KINDS)[number];

export interface Stage3OutputField {
  id: string;
  label: string;
  type: OutputFieldType;
  required: boolean;
  options: string[];
}

// A single quiz option/breakpoint carries a `scores` vector aligned by index
// to the experience's `outcomes` array (Anthropic's structured-output subset
// has no support for a dynamic-key map, so an index-aligned array stands in
// for one). All step fields are always present (unused ones left at their
// zero/empty default) rather than schema-branched by `kind`, matching the
// existing loosely-required convention already used for Stage3OutputField.
export interface Stage3QuizOption {
  id: string;
  label: string;
  hint: string;
  scores: number[];
}
export interface Stage3QuizBreakpoint {
  max: number;
  scores: number[];
}
export interface Stage3QuizStep {
  id: string;
  kind: QuizStepKind;
  prompt: string;
  helper: string;
  options: Stage3QuizOption[];
  numberMin: number;
  numberMax: number;
  numberStep: number;
  numberUnit: string;
  numberPlaceholder: string;
  numberBreakpoints: Stage3QuizBreakpoint[];
}
export interface Stage3QuizOutcome {
  id: string;
  title: string;
  emoji: string;
  summary: string;
  detail: string;
  actionItems: string[];
}
export interface Stage3QuizExperience {
  kind: "quiz";
  intro: string;
  actionLabel: string;
  steps: Stage3QuizStep[];
  outcomes: Stage3QuizOutcome[];
}

export interface Stage3ExplorerCard {
  id: string;
  label: string;
  emoji: string;
  revealTitle: string;
  revealBody: string;
  // Empty string = absent, same convention as hero.eyebrow below. Both must
  // be non-empty for the renderer to show a before/after pair.
  beforeLabel: string;
  beforeText: string;
  afterLabel: string;
  afterText: string;
}
export interface Stage3ExplorerExperience {
  kind: "explorer";
  intro: string;
  cards: Stage3ExplorerCard[];
}

export type Stage3Experience = Stage3QuizExperience | Stage3ExplorerExperience;

// The website's body is an ordered list of sections. "story" and the rest
// carry a title/body plus a kind-specific list; "interactive" nests one of
// the two experience kinds above. At most one "interactive" section is kept
// per output (enforced in the sanitizer, not the schema).
export const SECTION_KINDS = ["story", "showcase", "stats", "process", "interactive", "compare"] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

export interface Stage3StorySection { kind: "story"; title: string; body: string }
// visualPrompt is empty = no image for this item (same convention as
// hero.eyebrow elsewhere in this file); when set, it must be a specific,
// idea-grounded description of what the image would show, not a generic label.
export interface Stage3ShowcaseItem { title: string; body: string; visualPrompt: string }
export interface Stage3ShowcaseSection { kind: "showcase"; title: string; body: string; items: Stage3ShowcaseItem[] }
export interface Stage3StatItem { value: string; label: string }
export interface Stage3StatsSection { kind: "stats"; title: string; body: string; stats: Stage3StatItem[] }
export interface Stage3ProcessStep { title: string; body: string }
export interface Stage3ProcessSection { kind: "process"; title: string; body: string; steps: Stage3ProcessStep[] }
export interface Stage3InteractiveSection { kind: "interactive"; title: string; body: string; experience: Stage3Experience }
export interface Stage3CompareSection {
  kind: "compare"; title: string; body: string;
  leftLabel: string; leftBody: string; rightLabel: string; rightBody: string;
}

export type Stage3Section =
  | Stage3StorySection
  | Stage3ShowcaseSection
  | Stage3StatsSection
  | Stage3ProcessSection
  | Stage3InteractiveSection
  | Stage3CompareSection;

export interface Stage3ProjectOutput {
  version: 1;
  preset: V1Preset;
  identity: { name: string; tagline: string; description: string };
  targetUser: string;
  primaryValue: string;
  visual: { mood: string; palette: [string, string, string]; styleNotes: string; theme: OutputTheme };
  hero: { eyebrow: string; headline: string; subheadline: string; visualKind: HeroVisualKind; visualPrompt: string };
  sections: Stage3Section[];
  cta: { label: string; action: OutputCtaAction; supportingText: string };
  form: { title: string; description: string; submitLabel: string; fields: Stage3OutputField[] };
  launchCopy: { headline: string; body: string; shortPost: string };
}

export interface Stage3ProjectState {
  version: 1;
  kind: "stage3";
  sessionId: string;
  status: Stage3Status;
  startingPoint: CreationStartingPoint | null;
  conversationId: string;
  lastRequestId: string | null;
  turn: CreationTurn | null;
  direction: CreationDirection | null;
  output: Stage3ProjectOutput | null;
}

const COMPATIBLE_ACTIONS: Record<V1Preset, readonly OutputCtaAction[]> = {
  community_social: ["join"],
  service: ["request", "contact"],
  content_media: ["follow", "subscribe"],
  digital_product: ["waitlist", "feedback"],
};

const DEFAULT_PALETTES: Record<V1Preset, [string, string, string]> = {
  community_social: ["#8B5CF6", "#22D3EE", "#111827"],
  service: ["#38BDF8", "#A78BFA", "#111827"],
  content_media: ["#F97316", "#FACC15", "#111827"],
  digital_product: ["#22C55E", "#38BDF8", "#111827"],
};

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function slug(value: unknown, max: number): string {
  return text(value, max).toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-");
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function numArray(value: unknown, length: number): number[] {
  const raw = Array.isArray(value) ? value.map((entry) => num(entry, 0)) : [];
  const out = raw.slice(0, length);
  while (out.length < length) out.push(0);
  return out;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

// ============================================================================
// JSON Schema (for output_config.format) — kept in one place so the
// generation and edit calls (stage3.ts) and the feedback-improvement call
// (feedback/schemas.ts) never drift out of sync with each other.
// Anthropic's structured-output subset has no minItems/maxItems/numeric
// constraints; array cardinality is enforced entirely in sanitizeStage3Output
// below, not here.
// ============================================================================

const QUIZ_OPTION_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" }, label: { type: "string" }, hint: { type: "string" },
    scores: { type: "array", items: { type: "number" } },
  },
  required: ["id", "label", "hint", "scores"], additionalProperties: false,
};

const QUIZ_BREAKPOINT_SCHEMA = {
  type: "object",
  properties: { max: { type: "number" }, scores: { type: "array", items: { type: "number" } } },
  required: ["max", "scores"], additionalProperties: false,
};

const QUIZ_STEP_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" },
    kind: { type: "string", enum: [...QUIZ_STEP_KINDS] },
    prompt: { type: "string" },
    helper: { type: "string" },
    options: { type: "array", items: QUIZ_OPTION_SCHEMA },
    numberMin: { type: "number" }, numberMax: { type: "number" }, numberStep: { type: "number" },
    numberUnit: { type: "string" }, numberPlaceholder: { type: "string" },
    numberBreakpoints: { type: "array", items: QUIZ_BREAKPOINT_SCHEMA },
  },
  required: [
    "id", "kind", "prompt", "helper", "options",
    "numberMin", "numberMax", "numberStep", "numberUnit", "numberPlaceholder", "numberBreakpoints",
  ],
  additionalProperties: false,
};

const QUIZ_OUTCOME_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" }, title: { type: "string" }, emoji: { type: "string" },
    summary: { type: "string" }, detail: { type: "string" },
    actionItems: { type: "array", items: { type: "string" } },
  },
  required: ["id", "title", "emoji", "summary", "detail", "actionItems"], additionalProperties: false,
};

const QUIZ_EXPERIENCE_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["quiz"] },
    intro: { type: "string" }, actionLabel: { type: "string" },
    steps: { type: "array", items: QUIZ_STEP_SCHEMA },
    outcomes: { type: "array", items: QUIZ_OUTCOME_SCHEMA },
  },
  required: ["kind", "intro", "actionLabel", "steps", "outcomes"], additionalProperties: false,
};

const EXPLORER_CARD_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" }, label: { type: "string" }, emoji: { type: "string" },
    revealTitle: { type: "string" }, revealBody: { type: "string" },
    beforeLabel: { type: "string" }, beforeText: { type: "string" },
    afterLabel: { type: "string" }, afterText: { type: "string" },
  },
  required: [
    "id", "label", "emoji", "revealTitle", "revealBody",
    "beforeLabel", "beforeText", "afterLabel", "afterText",
  ],
  additionalProperties: false,
};

const EXPLORER_EXPERIENCE_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["explorer"] },
    intro: { type: "string" },
    cards: { type: "array", items: EXPLORER_CARD_SCHEMA },
  },
  required: ["kind", "intro", "cards"], additionalProperties: false,
};

const EXPERIENCE_SCHEMA = { anyOf: [QUIZ_EXPERIENCE_SCHEMA, EXPLORER_EXPERIENCE_SCHEMA] };

const STORY_SECTION_SCHEMA = {
  type: "object",
  properties: { kind: { type: "string", enum: ["story"] }, title: { type: "string" }, body: { type: "string" } },
  required: ["kind", "title", "body"], additionalProperties: false,
};

const SHOWCASE_SECTION_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["showcase"] }, title: { type: "string" }, body: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: { title: { type: "string" }, body: { type: "string" }, visualPrompt: { type: "string" } },
        required: ["title", "body", "visualPrompt"], additionalProperties: false,
      },
    },
  },
  required: ["kind", "title", "body", "items"], additionalProperties: false,
};

const STATS_SECTION_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["stats"] }, title: { type: "string" }, body: { type: "string" },
    stats: {
      type: "array",
      items: {
        type: "object",
        properties: { value: { type: "string" }, label: { type: "string" } },
        required: ["value", "label"], additionalProperties: false,
      },
    },
  },
  required: ["kind", "title", "body", "stats"], additionalProperties: false,
};

const PROCESS_SECTION_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["process"] }, title: { type: "string" }, body: { type: "string" },
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: { title: { type: "string" }, body: { type: "string" } },
        required: ["title", "body"], additionalProperties: false,
      },
    },
  },
  required: ["kind", "title", "body", "steps"], additionalProperties: false,
};

const INTERACTIVE_SECTION_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["interactive"] }, title: { type: "string" }, body: { type: "string" },
    experience: EXPERIENCE_SCHEMA,
  },
  required: ["kind", "title", "body", "experience"], additionalProperties: false,
};

const COMPARE_SECTION_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["compare"] }, title: { type: "string" }, body: { type: "string" },
    leftLabel: { type: "string" }, leftBody: { type: "string" },
    rightLabel: { type: "string" }, rightBody: { type: "string" },
  },
  required: ["kind", "title", "body", "leftLabel", "leftBody", "rightLabel", "rightBody"], additionalProperties: false,
};

const SECTION_SCHEMA = {
  anyOf: [
    STORY_SECTION_SCHEMA, SHOWCASE_SECTION_SCHEMA, STATS_SECTION_SCHEMA,
    PROCESS_SECTION_SCHEMA, INTERACTIVE_SECTION_SCHEMA, COMPARE_SECTION_SCHEMA,
  ],
};

export function buildStage3OutputJsonSchema() {
  return {
    type: "object",
    properties: {
      version: { type: "integer", enum: [1] },
      preset: { type: "string", enum: [...V1_PRESETS] },
      identity: {
        type: "object",
        properties: { name: { type: "string" }, tagline: { type: "string" }, description: { type: "string" } },
        required: ["name", "tagline", "description"], additionalProperties: false,
      },
      targetUser: { type: "string" },
      primaryValue: { type: "string" },
      visual: {
        type: "object",
        properties: {
          mood: { type: "string" },
          palette: { type: "array", items: { type: "string" } },
          styleNotes: { type: "string" },
          theme: { type: "string", enum: [...OUTPUT_THEMES] },
        },
        required: ["mood", "palette", "styleNotes", "theme"], additionalProperties: false,
      },
      hero: {
        type: "object",
        properties: {
          eyebrow: { type: "string" }, headline: { type: "string" }, subheadline: { type: "string" },
          visualKind: { type: "string", enum: [...HERO_VISUAL_KINDS] }, visualPrompt: { type: "string" },
        },
        required: ["eyebrow", "headline", "subheadline", "visualKind", "visualPrompt"], additionalProperties: false,
      },
      sections: { type: "array", items: SECTION_SCHEMA },
      cta: {
        type: "object",
        properties: {
          label: { type: "string" }, action: { type: "string", enum: [...OUTPUT_CTA_ACTIONS] }, supportingText: { type: "string" },
        },
        required: ["label", "action", "supportingText"], additionalProperties: false,
      },
      form: {
        type: "object",
        properties: {
          title: { type: "string" }, description: { type: "string" }, submitLabel: { type: "string" },
          fields: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" }, label: { type: "string" },
                type: { type: "string", enum: [...OUTPUT_FIELD_TYPES] }, required: { type: "boolean" },
                options: { type: "array", items: { type: "string" } },
              },
              required: ["id", "label", "type", "required", "options"], additionalProperties: false,
            },
          },
        },
        required: ["title", "description", "submitLabel", "fields"], additionalProperties: false,
      },
      launchCopy: {
        type: "object",
        properties: { headline: { type: "string" }, body: { type: "string" }, shortPost: { type: "string" } },
        required: ["headline", "body", "shortPost"], additionalProperties: false,
      },
    },
    required: [
      "version", "preset", "identity", "targetUser", "primaryValue",
      "visual", "hero", "sections", "cta", "form", "launchCopy",
    ],
    additionalProperties: false,
  };
}

// ============================================================================
// Sanitizer
// ============================================================================

function sanitizeQuizOutcomes(value: unknown): Stage3QuizOutcome[] {
  const outcomes: Stage3QuizOutcome[] = [];
  for (const entry of (Array.isArray(value) ? value : []).slice(0, 4)) {
    const raw = record(entry);
    if (!raw) continue;
    const id = slug(raw.id, 40) || `outcome-${outcomes.length + 1}`;
    const title = text(raw.title, 80);
    const summary = text(raw.summary, 200);
    const detail = text(raw.detail, 600);
    const emoji = text(raw.emoji, 8) || "✨";
    const actionItems = (Array.isArray(raw.actionItems) ? raw.actionItems : [])
      .map((item) => text(item, 160)).filter(Boolean).slice(0, 4);
    if (!title || !summary || !detail || actionItems.length === 0) continue;
    outcomes.push({ id, title, emoji, summary, detail, actionItems });
  }
  return outcomes;
}

function sanitizeQuizSteps(value: unknown, outcomeCount: number): Stage3QuizStep[] {
  const steps: Stage3QuizStep[] = [];
  for (const entry of (Array.isArray(value) ? value : []).slice(0, 4)) {
    const raw = record(entry);
    if (!raw) continue;
    const kind = raw.kind === "number" ? "number" : "choice";
    const id = slug(raw.id, 40) || `step-${steps.length + 1}`;
    const prompt = text(raw.prompt, 140);
    const helper = text(raw.helper, 200);
    if (!prompt) continue;

    if (kind === "choice") {
      const options: Stage3QuizOption[] = [];
      for (const optionEntry of (Array.isArray(raw.options) ? raw.options : []).slice(0, 5)) {
        const optionRaw = record(optionEntry);
        if (!optionRaw) continue;
        const label = text(optionRaw.label, 80);
        if (!label) continue;
        options.push({
          id: slug(optionRaw.id, 40) || `option-${options.length + 1}`,
          label,
          hint: text(optionRaw.hint, 140),
          scores: numArray(optionRaw.scores, outcomeCount),
        });
      }
      if (options.length < 2) continue;
      steps.push({
        id, kind: "choice", prompt, helper, options,
        numberMin: 0, numberMax: 0, numberStep: 0, numberUnit: "", numberPlaceholder: "", numberBreakpoints: [],
      });
    } else {
      const numberMinRaw = num(raw.numberMin, 0);
      const numberMaxRaw = num(raw.numberMax, numberMinRaw + 10);
      const numberMax = numberMaxRaw > numberMinRaw ? numberMaxRaw : numberMinRaw + 10;
      const numberStepRaw = num(raw.numberStep, 1);
      const numberStep = numberStepRaw > 0 ? numberStepRaw : 1;
      const breakpoints: Stage3QuizBreakpoint[] = [];
      for (const breakpointEntry of (Array.isArray(raw.numberBreakpoints) ? raw.numberBreakpoints : []).slice(0, 4)) {
        const breakpointRaw = record(breakpointEntry);
        if (!breakpointRaw) continue;
        breakpoints.push({ max: num(breakpointRaw.max, numberMax), scores: numArray(breakpointRaw.scores, outcomeCount) });
      }
      breakpoints.sort((left, right) => left.max - right.max);
      if (breakpoints.length === 0) continue;
      if (breakpoints[breakpoints.length - 1].max < numberMax) breakpoints[breakpoints.length - 1].max = numberMax;
      steps.push({
        id, kind: "number", prompt, helper, options: [],
        numberMin: numberMinRaw, numberMax, numberStep,
        numberUnit: text(raw.numberUnit, 20), numberPlaceholder: text(raw.numberPlaceholder, 60),
        numberBreakpoints: breakpoints,
      });
    }
  }
  return steps;
}

function sanitizeQuizExperience(raw: Record<string, unknown>): Stage3QuizExperience | null {
  const outcomes = sanitizeQuizOutcomes(raw.outcomes);
  if (outcomes.length < 2) return null;
  const steps = sanitizeQuizSteps(raw.steps, outcomes.length);
  if (steps.length < 1) return null;
  const intro = text(raw.intro, 160);
  const actionLabel = text(raw.actionLabel, 40);
  if (!intro || !actionLabel) return null;
  return { kind: "quiz", intro, actionLabel, steps, outcomes };
}

function sanitizeExplorerExperience(raw: Record<string, unknown>): Stage3ExplorerExperience | null {
  const cards: Stage3ExplorerCard[] = [];
  for (const entry of (Array.isArray(raw.cards) ? raw.cards : []).slice(0, 8)) {
    const cardRaw = record(entry);
    if (!cardRaw) continue;
    const label = text(cardRaw.label, 60);
    const revealTitle = text(cardRaw.revealTitle, 80);
    const revealBody = text(cardRaw.revealBody, 500);
    if (!label || !revealTitle || !revealBody) continue;
    const beforeText = text(cardRaw.beforeText, 260);
    const afterText = text(cardRaw.afterText, 260);
    cards.push({
      id: slug(cardRaw.id, 40) || `card-${cards.length + 1}`,
      label,
      emoji: text(cardRaw.emoji, 8) || "✨",
      revealTitle,
      revealBody,
      beforeLabel: beforeText ? text(cardRaw.beforeLabel, 40) : "",
      beforeText,
      afterLabel: afterText ? text(cardRaw.afterLabel, 40) : "",
      afterText,
    });
  }
  if (cards.length < 2) return null;
  const intro = text(raw.intro, 160);
  if (!intro) return null;
  return { kind: "explorer", intro, cards };
}

function sanitizeExperience(value: unknown): Stage3Experience | null {
  const raw = record(value);
  if (!raw) return null;
  if (raw.kind === "explorer") return sanitizeExplorerExperience(raw);
  return sanitizeQuizExperience(raw);
}

function sanitizeStorySection(raw: Record<string, unknown>): Stage3StorySection | null {
  const title = text(raw.title, 100);
  const body = text(raw.body, 700);
  if (!title || !body) return null;
  return { kind: "story", title, body };
}

function sanitizeShowcaseSection(raw: Record<string, unknown>): Stage3ShowcaseSection | null {
  const title = text(raw.title, 100);
  const body = text(raw.body, 400);
  if (!title || !body) return null;
  const items: Stage3ShowcaseItem[] = [];
  for (const entry of (Array.isArray(raw.items) ? raw.items : []).slice(0, 6)) {
    const itemRaw = record(entry);
    if (!itemRaw) continue;
    const itemTitle = text(itemRaw.title, 90);
    const itemBody = text(itemRaw.body, 280);
    if (itemTitle && itemBody) items.push({ title: itemTitle, body: itemBody, visualPrompt: text(itemRaw.visualPrompt, 200) });
  }
  if (items.length < 2) return null;
  return { kind: "showcase", title, body, items };
}

function sanitizeStatsSection(raw: Record<string, unknown>): Stage3StatsSection | null {
  const title = text(raw.title, 100);
  const body = text(raw.body, 400);
  if (!title || !body) return null;
  const stats: Stage3StatItem[] = [];
  for (const entry of (Array.isArray(raw.stats) ? raw.stats : []).slice(0, 6)) {
    const statRaw = record(entry);
    if (!statRaw) continue;
    const value = text(statRaw.value, 24);
    const label = text(statRaw.label, 60);
    if (value && label) stats.push({ value, label });
  }
  if (stats.length < 2) return null;
  return { kind: "stats", title, body, stats };
}

function sanitizeProcessSection(raw: Record<string, unknown>): Stage3ProcessSection | null {
  const title = text(raw.title, 100);
  const body = text(raw.body, 400);
  if (!title || !body) return null;
  const steps: Stage3ProcessStep[] = [];
  for (const entry of (Array.isArray(raw.steps) ? raw.steps : []).slice(0, 6)) {
    const stepRaw = record(entry);
    if (!stepRaw) continue;
    const stepTitle = text(stepRaw.title, 80);
    const stepBody = text(stepRaw.body, 260);
    if (stepTitle && stepBody) steps.push({ title: stepTitle, body: stepBody });
  }
  if (steps.length < 2) return null;
  return { kind: "process", title, body, steps };
}

function sanitizeCompareSection(raw: Record<string, unknown>): Stage3CompareSection | null {
  const title = text(raw.title, 100);
  const body = text(raw.body, 400);
  const leftLabel = text(raw.leftLabel, 60);
  const leftBody = text(raw.leftBody, 320);
  const rightLabel = text(raw.rightLabel, 60);
  const rightBody = text(raw.rightBody, 320);
  if (!title || !body || !leftLabel || !leftBody || !rightLabel || !rightBody) return null;
  return { kind: "compare", title, body, leftLabel, leftBody, rightLabel, rightBody };
}

function sanitizeInteractiveSection(raw: Record<string, unknown>): Stage3InteractiveSection | null {
  const title = text(raw.title, 100);
  const body = text(raw.body, 300);
  if (!title || !body) return null;
  const experience = sanitizeExperience(raw.experience);
  if (!experience) return null;
  return { kind: "interactive", title, body, experience };
}

// Compatibility for Stage3 output stored before the current section-kind
// taxonomy existed. That earlier shape used `type` (not `kind`) as the
// section discriminator, with its own now-retired label set — confirmed
// against every project in the database still using it (2026-07-29 audit):
// "about" and "how_it_works" always carried an empty `items` array (pure
// title+body content), while "audience"/"activity"/"features" always carried
// >=2 `{title, body}` items, and "how_it_works" specifically was always a
// numbered, sequential list. This maps that shape onto current SectionKind
// so those existing generations keep rendering, without changing anything
// for current output (which always sets `kind` directly, never `type`).
const LEGACY_SECTION_TYPE_TO_KIND: Record<string, SectionKind> = {
  audience: "showcase",
  activity: "showcase",
  features: "showcase",
  how_it_works: "process",
};

function normalizeLegacySection(raw: Record<string, unknown>): Record<string, unknown> {
  if (typeof raw.kind === "string" || typeof raw.type !== "string") return raw;
  const items = Array.isArray(raw.items) ? raw.items : [];
  // No items to carry (e.g. the legacy "about" label) can only ever satisfy
  // "story", the one current kind that needs just a title and body.
  if (items.length === 0) return { ...raw, kind: "story" };
  const mappedKind = LEGACY_SECTION_TYPE_TO_KIND[raw.type] ?? "showcase";
  // "process" sections key their list as `steps`, not `items`.
  return mappedKind === "process" ? { ...raw, kind: mappedKind, steps: items } : { ...raw, kind: mappedKind };
}

// At most one "interactive" section survives — a second one is dropped
// rather than failing the whole output, since the experience is an optional
// embellishment, not the product itself.
function sanitizeSections(value: unknown): Stage3Section[] {
  const sections: Stage3Section[] = [];
  let hasInteractive = false;
  for (const entry of (Array.isArray(value) ? value : []).slice(0, 10)) {
    if (sections.length >= 7) break;
    const entryRaw = record(entry);
    if (!entryRaw) continue;
    const raw = normalizeLegacySection(entryRaw);
    let section: Stage3Section | null = null;
    if (raw.kind === "story") section = sanitizeStorySection(raw);
    else if (raw.kind === "showcase") section = sanitizeShowcaseSection(raw);
    else if (raw.kind === "stats") section = sanitizeStatsSection(raw);
    else if (raw.kind === "process") section = sanitizeProcessSection(raw);
    else if (raw.kind === "compare") section = sanitizeCompareSection(raw);
    else if (raw.kind === "interactive" && !hasInteractive) {
      section = sanitizeInteractiveSection(raw);
      if (section) hasInteractive = true;
    }
    if (section) sections.push(section);
  }
  return sections;
}

export function sanitizeStage3Output(value: unknown, expectedPreset?: V1Preset): Stage3ProjectOutput | null {
  const raw = record(value);
  if (!raw || !isV1Preset(raw.preset)) return null;
  const preset = raw.preset;
  if (expectedPreset && preset !== expectedPreset) return null;
  const identity = record(raw.identity);
  const visual = record(raw.visual);
  const hero = record(raw.hero);
  const cta = record(raw.cta);
  const form = record(raw.form);
  const launchCopy = record(raw.launchCopy);
  if (!identity || !visual || !hero || !cta || !form || !launchCopy) return null;

  const identityClean = {
    name: text(identity.name, 80),
    tagline: text(identity.tagline, 140),
    description: text(identity.description, 600),
  };
  const targetUser = text(raw.targetUser, 260);
  const primaryValue = text(raw.primaryValue, 420);
  const mood = text(visual.mood, 100);
  const styleNotes = text(visual.styleNotes, 320);
  const rawPalette = Array.isArray(visual.palette) ? visual.palette : [];
  const validPalette = rawPalette.slice(0, 3).map((color) => text(color, 7)).filter((color) => /^#[0-9a-f]{6}$/i.test(color));
  const palette = validPalette.length === 3 ? validPalette as [string, string, string] : DEFAULT_PALETTES[preset];
  const theme: OutputTheme = (OUTPUT_THEMES as readonly string[]).includes(visual.theme as string)
    ? visual.theme as OutputTheme
    : "minimal";
  const heroVisualKind: HeroVisualKind = (HERO_VISUAL_KINDS as readonly string[]).includes(hero.visualKind as string)
    ? hero.visualKind as HeroVisualKind
    : "image";
  const heroClean = {
    eyebrow: text(hero.eyebrow, 80),
    headline: text(hero.headline, 160),
    subheadline: text(hero.subheadline, 420),
    visualKind: heroVisualKind,
    visualPrompt: text(hero.visualPrompt, 200),
  };
  if (
    !identityClean.name || !identityClean.tagline || !identityClean.description
    || !targetUser || !primaryValue || !mood || !styleNotes
    || !heroClean.headline || !heroClean.subheadline
  ) return null;

  const sections = sanitizeSections(raw.sections);
  if (sections.length < 3) return null;

  const action = typeof cta.action === "string" ? cta.action as OutputCtaAction : "join";
  if (!COMPATIBLE_ACTIONS[preset].includes(action)) return null;
  const ctaClean = { label: text(cta.label, 80), action, supportingText: text(cta.supportingText, 220) };
  if (!ctaClean.label || !ctaClean.supportingText) return null;

  const fields: Stage3OutputField[] = [];
  const seen = new Set<string>();
  for (const entry of (Array.isArray(form.fields) ? form.fields : []).slice(0, 5)) {
    const field = record(entry);
    if (!field || typeof field.type !== "string" || !(OUTPUT_FIELD_TYPES as readonly string[]).includes(field.type)) continue;
    const id = slug(field.id, 40);
    const label = text(field.label, 80);
    if (!id || !label || seen.has(id)) continue;
    seen.add(id);
    const options = field.type === "select"
      ? (Array.isArray(field.options) ? field.options : []).slice(0, 5).map((option) => text(option, 80)).filter(Boolean)
      : [];
    if (field.type === "select" && options.length < 2) continue;
    fields.push({ id, label, type: field.type as OutputFieldType, required: field.required === true, options });
  }
  const formClean = {
    title: text(form.title, 100),
    description: text(form.description, 300),
    submitLabel: text(form.submitLabel, 80),
    fields,
  };
  if (!formClean.title || !formClean.description || !formClean.submitLabel || fields.length < 2) return null;

  const launch = {
    headline: text(launchCopy.headline, 140),
    body: text(launchCopy.body, 700),
    shortPost: text(launchCopy.shortPost, 500),
  };
  if (!launch.headline || !launch.body || !launch.shortPost) return null;

  return {
    version: STAGE3_VERSION,
    preset,
    identity: identityClean,
    targetUser,
    primaryValue,
    visual: { mood, palette, styleNotes, theme },
    hero: heroClean,
    sections,
    cta: ctaClean,
    form: formClean,
    launchCopy: launch,
  };
}

export function parseStage3ProjectState(snapshotFields: unknown): Stage3ProjectState | null {
  const snapshot = record(snapshotFields);
  const raw = record(snapshot?.stage3);
  if (!raw || raw.kind !== "stage3" || raw.version !== STAGE3_VERSION) return null;
  const sessionId = text(raw.sessionId, 80);
  const conversationId = text(raw.conversationId, 80);
  if (!sessionId || !conversationId || !(STAGE3_STATUSES as readonly unknown[]).includes(raw.status)) return null;
  const direction = sanitizeCreationDirection(raw.direction);
  const output = sanitizeStage3Output(raw.output, direction?.projectType);
  return {
    version: STAGE3_VERSION,
    kind: "stage3",
    sessionId,
    status: raw.status as Stage3Status,
    startingPoint: isStartingPoint(raw.startingPoint) ? raw.startingPoint : null,
    conversationId,
    lastRequestId: typeof raw.lastRequestId === "string" ? raw.lastRequestId.slice(0, 80) : null,
    turn: sanitizeCreationTurn(raw.turn),
    direction,
    output,
  };
}

export function mergeStage3ProjectState(snapshotFields: unknown, stage3: Stage3ProjectState): Record<string, unknown> {
  const snapshot = record(snapshotFields) ?? {};
  return { ...snapshot, stage3 };
}
