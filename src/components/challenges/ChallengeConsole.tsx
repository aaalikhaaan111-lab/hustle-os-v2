"use client";

import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useGameProgress } from "@/lib/game-progress/GameProgressContext";
import { INTEREST_OPTIONS } from "@/lib/constants";
import { DIFFICULTY_META, type ChallengeDef } from "@/lib/challenges";
import type { ValidationResult } from "@/lib/challengeValidator";
import { validateChallengeAnswerAction } from "@/lib/actions/challengeValidation";

type ConsoleStep = "insight" | "quiz" | "reflection" | "checking" | "error" | "success";

const PROGRESS_STEPS: ConsoleStep[] = ["insight", "quiz", "reflection", "checking", "success"];
const CHECKING_DURATION_MS = 2000;
const QUIZ_OPTION_LABELS: Record<string, string[]> = {
  ru: ["А", "Б", "В", "Г"],
  en: ["A", "B", "C", "D"],
};

function fireConfetti() {
  const colors = ["#4f46e5", "#9333ea", "#ec4899"];
  const end = Date.now() + 1000;

  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 65, origin: { x: 0 }, colors });
    confetti({ particleCount: 4, angle: 120, spread: 65, origin: { x: 1 }, colors });
    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  })();

  confetti({ particleCount: 130, spread: 100, origin: { y: 0.6 }, colors });
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-ink-muted">{label}</span>
      <div className="flex flex-1 items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-900/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-pink-500"
            style={{ width: `${(value / 10) * 100}%` }}
          />
        </div>
        <span className="w-8 text-right font-bold text-ink">{value}</span>
      </div>
    </div>
  );
}

interface ChallengeConsoleProps {
  challenge: ChallengeDef;
  onClose: () => void;
  /**
   * Skips AI/heuristic validation of the reflection answer — it always
   * passes. Used for a user's very first challenge, which is meant to be
   * impossible to fail; real XP is still awarded and the answer is still
   * saved, only the pass/fail judgment is skipped.
   */
  skipValidation?: boolean;
}

const AUTO_PASS_RESULT: ValidationResult = {
  passed: true,
  score: { depth: 0, feasibility: 0, risk: 0, average: 0 },
  reason: "",
};

