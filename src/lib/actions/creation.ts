"use server";

import Anthropic from "@anthropic-ai/sdk";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/locale";
import { createClient } from "@/lib/supabase/server";
import {
  CREATION_LIMITS,
  isV1Preset,
  isStartingPoint,
  startingStageFor,
  type CreationChoice,
  type CreationDirection,
  type CreationMessage,
  type CreationStartingPoint,
  type CreationTurn,
  V1_PRESETS,
} from "@/lib/build/creationTypes";

// ============================================================================
// Creation AI — one structured turn
// ============================================================================

const CREATION_SCHEMA = {
  type: "object",
  properties: {
    phase: { type: "string", enum: ["ask", "propose"] },
    message: { type: "string" },
    choices: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
        },
        required: ["id", "title", "description"],
        additionalProperties: false,
      },
    },
    choiceMode: { type: "string", enum: ["single", "multiple"] },
    transition: { type: "string", enum: ["none", "focus", "reveal"] },
    directions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          concept: { type: "string" },
          forWho: { type: "string" },
          creates: { type: "string" },
          whyFits: { type: "string" },
          projectType: { type: "string", enum: [...V1_PRESETS] },
          problem: { type: "string" },
          audience: { type: "string" },
          niche: { type: "string" },
        },
        required: [
          "name", "concept", "forWho", "creates", "whyFits",
          "projectType", "problem", "audience", "niche",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["phase", "message", "choices", "choiceMode", "transition", "directions"],
  additionalProperties: false,
};

function creationSystemPrompt(locale: Locale | string): string {
  const language = locale === "ru" ? "Russian" : "English";
  return `You are Ventrio's project creation guide. A young person just told you what they care about. Your ONLY job is: understand them, narrow the possibilities, and propose a realistic project you will then help them create. You are not a mentor, a teacher, or a general chatbot. You never lecture, never give "research the market" advice, and never write essays.

HOW YOU TALK
- Warm, concrete, and SHORT. Ask ONE question at a time. Never a wall of text.
- Adapt to what they already said; never re-ask something you can infer.
- Prefer concrete human questions ("Who could you show this to this week?") over jargon ("Who is your target market?").
- Usually you need only 2–4 meaningful user interactions before proposing directions. If the opening message already contains an interest/skill and a medium or audience clue, ask at most one focused question before proposing.

CHOOSE A PHASE EACH TURN
- "ask": you still need ONE key thing (what they enjoy or can do, who they can realistically reach, or the specific problem). Put your one short question in "message". When common answers exist, ALWAYS offer 3–5 contextual choices. Each choice needs a stable lowercase id, a short title, and an optional one-line description (use an empty string when no description helps). Choose "single" normally and "multiple" only when combining answers genuinely helps. Leave "directions" empty.
- "propose": you have enough. Put a one-line lead-in such as "I see three directions worth building." in "message" and 2–3 (never more, never fewer than 2) realistic directions in "directions". Leave "choices" empty and use "single".
- If the user is unsure, do not answer with only "tell me your interests". Make discovery easier with broad but evocative choices such as making things people watch, helping someone improve, building a useful tool, bringing people together, or exploring how something works. Narrow once, then propose.
- transition describes how the native UI should settle: "none" for an ordinary question, "focus" when the question narrows a promising theme, and "reveal" only with proposed directions.

EVERY DIRECTION MUST BE REALISTIC FOR THIS PERSON: match their skill, the people they can actually reach, their time, and their ability to make a first version. Make ambitious ideas smaller and executable — never "the next Uber for X". Never invent facts about them or their results.

For each direction:
- name: a short, real project name.
- concept: ONE sentence on what it is.
- forWho: the specific target user.
- creates: the concrete first thing Ventrio will make (a page, an offer, a community, content, a form, launch materials) — no builder jargon.
- whyFits: ONE short personalized reason grounded in what they told you.
- projectType: the single best-fit preset — one of exactly: community_social, service, content_media, digital_product.
- problem: the core problem or desire, one sentence.
- audience: the target audience, a few words.
- niche: a 1–3 word topic tag.

Never use placeholder names such as "Untitled project", "My project", or their translated equivalents. Every direction needs a concise, memorable name grounded in its concept.

Write ALL user-visible text (message, choice titles/descriptions, and every direction field) in ${language}. Respond only with the requested JSON.`;
}

export type CreationTurnResult =
  | { ok: true; turn: CreationTurn }
  | { ok: false; unavailable: boolean };

