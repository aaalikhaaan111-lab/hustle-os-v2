"use server";

import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { V1_PRESETS } from "@/lib/build/creationTypes";
import {
  OUTPUT_CTA_ACTIONS,
  OUTPUT_FIELD_TYPES,
  OUTPUT_SECTION_TYPES,
  mergeStage3ProjectState,
  parseStage3ProjectState,
  sanitizeStage3Output,
  type Stage3ProjectOutput,
  type Stage3ProjectState,
} from "@/lib/build/stage3Types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/;

const OUTPUT_SCHEMA = {
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
        palette: { type: "array", minItems: 3, maxItems: 3, items: { type: "string" } },
        styleNotes: { type: "string" },
      },
      required: ["mood", "palette", "styleNotes"], additionalProperties: false,
    },
    hero: {
      type: "object",
      properties: { eyebrow: { type: "string" }, headline: { type: "string" }, subheadline: { type: "string" } },
      required: ["eyebrow", "headline", "subheadline"], additionalProperties: false,
    },
    sections: {
      type: "array", minItems: 3, maxItems: 6,
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: [...OUTPUT_SECTION_TYPES] },
          title: { type: "string" }, body: { type: "string" },
          items: {
            type: "array", maxItems: 4,
            items: {
              type: "object",
              properties: { title: { type: "string" }, body: { type: "string" } },
              required: ["title", "body"], additionalProperties: false,
            },
          },
        },
        required: ["type", "title", "body", "items"], additionalProperties: false,
      },
    },
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
          type: "array", minItems: 2, maxItems: 5,
          items: {
            type: "object",
            properties: {
              id: { type: "string" }, label: { type: "string" },
              type: { type: "string", enum: [...OUTPUT_FIELD_TYPES] }, required: { type: "boolean" },
              options: { type: "array", maxItems: 5, items: { type: "string" } },
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
  required: ["version", "preset", "identity", "targetUser", "primaryValue", "visual", "hero", "sections", "cta", "form", "launchCopy"],
  additionalProperties: false,
};

const EDIT_SCHEMA = {
  type: "object",
  properties: { message: { type: "string" }, output: OUTPUT_SCHEMA },
  required: ["message", "output"],
  additionalProperties: false,
};

function stableUuid(seed: string): string {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function outputPrompt(locale: string, edit = false): string {
  const language = locale === "ru" ? "Russian" : "English";
  return `You are Ventrio's structured first-version engine. ${edit ? "Edit the existing project output according to the user's latest request." : "Create a complete, visible first version from the chosen project direction."}

This is a real public-facing draft, not advice, a roadmap, or a plan. Write finished launch-ready copy in ${language}. Never mention that the user should research, validate, design, or build something later.

PRESET RULES
- community_social: sections may only be about, audience, activity, how_it_works; CTA action must be join; form is a join form; include the first activity/event concept and invitation copy.
- service: sections may only be about, audience, offer, how_it_works; CTA action is request or contact; form captures a service request; include offer, onboarding questions, and outreach-ready launch copy.
- content_media: sections may only be about, audience, content, how_it_works; CTA action is follow or subscribe; form captures a subscription or content interest; include initial content concepts.
- digital_product: sections may only be about, audience, features, how_it_works; CTA action is waitlist or feedback; form is a waitlist/feedback form; describe a focused first product experience, not a full SaaS.

SAFETY AND QUALITY
- Return only the requested JSON. Never output HTML, JavaScript, Markdown, URLs, or executable content.
- Use exactly three #RRGGBB palette colors.
- Keep the preset unchanged during edits. Preserve strong existing content unless the request requires changing it.
- Make every section concrete and internally consistent with the audience, value, CTA, and form.
- The identity name must be short and specific, never Untitled, New project, or a translated placeholder.`;
}

function logUsage(operation: "first_version_generation" | "project_output_edit", projectId: string, startedAt: number, response: Anthropic.Message) {
  console.info("[ventrio-ai-usage]", JSON.stringify({
    operation,
    projectId,
    model: response.model,
    durationMs: Date.now() - startedAt,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  }));
}

type Stage3Result = { error: string | null; output: Stage3ProjectOutput | null; reply: string | null; durationMs?: number };

async function ownedProject(projectId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, project: null, stage3: null };
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  return { supabase, user, project, stage3: parseStage3ProjectState(project?.snapshot_fields) };
}

export async function generateFirstVersionAction(projectId: string): Promise<Stage3Result> {
  const t = await getTranslations("stage3");
  if (!UUID_PATTERN.test(projectId)) return { error: t("errorInvalid"), output: null, reply: null };
  const { supabase, user, project, stage3 } = await ownedProject(projectId);
  if (!user) return { error: t("errorSession"), output: null, reply: null };
  if (!project || !stage3 || !stage3.direction) return { error: t("errorDirection"), output: null, reply: null };
  const locale = project.locale;
  if (stage3.output) return { error: null, output: stage3.output, reply: t("alreadyReady"), durationMs: 0 };
  if (!process.env.ANTHROPIC_API_KEY) return { error: t("unavailable"), output: null, reply: null };

  try {
    const startedAt = Date.now();
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 3600,
      output_config: { effort: "low", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
      system: outputPrompt(locale),
      messages: [{ role: "user", content: JSON.stringify({ direction: stage3.direction, projectLocale: locale }) }],
    });
    logUsage("first_version_generation", projectId, startedAt, response);
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") return { error: t("unavailable"), output: null, reply: null };
    const output = sanitizeStage3Output(JSON.parse(textBlock.text), stage3.direction.projectType);
    if (!output) return { error: t("unavailable"), output: null, reply: null };
    const nextState: Stage3ProjectState = { ...stage3, status: "first_version_ready", output };
    const snapshot = mergeStage3ProjectState(project.snapshot_fields, nextState);
    snapshot.solution = output.identity.description;
    snapshot.audience = output.targetUser;
    snapshot.first_version = output.primaryValue;
    const { error } = await supabase.from("projects").update({
      name: output.identity.name,
      target_audience: output.targetUser,
      snapshot_fields: snapshot,
    }).eq("id", projectId).eq("user_id", user.id);
    if (error) return { error: t("errorSave"), output: null, reply: null };
    const reply = t("generationReply", { name: output.identity.name });
    await supabase.from("project_ai_messages").insert({
      id: stableUuid(`${stage3.conversationId}:first-version-ready`),
      conversation_id: stage3.conversationId,
      project_id: projectId,
      user_id: user.id,
      role: "assistant",
      content: reply,
    });
    await supabase.from("project_ai_conversations").update({ title: output.identity.name.slice(0, 60) }).eq("id", stage3.conversationId).eq("user_id", user.id);
    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);
    return { error: null, output, reply, durationMs: Date.now() - startedAt };
  } catch (error) {
    console.error("[ventrio-ai-error]", JSON.stringify({ operation: "first_version_generation", projectId, message: error instanceof Error ? error.message : "unknown" }));
    return { error: t("unavailable"), output: null, reply: null };
  }
}

