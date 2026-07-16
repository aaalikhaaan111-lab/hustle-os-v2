"use client";

import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { cn } from "@/lib/utils";
import { getWorkshopPack } from "@/lib/workshops";
import {
  advanceWorkshopQuestionAction,
  finishWorkshopSessionAction,
  getWorkshopSessionStateAction,
  revealWorkshopAnswerAction,
  startWorkshopSessionAction,
  submitWorkshopAnswerAction,
  type WorkshopSessionState,
} from "@/lib/actions/workshops";

const POLL_INTERVAL_MS = 2000;
const REVEAL_AUTO_ADVANCE_MS = 6000;
const OPTION_LABELS: Record<string, string[]> = {
  ru: ["А", "Б", "В", "Г"],
  en: ["A", "B", "C", "D"],
};
const OPTION_COLORS = [
  "from-rose-500 to-red-500",
  "from-blue-500 to-indigo-500",
  "from-amber-400 to-orange-500",
  "from-emerald-500 to-teal-500",
];

function fireConfetti() {
  const colors = ["#4f46e5", "#9333ea", "#ec4899"];
  const end = Date.now() + 1000;
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 65, origin: { x: 0 }, colors });
    confetti({ particleCount: 4, angle: 120, spread: 65, origin: { x: 1 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
  confetti({ particleCount: 130, spread: 100, origin: { y: 0.6 }, colors });
}

function Podium({ place, name, score }: { place: 1 | 2 | 3; name: string; score: number }) {
  const t = useTranslations("workshops");
  const heights = { 1: "h-32", 2: "h-24", 3: "h-16" };
  const medals = { 1: "🥇", 2: "🥈", 3: "🥉" };
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-3xl">{medals[place]}</span>
      <span className="max-w-[100px] truncate text-sm font-bold text-ink">{name}</span>
      <span className="text-xs font-semibold text-ink-muted">
        {score} {t("pointsShort")}
      </span>
      <div
        className={cn(
          "w-20 rounded-t-xl bg-gradient-to-b from-indigo-500 to-purple-600",
          heights[place]
        )}
      />
    </div>
  );
}

interface WorkshopSessionProps {
  initialState: WorkshopSessionState;
}

export function WorkshopSession({ initialState }: WorkshopSessionProps) {
  const t = useTranslations("workshops");
  const locale = useLocale();
  const optionLabels = OPTION_LABELS[locale] ?? OPTION_LABELS.en;
  const [state, setState] = useState(initialState);
  const [pollError, setPollError] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answeredLocally, setAnsweredLocally] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [hostActionPending, setHostActionPending] = useState(false);
  const autoRevealedRef = useRef<number | null>(null);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against the auto-advance timer and a manual "Next"/"Finish" click
  // both firing for the same reveal (harmless either way — the server's
  // status check rejects the redundant one — but this avoids the wasted
  // round-trip). Scoped by currentQuestionIndex, which stays fixed for the
  // whole time a given question's reveal is showing.
  const advancedFromRevealRef = useRef<number | null>(null);

  const pack = getWorkshopPack(state.workshopSlug);
  const question = pack?.questions[state.currentQuestionIndex];
  const isLastQuestion = pack ? state.currentQuestionIndex >= pack.questions.length - 1 : false;

  // ── Poll for the latest session state ──────────────────────────────────
  useEffect(() => {
    const interval = setInterval(async () => {
      const result = await getWorkshopSessionStateAction(state.code);
      if (result.data) {
        setState(result.data);
        setPollError(null);
      } else {
        setPollError(result.error);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [state.code]);

  // ── Reset per-question local answer UI when the question changes ───────
  // Adjusted during render rather than in an effect, per
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [resetForQuestionIndex, setResetForQuestionIndex] = useState(state.currentQuestionIndex);
  if (resetForQuestionIndex !== state.currentQuestionIndex) {
    setResetForQuestionIndex(state.currentQuestionIndex);
    setSelectedOption(null);
    setAnsweredLocally(false);
    setAnswerError(null);
  }

  // ── Live countdown, anchored to the server's question_started_at ───────
  const deadline =
    state.status === "question" && state.questionStartedAt && question
      ? new Date(state.questionStartedAt).getTime() + question.timeLimitSeconds * 1000
      : null;

  const [syncedDeadline, setSyncedDeadline] = useState(deadline);
  if (syncedDeadline !== deadline) {
    // Date.now() must not run during render (render must stay pure/idempotent) —
    // seed "unknown" here; the effect below computes the real value right after
    // commit. null (not 0) is deliberate: 0 would be indistinguishable from a
    // genuinely expired timer and could trip the host's auto-reveal effect for
    // a question that just started.
    setSyncedDeadline(deadline);
    setRemainingMs(null);
  }

  useEffect(() => {
    if (deadline === null) return;
    const activeDeadline = deadline;
    function tick() {
      setRemainingMs(Math.max(0, activeDeadline - Date.now()));
    }
    tick();
    const interval = setInterval(tick, 200);
    return () => clearInterval(interval);
  }, [deadline]);

  // ── Host: auto-reveal once the timer hits zero ──────────────────────────
  useEffect(() => {
    if (!state.isHost || state.status !== "question") return;
    if (remainingMs === null || remainingMs > 0) return;
    if (autoRevealedRef.current === state.currentQuestionIndex) return;
    autoRevealedRef.current = state.currentQuestionIndex;
    revealWorkshopAnswerAction(state.sessionId);
  }, [state.isHost, state.status, state.currentQuestionIndex, state.sessionId, remainingMs]);

  // ── Host: auto-advance a few seconds after reveal ───────────────────────
  useEffect(() => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    if (!state.isHost || state.status !== "reveal") return;

    autoAdvanceTimerRef.current = setTimeout(() => {
      if (advancedFromRevealRef.current === state.currentQuestionIndex) return;
      advancedFromRevealRef.current = state.currentQuestionIndex;
      if (isLastQuestion) {
        finishWorkshopSessionAction(state.sessionId);
      } else {
        advanceWorkshopQuestionAction(state.sessionId);
      }
    }, REVEAL_AUTO_ADVANCE_MS);

    return () => {
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    };
  }, [state.isHost, state.status, state.sessionId, state.currentQuestionIndex, isLastQuestion]);

  // ── Celebrate once the session finishes ─────────────────────────────────
  useEffect(() => {
    if (state.status === "finished") fireConfetti();
  }, [state.status]);

  async function handleSelectOption(index: number) {
    if (answeredLocally || state.hasAnsweredCurrent || remainingMs === null || remainingMs <= 0) return;
    setSelectedOption(index);
    setAnsweredLocally(true);
    setAnswerError(null);
    const result = await submitWorkshopAnswerAction(state.sessionId, state.currentQuestionIndex, index);
    if (result.error) setAnswerError(result.error);
  }

  async function handleHostAction(action: () => Promise<{ error: string | null }>) {
    setHostActionPending(true);
    const result = await action();
    setHostActionPending(false);
    if (!result.error) {
      const refreshed = await getWorkshopSessionStateAction(state.code);
      if (refreshed.data) setState(refreshed.data);
    }
    return result;
  }

  if (!pack) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-ink-secondary">
          {t("contentNotFound")}
        </CardContent>
      </Card>
    );
  }

  const isLocked = answeredLocally || state.hasAnsweredCurrent;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-t-white/70 border-x-zinc-200/40 border-b-zinc-200/40 bg-white/70 px-5 py-3 shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{pack.emoji}</span>
          <div>
            <p className="text-sm font-extrabold tracking-tight text-ink">{pack.title}</p>
            <p className="text-xs text-ink-muted">
              {t("codeLabel")} <span className="font-mono font-bold tracking-widest">{state.code}</span>
            </p>
          </div>
        </div>
        {pollError && <span className="text-xs font-semibold text-danger">{pollError}</span>}
      </div>

      {state.status === "lobby" && (
        <Card>
          <CardContent className="animate-pop-in flex flex-col items-center gap-6 py-10 text-center">
            <span className="text-5xl">{pack.emoji}</span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-600">{t("lobbyBadge")}</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.02em] text-ink">
                {t("lobbyWaitingLabel")} <span className="font-mono">{state.code}</span>
              </h2>
              <p className="mt-2 text-sm text-ink-secondary">{t("lobbyShareHint")}</p>
            </div>

            <div className="flex w-full max-w-sm flex-col gap-2">
              {state.participants.length === 0 ? (
                <p className="text-sm text-ink-muted">{t("noParticipantsYet")}</p>
              ) : (
                state.participants.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl bg-white/70 px-4 py-2 text-sm shadow-sm"
                  >
                    <span className="font-semibold text-ink">
                      {p.displayName} {p.isHost && "👑"}
                    </span>
                  </div>
                ))
              )}
            </div>

            {state.isHost ? (
              <Button
                size="lg"
                disabled={hostActionPending}
                onClick={() => handleHostAction(() => startWorkshopSessionAction(state.sessionId))}
              >
                {hostActionPending ? t("starting") : t("startWorkshop")}
              </Button>
            ) : (
              <p className="text-sm font-semibold text-ink-muted">{t("waitingForHost")}</p>
            )}
          </CardContent>
        </Card>
      )}

      {state.status === "question" && question && (
        <Card>
          <CardContent className="animate-pop-in flex flex-col gap-6 py-8">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-600">
                {t("questionCounter", {
                  current: state.currentQuestionIndex + 1,
                  total: pack.questions.length,
                })}
              </span>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-black tabular-nums",
                  remainingMs !== null && remainingMs <= 5000
                    ? "bg-danger-soft text-danger"
                    : "bg-accent-soft text-accent"
                )}
              >
                {remainingMs === null ? "…" : Math.ceil(remainingMs / 1000)}
                {t("secondsShort")}
              </span>
            </div>

            <h2 className="text-xl font-extrabold leading-tight tracking-[-0.02em] text-ink">
              {question.prompt}
            </h2>

            <div className="grid gap-3 sm:grid-cols-2">
              {question.options.map((option, index) => {
                const isSelected = selectedOption === index;
                return (
                  <button
                    key={index}
                    type="button"
                    disabled={isLocked || remainingMs === null || remainingMs <= 0}
                    onClick={() => handleSelectOption(index)}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border px-4 py-4 text-left text-sm font-bold text-white shadow-md transition-all duration-200 ease-out disabled:cursor-not-allowed",
                      `bg-gradient-to-br ${OPTION_COLORS[index % OPTION_COLORS.length]}`,
                      isSelected ? "scale-[1.02] ring-4 ring-white ring-offset-2" : "opacity-90",
                      isLocked && !isSelected && "opacity-40"
                    )}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/25 text-xs">
                      {optionLabels[index]}
                    </span>
                    {option}
                  </button>
                );
              })}
            </div>

            {answerError && <p className="text-xs font-semibold text-danger">{answerError}</p>}
            {isLocked && !answerError && (
              <p className="text-center text-sm font-semibold text-success">
                {t("answerAccepted")}
              </p>
            )}
            <p className="text-center text-xs text-ink-muted">
              {t("answeredCount", {
                answered: state.answeredCount,
                total: state.participants.length,
              })}
            </p>
          </CardContent>
        </Card>
      )}

      {state.status === "reveal" && question && (
        <Card>
          <CardContent className="animate-pop-in flex flex-col gap-6 py-8">
            <h2 className="text-center text-xl font-extrabold tracking-[-0.02em] text-ink">
              {question.prompt}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {question.options.map((option, index) => {
                const isCorrectOption = index === question.correctIndex;
                const wasMine = state.myLastAnswer?.selectedOption === index;
                return (
                  <div
                    key={index}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border px-4 py-4 text-left text-sm font-bold shadow-sm",
                      isCorrectOption
                        ? "border-success bg-success-soft text-success"
                        : "border-zinc-100 bg-white/70 text-ink-muted opacity-70"
                    )}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/5 text-xs">
                      {optionLabels[index]}
                    </span>
                    {option}
                    {isCorrectOption && <span className="ml-auto">✅</span>}
                    {wasMine && !isCorrectOption && <span className="ml-auto">{t("yourAnswer")}</span>}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col items-center gap-1">
              {state.myLastAnswer ? (
                state.myLastAnswer.isCorrect ? (
                  <p className="text-lg font-black text-success">
                    +<AnimatedNumber value={state.myLastAnswer.pointsAwarded} /> {t("pointsShort")} 🎉
                  </p>
                ) : (
                  <p className="text-lg font-black text-danger">{t("missedAnswer")}</p>
                )
              ) : (
                <p className="text-sm font-semibold text-ink-muted">{t("didNotAnswer")}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600">
                {t("leaderboard")}
              </span>
              {state.participants.slice(0, 5).map((p, index) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-xl bg-white/70 px-4 py-2 text-sm shadow-sm"
                >
                  <span className="font-semibold text-ink">
                    {index + 1}. {p.displayName} {p.isHost && "👑"}
                  </span>
                  <span className="font-bold text-ink">{p.score}</span>
                </div>
              ))}
            </div>

            {state.isHost && (
              <Button
                size="lg"
                disabled={hostActionPending}
                onClick={() => {
                  advancedFromRevealRef.current = state.currentQuestionIndex;
                  handleHostAction(() =>
                    isLastQuestion
                      ? finishWorkshopSessionAction(state.sessionId)
                      : advanceWorkshopQuestionAction(state.sessionId)
                  );
                }}
              >
                {hostActionPending
                  ? t("oneSecond")
                  : isLastQuestion
                    ? t("finishAndShowPodium")
                    : t("nextQuestion")}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {state.status === "finished" && (
        <Card>
          <CardContent className="animate-pop-in flex flex-col items-center gap-8 py-10 text-center">
            <span className="text-5xl">🏆</span>
            <h2 className="text-3xl font-black tracking-[-0.02em] text-ink">{t("workshopFinished")}</h2>

            {state.participants.length > 0 && (
              <div className="flex items-end justify-center gap-4">
                {state.participants[1] && (
                  <Podium
                    place={2}
                    name={state.participants[1].displayName}
                    score={state.participants[1].score}
                  />
                )}
                {state.participants[0] && (
                  <Podium
                    place={1}
                    name={state.participants[0].displayName}
                    score={state.participants[0].score}
                  />
                )}
                {state.participants[2] && (
                  <Podium
                    place={3}
                    name={state.participants[2].displayName}
                    score={state.participants[2].score}
                  />
                )}
              </div>
            )}

            <div className="flex w-full max-w-sm flex-col gap-2">
              {state.participants.map((p, index) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-xl bg-white/70 px-4 py-2 text-sm shadow-sm"
                >
                  <span className="font-semibold text-ink">
                    {index + 1}. {p.displayName} {p.isHost && "👑"}
                  </span>
                  <span className="font-bold text-ink">{p.score}</span>
                </div>
              ))}
            </div>

            <Button size="lg" variant="secondary" href="/workshops">
              {t("backToWorkshops")}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
