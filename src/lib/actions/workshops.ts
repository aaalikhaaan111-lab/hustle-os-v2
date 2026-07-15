"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { calculateAwardedPoints, generateSessionCode, getWorkshopPack } from "@/lib/workshops";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type Client = SupabaseClient<Database>;
type SessionRow = Database["public"]["Tables"]["workshop_sessions"]["Row"];

const ANSWER_GRACE_MS = 1500; // network latency tolerance on top of the question's time limit
const MAX_CODE_ATTEMPTS = 5;

export interface WorkshopParticipantView {
  id: string;
  displayName: string;
  isHost: boolean;
  score: number;
}

export interface WorkshopSessionState {
  sessionId: string;
  code: string;
  workshopSlug: string;
  status: SessionRow["status"];
  currentQuestionIndex: number;
  questionStartedAt: string | null;
  serverNow: string;
  isHost: boolean;
  myParticipantId: string | null;
  hasAnsweredCurrent: boolean;
  myLastAnswer: { selectedOption: number; isCorrect: boolean; pointsAwarded: number } | null;
  participants: WorkshopParticipantView[];
  answeredCount: number;
}

async function requireUser(supabase: Client) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

async function loadSessionByCode(supabase: Client, code: string) {
  return supabase
    .from("workshop_sessions")
    .select("*")
    .eq("code", code.toUpperCase())
    .maybeSingle();
}

async function loadSessionById(supabase: Client, sessionId: string) {
  return supabase.from("workshop_sessions").select("*").eq("id", sessionId).maybeSingle();
}

function assertHost(session: SessionRow, userId: string): string | null {
  if (session.host_id !== userId) {
    return "Только хост сессии может это сделать.";
  }
  return null;
}

/** Shared transition used by both startWorkshopSessionAction and advanceWorkshopQuestionAction. */
async function setCurrentQuestion(supabase: Client, sessionId: string, questionIndex: number) {
  return supabase
    .from("workshop_sessions")
    .update({
      status: "question",
      current_question_index: questionIndex,
      question_started_at: new Date().toISOString(),
    })
    .eq("id", sessionId);
}

// ─────────────────────────────────────────────────────────────────────────
// 1. Create session (host)
// ─────────────────────────────────────────────────────────────────────────
export async function createWorkshopSessionAction(
  workshopSlug: string
): Promise<{ error: string | null }> {
  const pack = getWorkshopPack(workshopSlug);
  if (!pack) {
    return { error: "Неизвестный воркшоп." };
  }

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) {
    return { error: "Твоя сессия истекла. Войди снова." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();
  const displayName = profile?.display_name?.trim() || user.email?.split("@")[0] || "Хост";

  let code = "";
  let sessionId: string | null = null;

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const candidate = generateSessionCode();
    const { data, error } = await supabase
      .from("workshop_sessions")
      .insert({ code: candidate, workshop_slug: workshopSlug, host_id: user.id })
      .select("id, code")
      .single();

    if (!error && data) {
      code = data.code;
      sessionId = data.id;
      break;
    }
    if (error && error.code !== "23505") {
      console.error("createWorkshopSessionAction: insert workshop_sessions failed:", error);
      return { error: "Не удалось создать сессию. Попробуй ещё раз." };
    }
  }

  if (!sessionId) {
    return { error: "Не удалось подобрать код сессии. Попробуй ещё раз." };
  }

  const { error: joinError } = await supabase
    .from("workshop_participants")
    .insert({ session_id: sessionId, user_id: user.id, display_name: displayName });

  if (joinError) {
    console.error("createWorkshopSessionAction: insert workshop_participants failed:", joinError);
    return { error: "Сессия создана, но не удалось присоединить хоста как игрока." };
  }

  redirect(`/workshops/${code}`);
}

// ─────────────────────────────────────────────────────────────────────────
// 2. Join session by code
// ─────────────────────────────────────────────────────────────────────────
export async function joinWorkshopSessionAction(
  code: string,
  displayName: string
): Promise<{ error: string | null }> {
  const trimmedCode = code.trim().toUpperCase();
  if (!trimmedCode) {
    return { error: "Введи код сессии." };
  }

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) {
    return { error: "Твоя сессия истекла. Войди снова." };
  }

  const { data: session, error: sessionError } = await loadSessionByCode(supabase, trimmedCode);
  if (sessionError || !session) {
    return { error: "Сессия с таким кодом не найдена." };
  }

  const { data: existingParticipant } = await supabase
    .from("workshop_participants")
    .select("id")
    .eq("session_id", session.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingParticipant) {
    redirect(`/workshops/${session.code}`);
  }

  if (session.status !== "lobby") {
    return { error: "Игра уже началась — присоединиться нельзя." };
  }

  const name = displayName.trim() || user.email?.split("@")[0] || "Игрок";

  const { error: joinError } = await supabase
    .from("workshop_participants")
    .insert({ session_id: session.id, user_id: user.id, display_name: name });

  if (joinError) {
    console.error("joinWorkshopSessionAction: insert workshop_participants failed:", joinError);
    return { error: "Не удалось присоединиться. Попробуй ещё раз." };
  }

  redirect(`/workshops/${session.code}`);
}

