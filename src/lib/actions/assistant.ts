"use server";

import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getProjectTasks, getProjectOutputs } from "@/lib/build/queries";
import { buildSnapshot } from "@/lib/build/snapshot";
import { assistantPhase, type AssistantPhase } from "@/lib/build/assistantPrompts";
import {
  generateAssistantReply,
  summarizeProjectMemory,
  type AssistantContext,
  type AssistantTurn,
} from "@/lib/actions/buildAi";

const MESSAGE_MAX_LENGTH = 2000;
const RECENT_TURNS = 14; // how many recent messages go to the model each turn
const SUMMARIZE_AFTER = 12; // start compressing older turns past this many
const KEEP_RECENT_IN_MEMORY = 8; // turns kept verbatim; older ones get summarized

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface LoadAssistantResult {
  error: string | null;
  available: boolean; // false when the assistant tables aren't reachable
  conversationId: string | null;
  messages: AssistantMessage[];
  phase: AssistantPhase;
}

// Loads the most recent conversation for a project (or none). Verifies the
// project is owned by the caller before touching anything.
export async function loadProjectAssistant(projectId: string): Promise<LoadAssistantResult> {
  const t = await getTranslations("build");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const empty = (error: string | null, available: boolean): LoadAssistantResult => ({
    error,
    available,
    conversationId: null,
    messages: [],
    phase: "early",
  });

  if (!user) return empty(t("errorSession"), false);

  const { data: project } = await supabase
    .from("projects")
    .select("id, current_stage")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!project) return empty(t("errorProjectNotFound"), false);

  const phase = assistantPhase(project.current_stage);

  const { data: conversation, error: convError } = await supabase
    .from("project_ai_conversations")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Tables not applied yet (or unreachable) → assistant is unavailable but the
  // rest of Build is unaffected.
  if (convError) return empty(null, false);
  if (!conversation) return { error: null, available: true, conversationId: null, messages: [], phase };

  const { data: messages } = await supabase
    .from("project_ai_messages")
    .select("id, role, content")
    .eq("conversation_id", conversation.id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  return {
    error: null,
    available: true,
    conversationId: conversation.id,
    messages: (messages ?? []) as AssistantMessage[],
    phase,
  };
}

export interface SendMessageResult {
  error: string | null;
  /** Localized note shown when the model is temporarily unavailable. */
  unavailableNote: string | null;
  conversationId: string | null;
  reply: string | null;
}

// Sends one user message and returns the assistant's reply, persisting both.
export async function sendAssistantMessage(
  projectId: string,
  conversationId: string | null,
  content: string
): Promise<SendMessageResult> {
  const t = await getTranslations("build");
  const trimmed = content.trim();

  const fail = (error: string): SendMessageResult => ({
    error,
    unavailableNote: null,
    conversationId,
    reply: null,
  });

  if (trimmed.length === 0) return fail(t("errorSession"));
  const message = trimmed.slice(0, MESSAGE_MAX_LENGTH);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(t("errorSession"));

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!project) return fail(t("errorProjectNotFound"));

  // The assistant replies in the project's own language.
  const locale = project.locale;

  // Ensure a conversation exists (create lazily on the first message).
  let convId = conversationId;
  if (!convId) {
    const { data: created, error: createError } = await supabase
      .from("project_ai_conversations")
      .insert({ project_id: projectId, user_id: user.id, title: message.slice(0, 60) })
      .select("id")
      .single();
    if (createError || !created) return fail(t("assistantUnavailable"));
    convId = created.id;
  } else {
    // Verify the conversation belongs to this user + project.
    const { data: conv } = await supabase
      .from("project_ai_conversations")
      .select("id")
      .eq("id", convId)
      .eq("user_id", user.id)
      .eq("project_id", projectId)
      .maybeSingle();
    if (!conv) return fail(t("errorProjectNotFound"));
  }

  // Persist the user message first so it's never lost.
  const { error: userMsgError } = await supabase.from("project_ai_messages").insert({
    conversation_id: convId,
    project_id: projectId,
    user_id: user.id,
    role: "user",
    content: message,
  });
  if (userMsgError) return fail(t("assistantUnavailable"));

  // Assemble context: authoritative project state + snapshot + memory + recent turns.
  const [tasks, outputs] = await Promise.all([
    getProjectTasks(supabase, projectId),
    getProjectOutputs(supabase, projectId),
  ]);
  const snapshotRows = buildSnapshot(project, tasks, outputs);
  const tSnap = t;
  const snapshot = snapshotRows
    .filter((row) => row.value !== null)
    .map((row) => ({ label: tSnap(row.labelKey as Parameters<typeof t>[0]), value: row.value as string }));

  const currentTask = tasks.find((task) => task.status !== "completed");

  const { data: memoryRow } = await supabase
    .from("project_ai_memory")
    .select("summary")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: allMessages } = await supabase
    .from("project_ai_messages")
    .select("role, content, created_at")
    .eq("conversation_id", convId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const history: AssistantTurn[] = (allMessages ?? []).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  const recent = history.slice(-RECENT_TURNS);

  const pitch = (project.pitch ?? null) as { pitch30?: string } | null;
  const context: AssistantContext = {
    projectName: project.name || t("destProjectFallback"),
    projectType: project.project_type,
    niche: project.niche,
    intendedOutcome: project.intended_outcome,
    targetAudience: project.target_audience,
    timeAvailability: project.time_availability,
    currentStage: project.current_stage,
    currentTaskTitle: currentTask?.title ?? null,
    snapshot,
    pitchSummary: pitch?.pitch30 ?? null,
    memorySummary: memoryRow?.summary ?? null,
  };

  const reply = await generateAssistantReply(context, recent, locale);

  // AI unavailable: keep the user's message, show a temporary note, and do NOT
  // persist a fake assistant reply or memory.
  if (reply === null) {
    return { error: null, unavailableNote: t("assistantUnavailable"), conversationId: convId, reply: null };
  }

  await supabase.from("project_ai_messages").insert({
    conversation_id: convId,
    project_id: projectId,
    user_id: user.id,
    role: "assistant",
    content: reply,
  });

  // Touch the conversation so it sorts to the top next time.
  await supabase.from("project_ai_conversations").update({ title: history[0]?.content.slice(0, 60) ?? null }).eq("id", convId);

  // Compress older turns into the memory summary once the conversation is long
  // (best-effort; failures leave the previous summary untouched).
  const total = history.length + 1; // + the assistant reply just added
  if (total >= SUMMARIZE_AFTER && total % 6 === 0) {
    const older = history.slice(0, Math.max(0, history.length - KEEP_RECENT_IN_MEMORY));
    if (older.length > 0) {
      const newSummary = await summarizeProjectMemory(memoryRow?.summary ?? null, older, locale);
      if (newSummary) {
        await supabase
          .from("project_ai_memory")
          .upsert({ project_id: projectId, user_id: user.id, summary: newSummary }, { onConflict: "project_id" });
      }
    }
  }

  return { error: null, unavailableNote: null, conversationId: convId, reply };
}

// Starts a fresh conversation (does not delete previous ones / memory).
export async function startNewConversation(projectId: string): Promise<{ error: string | null; conversationId: string | null }> {
  const t = await getTranslations("build");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("errorSession"), conversationId: null };

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!project) return { error: t("errorProjectNotFound"), conversationId: null };

  const { data: created, error } = await supabase
    .from("project_ai_conversations")
    .insert({ project_id: projectId, user_id: user.id })
    .select("id")
    .single();
  if (error || !created) return { error: t("assistantUnavailable"), conversationId: null };

  return { error: null, conversationId: created.id };
}
