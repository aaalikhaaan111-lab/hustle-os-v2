import {
  isStartingPoint,
  isV1Preset,
  sanitizeCreationDirection,
  sanitizeCreationTurn,
  type CreationDirection,
  type CreationStartingPoint,
  type CreationTurn,
  type V1Preset,
} from "@/lib/build/creationTypes";

export const STAGE3_VERSION = 1 as const;
export const STAGE3_STATUSES = ["exploring", "shaping", "proposed", "ready", "first_version_ready"] as const;
export type Stage3Status = (typeof STAGE3_STATUSES)[number];

export const OUTPUT_SECTION_TYPES = ["about", "audience", "offer", "activity", "content", "features", "how_it_works"] as const;
export type OutputSectionType = (typeof OUTPUT_SECTION_TYPES)[number];
export const OUTPUT_CTA_ACTIONS = ["join", "request", "contact", "follow", "subscribe", "waitlist", "feedback"] as const;
export type OutputCtaAction = (typeof OUTPUT_CTA_ACTIONS)[number];
export const OUTPUT_FIELD_TYPES = ["text", "email", "textarea", "select"] as const;
export type OutputFieldType = (typeof OUTPUT_FIELD_TYPES)[number];

export interface Stage3OutputItem { title: string; body: string }
export interface Stage3OutputSection {
  type: OutputSectionType;
  title: string;
  body: string;
  items: Stage3OutputItem[];
}
export interface Stage3OutputField {
  id: string;
  label: string;
  type: OutputFieldType;
  required: boolean;
  options: string[];
}
export interface Stage3ProjectOutput {
  version: 1;
  preset: V1Preset;
  identity: { name: string; tagline: string; description: string };
  targetUser: string;
  primaryValue: string;
  visual: { mood: string; palette: [string, string, string]; styleNotes: string };
  hero: { eyebrow: string; headline: string; subheadline: string };
  sections: Stage3OutputSection[];
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

const COMPATIBLE_SECTIONS: Record<V1Preset, readonly OutputSectionType[]> = {
  community_social: ["about", "audience", "activity", "how_it_works"],
  service: ["about", "audience", "offer", "how_it_works"],
  content_media: ["about", "audience", "content", "how_it_works"],
  digital_product: ["about", "audience", "features", "how_it_works"],
};

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

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
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
  const heroClean = {
    eyebrow: text(hero.eyebrow, 80),
    headline: text(hero.headline, 160),
    subheadline: text(hero.subheadline, 420),
  };
  if (!identityClean.name || !identityClean.tagline || !identityClean.description || !targetUser || !primaryValue || !mood || !styleNotes || !heroClean.headline || !heroClean.subheadline) return null;

  const allowedSections = COMPATIBLE_SECTIONS[preset];
  const sections: Stage3OutputSection[] = [];
  for (const entry of (Array.isArray(raw.sections) ? raw.sections : []).slice(0, 6)) {
    const section = record(entry);
    if (!section || typeof section.type !== "string" || !allowedSections.includes(section.type as OutputSectionType)) continue;
    const title = text(section.title, 100);
    const body = text(section.body, 600);
    if (!title || !body) continue;
    const items: Stage3OutputItem[] = [];
    for (const itemValue of (Array.isArray(section.items) ? section.items : []).slice(0, 4)) {
      const item = record(itemValue);
      if (!item) continue;
      const itemTitle = text(item.title, 100);
      const itemBody = text(item.body, 320);
      if (itemTitle && itemBody) items.push({ title: itemTitle, body: itemBody });
    }
    sections.push({ type: section.type as OutputSectionType, title, body, items });
  }
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
    const id = text(field.id, 40).toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-");
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
    visual: { mood, palette, styleNotes },
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