export async function editProjectOutputAction(
  projectId: string,
  conversationId: string,
  requestId: string,
  instruction: string,
): Promise<Stage3Result> {
  const t = await getTranslations("stage3");
  if (!UUID_PATTERN.test(projectId) || !UUID_PATTERN.test(conversationId) || !TOKEN_PATTERN.test(requestId)) {
    return { error: t("errorInvalid"), output: null, reply: null };
  }
  const message = instruction.trim().slice(0, 2000);
  if (!message) return { error: t("errorInvalid"), output: null, reply: null };
  const { supabase, user, project, stage3 } = await ownedProject(projectId);
  if (!user) return { error: t("errorSession"), output: null, reply: null };
  if (!project || !stage3 || !stage3.output || stage3.conversationId !== conversationId) {
    return { error: t("errorDirection"), output: null, reply: null };
  }
  const locale = project.locale;
  const { data: conversation } = await supabase
    .from("project_ai_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!conversation) return { error: t("errorDirection"), output: null, reply: null };

  const requestMarker = `edit:${requestId}`;
  const assistantMessageId = stableUuid(`${conversationId}:stage3-assistant:${requestId}`);
  if (stage3.lastRequestId === requestMarker) {
    const { data: existingReply } = await supabase.from("project_ai_messages").select("content").eq("id", assistantMessageId).eq("user_id", user.id).maybeSingle();
    return { error: null, output: stage3.output, reply: existingReply?.content ?? t("editReply"), durationMs: 0 };
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
    const { error: userMessageError } = await supabase.from("project_ai_messages").insert({
      id: stableUuid(`${conversationId}:stage3-user:${requestId}`),
      conversation_id: conversationId,
      project_id: projectId,
      user_id: user.id,
      role: "user",
      content: message,
    });
    if (userMessageError && userMessageError.code !== "23505") return { error: t("errorSave"), output: null, reply: null };
  }
  if (!process.env.ANTHROPIC_API_KEY) return { error: t("unavailable"), output: null, reply: null };

  try {
    const startedAt = Date.now();
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 3800,
      output_config: { effort: "low", format: { type: "json_schema", schema: EDIT_SCHEMA } },
      system: outputPrompt(locale, true),
      messages: [{ role: "user", content: JSON.stringify({ currentOutput: stage3.output, requestedEdit: message, projectLocale: locale }) }],
    });
    logUsage("project_output_edit", projectId, startedAt, response);
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") return { error: t("unavailable"), output: null, reply: null };
    const parsed = JSON.parse(textBlock.text) as Record<string, unknown>;
    const output = sanitizeStage3Output(parsed.output, stage3.output.preset);
    const reply = typeof parsed.message === "string" ? parsed.message.trim().slice(0, 500) : "";
    if (!output || !reply) return { error: t("unavailable"), output: null, reply: null };
    const nextState: Stage3ProjectState = { ...stage3, status: "first_version_ready", lastRequestId: requestMarker, output };
    const snapshot = mergeStage3ProjectState(project.snapshot_fields, nextState);
    snapshot.solution = output.identity.description;
    snapshot.audience = output.targetUser;
    snapshot.first_version = output.primaryValue;
    const { error } = await supabase.from("projects").update({
      name: output.identity.name,
      target_audience: output.targetUser,
      snapshot_fields: snapshot,
    }).eq("id", projectId).eq("user_id", user.id);
    if (error) return { error: t("errorSave"), output: null, reply: null };
    await supabase.from("project_ai_messages").insert({
      id: assistantMessageId,
      conversation_id: conversationId,
      project_id: projectId,
      user_id: user.id,
      role: "assistant",
      content: reply,
    });
    await supabase.from("project_ai_conversations").update({ title: output.identity.name.slice(0, 60) }).eq("id", conversationId).eq("user_id", user.id);
    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);
    return { error: null, output, reply, durationMs: Date.now() - startedAt };
  } catch (error) {
    console.error("[ventrio-ai-error]", JSON.stringify({ operation: "project_output_edit", projectId, message: error instanceof Error ? error.message : "unknown" }));
    return { error: t("unavailable"), output: null, reply: null };
  }
}
