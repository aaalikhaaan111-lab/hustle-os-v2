"use server";

import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/locale";
import { createClient } from "@/lib/supabase/server";
import {
  CREATION_LIMITS,
  isStartingPoint,
  sanitizeCreationDirection,
  sanitizeCreationTurn,
  startingStageFor,
  type CreationDirection,
  type CreationMessage,
  type CreationStartingPoint,
  type CreationTurn,
  type PersistedCreationDraft,
  V1_PRESETS,
} from "@/lib/build/creationTypes";
import {
  STAGE3_VERSION,
  mergeStage3ProjectState,
  parseStage3ProjectState,
  type Stage3ProjectState,
} from "@/lib/build/stage3Types";

const TOKEN_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CREATION_SCHEMA = {
  type: "object",
  properties: {
    phase: { type: "string", enum: ["ask", "propose"] },
    message: { type: "string" },
    choices: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" }, title: { type: "string" }, description: { type: "string" } },
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
          name: { type: "string" }, concept: { type: "string" }, forWho: { type: "string" },
          creates: { type: "string" }, whyFits: { type: "string" },
          projectType: { type: "string", enum: [...V1_PRESETS] }, problem: { type: "string" },
          audience: { type: "string" }, niche: { type: "string" },
        },
        required: ["name", "concept", "forWho", "creates", "whyFits", "projectType", "problem", "audience", "niche"],
        additionalProperties: false,
      },
    },
  },
  required: ["phase", "message", "choices", "choiceMode", "transition", "directions"],
  additionalProperties: false,
};

function creationSystemPrompt(locale: Locale | string): string {
  const language = locale === "ru" ? "Russian" : "English";
  return `You are Ventrio's project creation guide. A young person just told you what they care about. Your only job is to understand them, narrow the possibilities, and propose a realistic project Ventrio can create. Never lecture, give homework, or provide a plan.

- Be warm, concrete, and short. Ask one question at a time.
- Never re-ask something already known. Prefer human questions over business jargon.
- Use only 2-4 meaningful user interactions before proposing. If the opening already includes an interest/skill plus a medium or audience clue, ask at most one focused question.
- For "ask", include 3-5 contextual choices whenever common answers exist. Use "multiple" only when combining answers helps. Leave directions empty.
- If the user is unsure, offer evocative discovery choices instead of asking them to list interests.
- For "propose", return 2-3 realistic directions and no choices. Each direction needs a memorable non-placeholder name, a one-sentence concept, specific audience, concrete first thing Ventrio will create, a grounded reason it fits, problem/desire, short niche, and exactly one preset: community_social, service, content_media, or digital_product.
- Use transition "focus" only when narrowing and "reveal" only for proposals.
- Match the person's skill, reachable people, time, and ability. Never invent traction or results.

Write every user-visible field in ${language}. Respond only with the requested JSON.`;
}

