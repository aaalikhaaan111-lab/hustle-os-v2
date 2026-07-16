"use client";

import { useState } from "react";
import confetti from "canvas-confetti";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { useGameProgress } from "@/lib/game-progress/GameProgressContext";

const CHALLENGE_ZERO_ID = "challenge-zero";
const CHALLENGE_ZERO_XP = 100;

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

interface ChallengeZeroCardProps {
  subtitle: string;
}

export function ChallengeZeroCard({ subtitle }: ChallengeZeroCardProps) {
  const t = useTranslations("dashboard");
  const { isReady, completions, isChallengeCompleted, completeChallenge } = useGameProgress();
  const [projectName, setProjectName] = useState("");
  const [justCompleted, setJustCompleted] = useState(false);

  const completed = isReady && isChallengeCompleted(CHALLENGE_ZERO_ID);
  const completedName =
    completions.find((c) => c.challengeId === CHALLENGE_ZERO_ID)?.answer ?? "";

  function handleActivate() {
    const trimmed = projectName.trim();
    if (!trimmed) return;
    completeChallenge({
      challengeId: CHALLENGE_ZERO_ID,
      title: t("challengeZeroTitle"),
      emoji: "🎯",
      categoryLabel: t("challengeZeroCategory"),
      xp: CHALLENGE_ZERO_XP,
      answer: trimmed,
    });
    setJustCompleted(true);
    fireConfetti();
  }

  return (
    <div className="flex flex-col gap-6 py-9">
      <div className="flex items-center gap-4">
        <span className="text-4xl" role="img" aria-hidden>
          🎯
        </span>
        <div className="flex flex-col gap-2">
          <span className="inline-flex w-fit items-center rounded-full bg-gradient-to-tr from-indigo-50 to-pink-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600 shadow-[0_2px_12px_rgba(99,102,241,0.12)] ring-1 ring-inset ring-indigo-100">
            {t("challengeZeroBadge")}
          </span>
          <h3 className="text-3xl font-black leading-[1.05] tracking-[-0.02em] text-ink">
            {t("challengeZeroTitle")}
          </h3>
        </div>
      </div>

      <p className="text-sm font-medium tracking-tight text-ink-secondary">{subtitle}</p>

      <div className="grid">
        <div
          className={cn(
            "col-start-1 row-start-1 flex flex-col gap-4 transition-all duration-500 ease-in-out",
            completed
              ? "pointer-events-none -translate-y-2 opacity-0"
              : "translate-y-0 opacity-100"
          )}
        >
          <div className="rounded-2xl bg-accent-soft px-5 py-4 ring-1 ring-inset ring-indigo-100/60">
            <p className="text-sm font-medium tracking-tight text-ink-secondary">
              {t("challengeZeroPrompt")}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder={t("challengeZeroPlaceholder")}
              maxLength={60}
              disabled={completed}
              className="sm:flex-1"
            />
            <Button
              onClick={handleActivate}
              disabled={completed || !projectName.trim()}
              size="lg"
              className="w-full sm:w-fit"
            >
              {t("activateTrack")}
            </Button>
          </div>
        </div>

        <div
          className={cn(
            "col-start-1 row-start-1 flex flex-col items-start gap-4 transition-all duration-500 ease-in-out",
            completed
              ? "translate-y-0 opacity-100"
              : "pointer-events-none translate-y-2 opacity-0"
          )}
        >
          <div
            className={cn(
              "flex w-full flex-col gap-1 rounded-2xl bg-accent-soft px-5 py-4 ring-1 ring-inset ring-indigo-100/60",
              justCompleted && "animate-pop-in"
            )}
          >
            <p className="text-sm font-bold text-ink">
              {t("challengeZeroDone", { name: completedName })}
            </p>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 px-4 py-2 text-sm font-bold text-white shadow-[0_8px_24px_rgba(99,102,241,0.35)]",
              justCompleted && "animate-pop-in"
            )}
          >
            {t("streakActivated", { xp: CHALLENGE_ZERO_XP })}
          </span>
        </div>
      </div>
    </div>
  );
}