export function ChallengeConsole({ challenge, onClose, skipValidation }: ChallengeConsoleProps) {
  const t = useTranslations("challenges");
  const locale = useLocale();
  const optionLabels = QUIZ_OPTION_LABELS[locale] ?? QUIZ_OPTION_LABELS.en;
  const tInterests = useTranslations("onboarding");
  const { completeChallenge } = useGameProgress();
  const [step, setStep] = useState<ConsoleStep>("insight");
  const [quizSelection, setQuizSelection] = useState<number | null>(null);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<ValidationResult | null>(null);

  const categoryOption = INTEREST_OPTIONS.find((option) => option.id === challenge.categoryId);
  const categoryLabel = categoryOption ? tInterests(categoryOption.labelKey) : "";
  const difficulty = DIFFICULTY_META[challenge.difficulty];

  useEffect(() => {
    if (step !== "checking") return;
    let cancelled = false;

    async function run() {
      const [validation] = await Promise.all([
        skipValidation
          ? Promise.resolve(AUTO_PASS_RESULT)
          : validateChallengeAnswerAction(answer, challenge.markers, {
              questTitle: challenge.questTitle,
              scenario: challenge.scenario,
              actionPrompt: challenge.actionPrompt,
            }),
        new Promise((resolve) => setTimeout(resolve, CHECKING_DURATION_MS)),
      ]);
      if (cancelled) return;

      setResult(validation);

      if (!validation.passed) {
        setStep("error");
        return;
      }

      completeChallenge({
        challengeId: challenge.id,
        title: challenge.questTitle.replace(/^Квест:\s*/, ""),
        emoji: challenge.emoji,
        categoryLabel,
        xp: challenge.xp,
        answer: answer.trim(),
        score: skipValidation ? undefined : validation.score,
      });
      setStep("success");
      fireConfetti();
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [step, answer, challenge, categoryLabel, completeChallenge, skipValidation]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape" && step !== "checking") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [step, onClose]);

  const dotStepIndex = PROGRESS_STEPS.indexOf(step === "error" ? "checking" : step);
  const selectedOption = quizSelection !== null ? challenge.quizOptions[quizSelection] : null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white/70 backdrop-blur-2xl">
      <div
        className="flex min-h-full items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"
        onClick={(event) => {
          if (event.target === event.currentTarget && step !== "checking") onClose();
        }}
      >
        <div
          className={cn(
            "relative w-full max-w-lg rounded-[32px] border p-6 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.15)] sm:p-8",
          step === "success"
            ? "border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-indigo-50"
            : "border-t-white/70 border-x-zinc-200/40 border-b-zinc-200/40 bg-white/90"
        )}
      >
        {step !== "checking" && step !== "success" && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-zinc-100 hover:text-ink"
          >
            ✕
          </button>
        )}

        <div className="mb-6 flex justify-center gap-2">
          {PROGRESS_STEPS.map((s, i) => (
            <span
              key={s}
              className={cn(
                "h-1.5 w-8 rounded-full transition-all duration-500 ease-in-out",
                i <= dotStepIndex
                  ? "bg-gradient-to-r from-indigo-600 to-pink-500"
                  : "bg-zinc-200"
              )}
            />
          ))}
        </div>

        {step === "insight" && (
          <div className="animate-pop-in flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <span className="text-4xl" role="img" aria-hidden>
                {challenge.emoji}
              </span>
              <div className="flex flex-col gap-1.5">
                <span
                  className={cn(
                    "inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ring-1 ring-inset",
                    difficulty.className
                  )}
                >
                  {t(difficulty.labelKey)}
                </span>
                <h2 className="text-xl font-black leading-tight tracking-[-0.02em] text-ink">
                  {challenge.questTitle}
                </h2>
              </div>
            </div>
            <p className="rounded-2xl bg-accent-soft px-4 py-3 text-sm italic leading-relaxed tracking-tight text-ink-secondary">
              {challenge.scenario}
            </p>
            <p className="text-sm leading-relaxed tracking-tight text-ink-secondary">
              {challenge.insight}
            </p>
            <Button size="lg" onClick={() => setStep("quiz")} className="w-full">
              {t("next")}
            </Button>
          </div>
        )}

        {step === "quiz" && (
          <div className="animate-pop-in flex flex-col gap-5">
            <h2 className="text-xl font-extrabold tracking-[-0.02em] text-ink">
              {challenge.quizQuestion}
            </h2>
            <div className="flex flex-col gap-3">
              {challenge.quizOptions.map((option, index) => {
                const isSelected = quizSelection === index;
                const showRight = isSelected && option.isCorrect;
                const showWrong = isSelected && !option.isCorrect;
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setQuizSelection(index)}
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-all duration-300 ease-out",
                      showRight && "border-success bg-success-soft text-success",
                      showWrong && "border-danger bg-danger-soft text-danger",
                      !isSelected &&
                        "border-zinc-100/60 bg-white/70 text-ink-secondary hover:border-zinc-200 hover:text-ink"
                    )}
                  >
                    {optionLabels[index]}) {option.text}
                  </button>
                );
              })}
            </div>
            {selectedOption && !selectedOption.isCorrect && (
              <p className="text-xs font-medium text-danger">{challenge.correctAnswerHint}</p>
            )}
            <Button
              size="lg"
              disabled={!selectedOption?.isCorrect}
              onClick={() => setStep("reflection")}
              className="w-full"
            >
              {t("next")}
            </Button>
          </div>
        )}

        {step === "reflection" && (
          <div className="animate-pop-in flex flex-col gap-5">
            <h2 className="text-xl font-extrabold tracking-[-0.02em] text-ink">
              {challenge.actionPrompt}
            </h2>
            <p className="text-xs tracking-tight text-ink-muted">
              {skipValidation ? t("warmupHint") : t("aiValidationHint")}
            </p>
            <textarea
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              rows={5}
              placeholder={t("reflectionPlaceholder")}
              className="w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-muted transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            <Button
              size="lg"
              disabled={!answer.trim()}
              onClick={() => setStep("checking")}
              className="w-full"
            >
              {skipValidation ? t("warmupDone") : t("submitForAiCheck")}
            </Button>
          </div>
        )}

        {step === "checking" && (
          <div className="animate-pop-in flex flex-col items-center gap-6 py-8 text-center">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <div className="absolute inset-0 animate-spin rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 opacity-25 blur-lg" />
              <div
                className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600"
                style={{ animationDuration: "0.9s" }}
              />
            </div>
            <p className="text-lg font-extrabold tracking-tight text-ink">
              {skipValidation ? t("checkingWarmup") : t("checkingAi")}
            </p>
          </div>
        )}

        {step === "error" && result && (
          <div className="animate-pop-in flex flex-col items-center gap-5 py-4 text-center">
            <span className="text-5xl" role="img" aria-hidden>
              ⚠️
            </span>
            <h2 className="text-xl font-extrabold tracking-[-0.02em] text-ink">
              {t("validationErrorTitle")}
            </h2>
            <p className="text-sm leading-relaxed tracking-tight text-ink-secondary">
              {result.reason}
            </p>
            <Button size="lg" onClick={() => setStep("reflection")} className="w-full">
              {t("tryAgain")}
            </Button>
          </div>
        )}

        {step === "success" && result && (
          <div className="animate-pop-in flex flex-col items-center gap-4 py-4 text-center">
            <span className="text-6xl" role="img" aria-hidden>
              🎉
            </span>
            <h2 className="text-3xl font-black tracking-[-0.02em] text-ink">
              {t("questCompleteTitle")}
            </h2>
            <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 px-5 py-2.5 text-base font-bold text-white shadow-[0_8px_24px_rgba(99,102,241,0.35)]">
              {skipValidation ? `+${challenge.xp} XP` : `+${challenge.xp} XP · ${t("scoreLabel", { score: result.score.average })}`}
            </span>

            {!skipValidation && (
              <>
                <div className="mt-1 flex w-full flex-col gap-2 rounded-2xl bg-white/70 px-4 py-3 ring-1 ring-inset ring-indigo-100">
                  <ScoreRow label={t("depthLabel")} value={result.score.depth} />
                  <ScoreRow label={t("feasibilityLabel")} value={result.score.feasibility} />
                  <ScoreRow label={t("riskLabel")} value={result.score.risk} />
                </div>

                <div className="flex w-full flex-col gap-1.5 rounded-2xl bg-white/70 px-4 py-3 text-left ring-1 ring-inset ring-indigo-100">
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600">
                    {t("aiVerdictTitle")}
                  </span>
                  <p className="text-sm tracking-tight text-ink-secondary">{result.reason}</p>
                </div>
              </>
            )}

            <Button size="lg" variant="secondary" onClick={onClose} className="mt-2 w-full">
              {t("closeButton")}
            </Button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