function stableUuid(seed: string): string {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function draftName(locale: string): string {
  return locale === "ru" ? "Исследуем идею" : "Exploring an idea";
}

function newStage3State(sessionId: string, conversationId: string, point: CreationStartingPoint | null): Stage3ProjectState {
  return {
    version: STAGE3_VERSION,
    kind: "stage3",
    sessionId,
    status: "exploring",
    startingPoint: point,
    conversationId,
    lastRequestId: null,
    turn: null,
    direction: null,
    output: null,
  };
}

function logAiUsage(operation: "creation_discovery", startedAt: number, response: Anthropic.Message) {
  console.info("[ventrio-ai-usage]", JSON.stringify({
    operation,
    model: response.model,
    durationMs: Date.now() - startedAt,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  }));
}

export interface EnsureCreationDraftResult {
  error: string | null;
  projectId: string | null;
  conversationId: string | null;
  sessionId: string | null;
}

export async function ensureCreationDraftAction(
  sessionId: string,
  startingPoint: string | null,
): Promise<EnsureCreationDraftResult> {
  const t = await getTranslations("create");
  const locale = await getLocale();
  const fail = (error: string): EnsureCreationDraftResult => ({ error, projectId: null, conversationId: null, sessionId: null });
  if (!TOKEN_PATTERN.test(sessionId)) return fail(t("errorInvalid"));
  const point = isStartingPoint(startingPoint) ? startingPoint : null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail(t("errorSession"));

  const projectId = stableUuid(`${user.id}:ventrio-creation:${sessionId}`);
  const conversationId = stableUuid(`${projectId}:creation-conversation-v1`);
  const { data: existing } = await supabase
    .from("projects")
    .select("id, snapshot_fields")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  let stage3 = parseStage3ProjectState(existing?.snapshot_fields);
  if (!existing) {
    stage3 = newStage3State(sessionId, conversationId, point);
    const { error } = await supabase.from("projects").insert({
      id: projectId,
      user_id: user.id,
      name: draftName(locale),
      project_type: "digital_product",
      niche: locale === "ru" ? "новая идея" : "new idea",
      starting_stage: startingStageFor(point),
      intended_outcome: "first_version",
      time_availability: "2_4h",
      pathway_mode: "standard",
      locale,
      snapshot_fields: { stage3 },
    });
    if (error && error.code !== "23505") return fail(t("errorSaveFailed"));
  } else if (!stage3 || stage3.sessionId !== sessionId || stage3.output) {
    return fail(t("errorInvalid"));
  } else if (!stage3.startingPoint && point) {
    stage3 = { ...stage3, startingPoint: point };
    await supabase.from("projects").update({
      starting_stage: startingStageFor(point),
      snapshot_fields: mergeStage3ProjectState(existing.snapshot_fields, stage3),
    }).eq("id", projectId).eq("user_id", user.id);
  }

  const { error: conversationError } = await supabase.from("project_ai_conversations").insert({
    id: conversationId,
    project_id: projectId,
    user_id: user.id,
    title: "ventrio:create:v1",
  });
  if (conversationError && conversationError.code !== "23505") return fail(t("errorSaveFailed"));

  revalidatePath("/projects");
  return { error: null, projectId, conversationId, sessionId };
}

export async function loadCreationDraftAction(): Promise<PersistedCreationDraft | null> {
  const locale = await getLocale();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, locale, snapshot_fields, updated_at")
    .eq("user_id", user.id)
    .eq("intended_outcome", "first_version")
    .is("current_stage", null)
    .eq("progress", 0)
    .order("updated_at", { ascending: false })
    .limit(30);
  const project = (projects ?? []).find((candidate) => {
    const state = parseStage3ProjectState(candidate.snapshot_fields);
    return candidate.locale === locale && state !== null && state.status !== "first_version_ready" && state.output === null;
  });
  if (!project) return null;
  const stage3 = parseStage3ProjectState(project.snapshot_fields);
  if (!stage3) return null;
  const { data: messages } = await supabase
    .from("project_ai_messages")
    .select("id, role, content")
    .eq("conversation_id", stage3.conversationId)
    .eq("project_id", project.id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  return {
    projectId: project.id,
    conversationId: stage3.conversationId,
    sessionId: stage3.sessionId,
    projectName: project.name || draftName(locale),
    messages: (messages ?? []).map((message) => ({ id: message.id, role: message.role, content: message.content })),
    turn: stage3.turn,
    startingPoint: stage3.startingPoint,
  };
}

export type CreationTurnResult =
  | { ok: true; turn: CreationTurn; projectName: string }
  | { ok: false; unavailable: boolean };

export async function generateCreationTurnAction(
  projectId: string,
  conversationId: string,
  requestId: string,
  content: string,
): Promise<CreationTurnResult> {
  if (!UUID_PATTERN.test(projectId) || !UUID_PATTERN.test(conversationId) || !TOKEN_PATTERN.test(requestId)) {
    return { ok: false, unavailable: true };
  }
  const message = content.trim().slice(0, CREATION_LIMITS.message);
  if (!message) return { ok: false, unavailable: true };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, unavailable: true };
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, locale, snapshot_fields")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  const stage3 = parseStage3ProjectState(project?.snapshot_fields);
  if (!project || !stage3 || stage3.conversationId !== conversationId || stage3.output) return { ok: false, unavailable: true };
  const locale = project.locale;
  const { data: conversation } = await supabase
    .from("project_ai_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!conversation) return { ok: false, unavailable: true };

  const userMessageId = stableUuid(`${conversationId}:user:${requestId}`);
  const assistantMessageId = stableUuid(`${conversationId}:assistant:${requestId}`);
  if (stage3.lastRequestId === requestId && stage3.turn) {
    return { ok: true, turn: stage3.turn, projectName: project.name || draftName(locale) };
  }
  const { data: latestRows } = await supabase
    .from("project_ai_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);
  const pendingMessageAlreadySaved = latestRows?.[0]?.role === "user" && latestRows[0].content === message;
  if (!pendingMessageAlreadySaved) {
    const { error: messageError } = await supabase.from("project_ai_messages").insert({
      id: userMessageId,
      conversation_id: conversationId,
      project_id: projectId,
      user_id: user.id,
      role: "user",
      content: message,
    });
    if (messageError && messageError.code !== "23505") return { ok: false, unavailable: true };
  }

  const { data: recentRows } = await supabase
    .from("project_ai_messages")
    .select("role, content, created_at")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  const history: CreationMessage[] = (recentRows ?? []).reverse().map((row) => ({ role: row.role, content: row.content }));
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, unavailable: true };

  try {
    const startedAt = Date.now();
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1500,
      output_config: { effort: "low", format: { type: "json_schema", schema: CREATION_SCHEMA } },
      system: creationSystemPrompt(locale),
      messages: history.map((entry) => ({ role: entry.role, content: entry.content })),
    });
    logAiUsage("creation_discovery", startedAt, response);
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") return { ok: false, unavailable: true };
    const turn = sanitizeCreationTurn(JSON.parse(textBlock.text));
    if (!turn) return { ok: false, unavailable: true };
    const firstDirection = turn.phase === "propose" ? turn.directions[0] : null;
    const nextState: Stage3ProjectState = {
      ...stage3,
      status: firstDirection ? "proposed" : "shaping",
      lastRequestId: requestId,
      turn,
    };
    const nextName = firstDirection?.name ?? project.name ?? draftName(locale);
    const snapshot = mergeStage3ProjectState(project.snapshot_fields, nextState);
    if (firstDirection) {
      snapshot.solution = firstDirection.concept;
      snapshot.problem = firstDirection.problem;
      snapshot.audience = firstDirection.audience;
    }
    const { error: updateError } = await supabase.from("projects").update({
      name: nextName,
      ...(firstDirection ? {
        project_type: firstDirection.projectType,
        niche: firstDirection.niche,
        target_audience: firstDirection.audience,
      } : {}),
      snapshot_fields: snapshot,
    }).eq("id", projectId).eq("user_id", user.id);
    if (updateError) return { ok: false, unavailable: true };
    const { error: assistantError } = await supabase.from("project_ai_messages").insert({
      id: assistantMessageId,
      conversation_id: conversationId,
      project_id: projectId,
      user_id: user.id,
      role: "assistant",
      content: turn.message,
    });
    if (assistantError && assistantError.code !== "23505") return { ok: false, unavailable: true };
    await supabase.from("project_ai_conversations").update({ title: message.slice(0, 60) }).eq("id", conversationId).eq("user_id", user.id);
    revalidatePath("/projects");
    return { ok: true, turn, projectName: nextName };
  } catch (error) {
    console.error("[ventrio-ai-error]", JSON.stringify({ operation: "creation_discovery", projectId, message: error instanceof Error ? error.message : "unknown" }));
    return { ok: false, unavailable: true };
  }
}