// ─────────────────────────────────────────────────────────────────────────
// 3. Get session state (polled by every client)
// ─────────────────────────────────────────────────────────────────────────
export async function getWorkshopSessionStateAction(
  code: string
): Promise<{ error: string | null; data: WorkshopSessionState | null }> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) {
    return { error: "Твоя сессия истекла. Войди снова.", data: null };
  }

  const { data: session, error: sessionError } = await loadSessionByCode(supabase, code);
  if (sessionError || !session) {
    return { error: "Сессия с таким кодом не найдена.", data: null };
  }

  const [{ data: participants }, { data: answers }] = await Promise.all([
    supabase
      .from("workshop_participants")
      .select("id, user_id, display_name")
      .eq("session_id", session.id)
      .order("joined_at", { ascending: true }),
    supabase
      .from("workshop_answers")
      .select("participant_id, question_index, selected_option, is_correct, points_awarded")
      .eq("session_id", session.id),
  ]);

  const participantRows = participants ?? [];
  const answerRows = answers ?? [];

  const scoreByParticipant = new Map<string, number>();
  for (const answer of answerRows) {
    scoreByParticipant.set(
      answer.participant_id,
      (scoreByParticipant.get(answer.participant_id) ?? 0) + answer.points_awarded
    );
  }

  const me = participantRows.find((p) => p.user_id === user.id) ?? null;
  const myAnswerForCurrent = me
    ? (answerRows.find(
        (a) => a.participant_id === me.id && a.question_index === session.current_question_index
      ) ?? null)
    : null;

  const answeredCount = answerRows.filter(
    (a) => a.question_index === session.current_question_index
  ).length;

  const participantViews: WorkshopParticipantView[] = participantRows
    .map((p) => ({
      id: p.id,
      displayName: p.display_name,
      isHost: p.user_id === session.host_id,
      score: scoreByParticipant.get(p.id) ?? 0,
    }))
    .sort((a, b) => b.score - a.score);

  return {
    error: null,
    data: {
      sessionId: session.id,
      code: session.code,
      workshopSlug: session.workshop_slug,
      status: session.status,
      currentQuestionIndex: session.current_question_index,
      questionStartedAt: session.question_started_at,
      serverNow: new Date().toISOString(),
      isHost: session.host_id === user.id,
      myParticipantId: me?.id ?? null,
      hasAnsweredCurrent: myAnswerForCurrent !== null,
      myLastAnswer: myAnswerForCurrent
        ? {
            selectedOption: myAnswerForCurrent.selected_option,
            isCorrect: myAnswerForCurrent.is_correct,
            pointsAwarded: myAnswerForCurrent.points_awarded,
          }
        : null,
      participants: participantViews,
      answeredCount,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// 4. Start session (host, lobby -> question 0)
// ─────────────────────────────────────────────────────────────────────────
export async function startWorkshopSessionAction(sessionId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: "Твоя сессия истекла. Войди снова." };

  const { data: session, error: sessionError } = await loadSessionById(supabase, sessionId);
  if (sessionError || !session) return { error: "Сессия не найдена." };

  const hostError = assertHost(session, user.id);
  if (hostError) return { error: hostError };

  if (session.status !== "lobby") {
    return { error: "Сессия уже началась." };
  }

  const { count } = await supabase
    .from("workshop_participants")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);

  if (!count || count === 0) {
    return { error: "В лобби нет участников." };
  }

  const { error } = await setCurrentQuestion(supabase, sessionId, 0);
  if (error) {
    console.error("startWorkshopSessionAction: setCurrentQuestion failed:", error);
    return { error: "Не удалось начать сессию." };
  }
  return { error: null };
}

// ─────────────────────────────────────────────────────────────────────────
// 5. Start a specific question (host)
// ─────────────────────────────────────────────────────────────────────────
export async function startWorkshopQuestionAction(
  sessionId: string,
  questionIndex: number
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: "Твоя сессия истекла. Войди снова." };

  const { data: session, error: sessionError } = await loadSessionById(supabase, sessionId);
  if (sessionError || !session) return { error: "Сессия не найдена." };

  const hostError = assertHost(session, user.id);
  if (hostError) return { error: hostError };

  const pack = getWorkshopPack(session.workshop_slug);
  if (!pack || questionIndex < 0 || questionIndex >= pack.questions.length) {
    return { error: "Такого вопроса нет в этом воркшопе." };
  }

  const { error } = await setCurrentQuestion(supabase, sessionId, questionIndex);
  if (error) {
    console.error("startWorkshopQuestionAction: setCurrentQuestion failed:", error);
    return { error: "Не удалось запустить вопрос." };
  }
  return { error: null };
}