function sanitizeTurn(parsed: unknown): CreationTurn | null {
  if (!parsed || typeof parsed !== "object") return null;
  const c = parsed as Record<string, unknown>;
  if (c.phase !== "ask" && c.phase !== "propose") return null;
  const message = typeof c.message === "string" ? c.message.trim() : "";
  if (message.length === 0) return null;

  const rawChoices = Array.isArray(c.choices) ? c.choices : [];
  const choices: CreationChoice[] = [];
  const usedChoiceIds = new Set<string>();
  for (const entry of rawChoices.slice(0, 6)) {
    if (!entry || typeof entry !== "object") continue;
    const choice = entry as Record<string, unknown>;
    const rawId = typeof choice.id === "string" ? choice.id.trim().toLowerCase() : "";
    const id = rawId.replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, CREATION_LIMITS.choiceId);
    const title = typeof choice.title === "string" ? choice.title.trim().slice(0, CREATION_LIMITS.choiceTitle) : "";
    const description = typeof choice.description === "string"
      ? choice.description.trim().slice(0, CREATION_LIMITS.choiceDescription)
      : "";
    if (!id || !title || usedChoiceIds.has(id)) continue;
    usedChoiceIds.add(id);
    choices.push(description ? { id, title, description } : { id, title });
  }

  const rawDirections = Array.isArray(c.directions) ? c.directions : [];
  const directions: CreationDirection[] = [];
  for (const entry of rawDirections) {
    if (!entry || typeof entry !== "object") continue;
    const d = entry as Record<string, unknown>;
    const str = (v: unknown, cap: number) => (typeof v === "string" ? v.trim().slice(0, cap) : "");
    const name = str(d.name, CREATION_LIMITS.name);
    const concept = str(d.concept, CREATION_LIMITS.text);
    const forWho = str(d.forWho, CREATION_LIMITS.text);
    const creates = str(d.creates, CREATION_LIMITS.text);
    const whyFits = str(d.whyFits, CREATION_LIMITS.text);
    const problem = str(d.problem, CREATION_LIMITS.text);
    const audience = str(d.audience, CREATION_LIMITS.audience);
    const niche = str(d.niche, CREATION_LIMITS.niche);
    if (!isV1Preset(d.projectType)) continue;
    if (!name || !concept || !forWho || !creates || !whyFits || !problem || !audience) continue;
    directions.push({ name, concept, forWho, creates, whyFits, projectType: d.projectType, problem, audience, niche: niche || "other" });
  }

  if (c.phase === "propose") {
    // A propose turn is only valid with 2–3 real directions.
    if (directions.length < 2) return null;
    return {
      phase: "propose",
      message,
      choices: [],
      choiceMode: "single",
      directions: directions.slice(0, 3),
      transition: "reveal",
    };
  }
  return {
    phase: "ask",
    message,
    choices,
    choiceMode: c.choiceMode === "multiple" ? "multiple" : "single",
    directions: [],
    transition: c.transition === "focus" ? "focus" : "none",
  };
}

/**
 * One structured turn of the creation conversation. Stateless: the client sends
 * the running history and gets back either a follow-up question (with optional
 * chips) or 2–3 proposed directions. Returns `unavailable` (never a fake reply)
 * when the API key is missing or the model fails/validation fails.
 */
export async function generateCreationTurnAction(
  history: CreationMessage[],
  locale: Locale | string
): Promise<CreationTurnResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, unavailable: true };

  // Basic shape/size guardrails on the client-supplied history.
  const clean: CreationMessage[] = (Array.isArray(history) ? history : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim().length > 0)
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, CREATION_LIMITS.message) }));

  if (clean.length === 0) return { ok: false, unavailable: true };
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, unavailable: true };

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1500,
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: CREATION_SCHEMA },
      },
      system: creationSystemPrompt(locale),
      messages: clean.map((m) => ({ role: m.role, content: m.content })),
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") return { ok: false, unavailable: true };

    const turn = sanitizeTurn(JSON.parse(textBlock.text));
    if (!turn) return { ok: false, unavailable: true };
    return { ok: true, turn };
  } catch {
    return { ok: false, unavailable: true };
  }
}

// ============================================================================
// Create a project from a chosen direction (no roadmap — Stage 3 builds output)
// ============================================================================

export interface CreateFromDirectionResult {
  error: string | null;
  projectId?: string;
}

function compactCreationSummary(
  direction: CreationDirection,
  point: CreationStartingPoint | null,
  locale: string
): string {
  const isRu = locale === "ru";
  const startedFrom = point ?? "idea";
  return isRu
    ? `Проект создан в AI-режиме создания. Отправная точка: ${startedFrom}. Направление: ${direction.name} — ${direction.concept} Для кого: ${direction.forWho}. Проблема/желание: ${direction.problem} Почему подходит: ${direction.whyFits} Формат: ${direction.projectType}. Следующий шаг — создать первую версию.`
    : `Created via the AI creation flow. Starting point: ${startedFrom}. Direction: ${direction.name} — ${direction.concept} For: ${direction.forWho}. Problem/desire: ${direction.problem} Why it fits: ${direction.whyFits} Preset: ${direction.projectType}. Next step is to create the first version.`;
}