const PLACEHOLDER_NAMES = new Set(["untitled", "untitled project", "my project", "new project", "project", "без названия", "проект без названия", "мой проект", "новый проект", "проект"]);

function meaningfulProjectName(direction: CreationDirection): string {
  const supplied = direction.name.trim().slice(0, CREATION_LIMITS.name);
  if (supplied.length >= 2 && !PLACEHOLDER_NAMES.has(supplied.toLocaleLowerCase())) return supplied;
  const lead = direction.concept.split(/[.!?\n:—–-]/, 1)[0].trim().split(/\s+/).slice(0, 6).join(" ").slice(0, CREATION_LIMITS.name);
  return lead.length >= 2 ? lead.charAt(0).toLocaleUpperCase() + lead.slice(1) : "Ventrio Project";
}

export async function selectCreationDirectionAction(
  projectId: string,
  directionValue: CreationDirection,
  startingPoint: string | null,
): Promise<{ error: string | null; projectId?: string }> {
  const t = await getTranslations("create");
  if (!UUID_PATTERN.test(projectId)) return { error: t("errorInvalid") };
  const direction = sanitizeCreationDirection(directionValue);
  if (!direction) return { error: t("errorInvalid") };
  const point = isStartingPoint(startingPoint) ? startingPoint : null;
  const locale = await getLocale();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: t("errorSession") };
  const { data: project } = await supabase
    .from("projects")
    .select("id, snapshot_fields")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  const stage3 = parseStage3ProjectState(project?.snapshot_fields);
  if (!project || !stage3 || stage3.output) return { error: t("errorInvalid") };
  const cleanDirection = { ...direction, name: meaningfulProjectName(direction) };
  const nextState: Stage3ProjectState = { ...stage3, status: "ready", startingPoint: point ?? stage3.startingPoint, direction: cleanDirection };
  const snapshot = mergeStage3ProjectState(project.snapshot_fields, nextState);
  snapshot.solution = cleanDirection.concept;
  snapshot.problem = cleanDirection.problem;
  snapshot.audience = cleanDirection.audience;
  const { error } = await supabase.from("projects").update({
    name: cleanDirection.name,
    project_type: cleanDirection.projectType,
    niche: cleanDirection.niche,
    starting_stage: startingStageFor(point),
    target_audience: cleanDirection.audience,
    snapshot_fields: snapshot,
  }).eq("id", projectId).eq("user_id", user.id);
  if (error) return { error: t("errorSaveFailed") };
  const summary = locale === "ru"
    ? `Направление: ${cleanDirection.name}. ${cleanDirection.concept} Для кого: ${cleanDirection.forWho}. Первая версия: ${cleanDirection.creates}`
    : `Direction: ${cleanDirection.name}. ${cleanDirection.concept} For: ${cleanDirection.forWho}. First version: ${cleanDirection.creates}`;
  await supabase.from("project_ai_memory").upsert({ project_id: projectId, user_id: user.id, summary }, { onConflict: "project_id" });
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  return { error: null, projectId };
}

export async function discardCreationDraftAction(projectId: string): Promise<{ error: string | null }> {
  const t = await getTranslations("create");
  if (!UUID_PATTERN.test(projectId)) return { error: t("errorInvalid") };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: t("errorSession") };
  const { data: project } = await supabase
    .from("projects")
    .select("id, snapshot_fields")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  const stage3 = parseStage3ProjectState(project?.snapshot_fields);
  if (!project || !stage3 || stage3.output) return { error: t("errorInvalid") };
  const { error } = await supabase.from("projects").delete().eq("id", projectId).eq("user_id", user.id);
  if (error) return { error: t("errorSaveFailed") };
  revalidatePath("/projects");
  return { error: null };
}