// ─────────────────────────────────────────────────────────────────────────
// 6. Submit answer (participant)
// ─────────────────────────────────────────────────────────────────────────
export async function submitWorkshopAnswerAction(
  sessionId: string,
  questionIndex: number,
  selectedOption: number
): Promise<{ error: string | null; isCorrect?: boolean; pointsAwarded?: number }> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: "Твоя сессия истекла. Войди снова." };

  const { data: session, error: sessionError } = await loadSessionById(supabase, sessionId);
  if (sessionError || !session) return { error: "Сессия не найдена." };

  if (session.status !== "question" || session.current_question_index !== questionIndex) {
    return { error: "Этот вопрос больше не активен." };
  }

  if (!session.question_started_at) {
    return { error: "Вопрос ещё не запущен." };
  }

  const pack = getWorkshopPack(session.workshop_slug);
  const question = pack?.questions[questionIndex];
  if (!pack || !question) {
    return { error: "Вопрос не найден." };
  }

  const elapsedMs = Date.now() - new Date(session.question_started_at).getTime();
  if (elapsedMs > question.timeLimitSeconds * 1000 + ANSWER_GRACE_MS) {
    return { error: "Время вышло — ответ не засчитан." };
  }

  if (selectedOption < 0 || selectedOption >= question.options.length) {
    return { error: "Некорректный вариант ответа." };
  }

  const { data: participant } = await supabase
    .from("workshop_participants")
    .select("id")
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!participant) {
    return { error: "Ты не участник этой сессии." };
  }

  const isCorrect = selectedOption === question.correctIndex;
  const pointsAwarded = isCorrect ? calculateAwardedPoints(question, elapsedMs) : 0;

  const { error: insertError } = await supabase.from("workshop_answers").insert({
    session_id: sessionId,
    participant_id: participant.id,
    question_index: questionIndex,
    selected_option: selectedOption,
    is_correct: isCorrect,
    response_ms: Math.max(0, elapsedMs),
    points_awarded: pointsAwarded,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return { error: "Ты уже ответил на этот вопрос." };
    }
    console.error("submitWorkshopAnswerAction: insert workshop_answers failed:", insertError);
    return { error: "Не удалось отправить ответ." };
  }

  return { error: null, isCorrect, pointsAwarded };
}

// ─────────────────────────────────────────────────────────────────────────
// 7. Reveal answer (host, question -> reveal)
// ─────────────────────────────────────────────────────────────────────────
export async function revealWorkshopAnswerAction(sessionId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: "Твоя сессия истекла. Войди снова." };

  const { data: session, error: sessionError } = await loadSessionById(supabase, sessionId);
  if (sessionError || !session) return { error: "Сессия не найдена." };

  const hostError = assertHost(session, user.id);
  if (hostError) return { error: hostError };

  if (session.status !== "question") {
    return { error: "Сейчас нельзя раскрыть ответ." };
  }

  const { error } = await supabase
    .from("workshop_sessions")
    .update({ status: "reveal" })
    .eq("id", sessionId);

  if (error) {
    console.error("revealWorkshopAnswerAction: update workshop_sessions failed:", error);
    return { error: "Не удалось раскрыть ответ." };
  }
  return { error: null };
}

// ─────────────────────────────────────────────────────────────────────────
// 8. Advance to next question (host, reveal -> question N+1)
// ─────────────────────────────────────────────────────────────────────────
export async function advanceWorkshopQuestionAction(sessionId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: "Твоя сессия истекла. Войди снова." };

  const { data: session, error: sessionError } = await loadSessionById(supabase, sessionId);
  if (sessionError || !session) return { error: "Сессия не найдена." };

  const hostError = assertHost(session, user.id);
  if (hostError) return { error: hostError };

  if (session.status !== "reveal") {
    return { error: "Сейчас нельзя перейти к следующему вопросу." };
  }

  const pack = getWorkshopPack(session.workshop_slug);
  const nextIndex = session.current_question_index + 1;
  if (!pack || nextIndex >= pack.questions.length) {
    return { error: "Это был последний вопрос — заверши сессию." };
  }

  const { error } = await setCurrentQuestion(supabase, sessionId, nextIndex);
  if (error) {
    console.error("advanceWorkshopQuestionAction: setCurrentQuestion failed:", error);
    return { error: "Не удалось перейти к следующему вопросу." };
  }
  return { error: null };
}

// ─────────────────────────────────────────────────────────────────────────
// 9. Finish session (host, reveal -> finished)
// ─────────────────────────────────────────────────────────────────────────
export async function finishWorkshopSessionAction(sessionId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: "Твоя сессия истекла. Войди снова." };

  const { data: session, error: sessionError } = await loadSessionById(supabase, sessionId);
  if (sessionError || !session) return { error: "Сессия не найдена." };

  const hostError = assertHost(session, user.id);
  if (hostError) return { error: hostError };

  if (session.status !== "reveal" && session.status !== "question") {
    return { error: "Сессию нельзя завершить сейчас." };
  }

  const { error } = await supabase
    .from("workshop_sessions")
    .update({ status: "finished" })
    .eq("id", sessionId);

  if (error) {
    console.error("finishWorkshopSessionAction: update workshop_sessions failed:", error);
    return { error: "Не удалось завершить сессию." };
  }
  return { error: null };
}