const PLACEHOLDER_PROJECT_NAMES = new Set([
  "untitled",
  "untitled project",
  "my project",
  "new project",
  "project",
  "без названия",
  "проект без названия",
  "мой проект",
  "новый проект",
  "проект",
]);

function meaningfulProjectName(rawName: unknown, concept: string): string {
  const supplied = typeof rawName === "string" ? rawName.trim().slice(0, CREATION_LIMITS.name) : "";
  if (supplied.length >= 2 && !PLACEHOLDER_PROJECT_NAMES.has(supplied.toLocaleLowerCase())) {
    return supplied;
  }

  const conceptLead = concept
    .split(/[.!?\n:—–-]/, 1)[0]
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join(" ")
    .slice(0, CREATION_LIMITS.name);

  if (conceptLead.length >= 2) {
    return conceptLead.charAt(0).toLocaleUpperCase() + conceptLead.slice(1);
  }
  return "Ventrio Project";
}

/**
 * Creates a real project from a user-chosen direction. Unlike the legacy
 * createProjectAction this does NOT generate a roadmap/tasks — the new-flow
 * workspace hands off to Stage 3's "Create first version". Ownership is taken
 * from the session (never the client); the preset is validated against the
 * allowlist; the direction's context is persisted into snapshot_fields + the
 * project memory (both best-effort so a missing column never blocks creation).
 */
export async function createProjectFromDirectionAction(
  direction: CreationDirection,
  opts: { startingPoint?: string | null } = {}
): Promise<CreateFromDirectionResult> {
  const t = await getTranslations("create");
  const locale = await getLocale();

  // Re-validate the client-supplied direction server-side.
  if (!direction || typeof direction !== "object" || !isV1Preset(direction.projectType)) {
    return { error: t("errorInvalid") };
  }
  const concept = (direction.concept ?? "").trim().slice(0, CREATION_LIMITS.text);
  const name = meaningfulProjectName(direction.name, concept);
  const forWho = (direction.forWho ?? "").trim().slice(0, CREATION_LIMITS.text);
  const creates = (direction.creates ?? "").trim().slice(0, CREATION_LIMITS.text);
  const whyFits = (direction.whyFits ?? "").trim().slice(0, CREATION_LIMITS.text);
  const problem = (direction.problem ?? "").trim().slice(0, CREATION_LIMITS.text);
  const audience = (direction.audience ?? "").trim().slice(0, CREATION_LIMITS.audience);
  const niche = (direction.niche ?? "").trim().slice(0, CREATION_LIMITS.niche) || "other";
  if (!concept || !forWho || !creates || !whyFits || !problem || !audience) {
    return { error: t("errorInvalid") };
  }

  const cleanDirection: CreationDirection = {
    ...direction,
    name,
    concept,
    forWho,
    creates,
    whyFits,
    problem,
    audience,
    niche,
  };

  const point: CreationStartingPoint | null = isStartingPoint(opts.startingPoint) ? opts.startingPoint : null;

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return { error: t("errorSession") };

  // Insert the project with the minimum fields Stage 3 needs. No tasks: a
  // new-flow project is intentionally roadmap-free (0 tasks is how the
  // workspace recognises it and offers "Create first version").
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name: cleanDirection.name,
      project_type: direction.projectType,
      niche,
      starting_stage: startingStageFor(point),
      target_audience: audience || null,
      intended_outcome: "first_version",
      time_availability: "2_4h",
      pathway_mode: "standard",
      locale,
    })
    .select("id")
    .single();

  if (projectError || !project) {
    return { error: t("errorSaveFailed") };
  }

  // Best-effort: persist the direction context so the workspace + mentor open
  // with it. A missing snapshot_fields column (unmigrated) must not fail
  // creation — the project is already saved.
  const snapshotFields: Record<string, string> = { solution: cleanDirection.concept };
  if (problem) snapshotFields.problem = problem;
  if (audience) snapshotFields.audience = audience;
  await supabase.from("projects").update({ snapshot_fields: snapshotFields }).eq("id", project.id);

  // Best-effort: seed the compact creation summary as the project's memory so
  // the Stage 3 mentor has authoritative context from turn one.
  await supabase
    .from("project_ai_memory")
    .upsert(
      { project_id: project.id, user_id: user.id, summary: compactCreationSummary(cleanDirection, point, locale) },
      { onConflict: "project_id" }
    );

  return { error: null, projectId: project.id };
}
