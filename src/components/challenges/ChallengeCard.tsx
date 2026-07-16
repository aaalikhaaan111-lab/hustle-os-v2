"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { ChallengeConsole } from "@/components/challenges/ChallengeConsole";
import { useGameProgress } from "@/lib/game-progress/GameProgressContext";
import { DIFFICULTY_META, type ChallengeDef } from "@/lib/challenges";
import { cn } from "@/lib/utils";

interface ChallengeCardProps {
  challenge: ChallengeDef;
  categoryLabel: string;
  initialOpen?: boolean;
}

export function ChallengeCard({ challenge, categoryLabel, initialOpen = false }: ChallengeCardProps) {
  const t = useTranslations("challenges");
  const { isReady, isChallengeCompleted } = useGameProgress();
  const [isOpen, setIsOpen] = useState(initialOpen);

  const completed = isReady && isChallengeCompleted(challenge.id);
  const difficulty = DIFFICULTY_META[challenge.difficulty];

  return (
    <>
      <Card>
        <CardContent className="flex h-full flex-col gap-5 py-8">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex w-fit items-center rounded-full bg-gradient-to-tr from-indigo-50 to-pink-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600 shadow-[0_2px_12px_rgba(99,102,241,0.12)] ring-1 ring-inset ring-indigo-100">
                {categoryLabel}
              </span>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ring-1 ring-inset",
                  difficulty.className
                )}
              >
                {t(difficulty.labelKey)}
              </span>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-600 ring-1 ring-inset ring-amber-100">
              +{challenge.xp} XP
            </span>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-3xl" role="img" aria-hidden>
              {challenge.emoji}
            </span>
            <h3 className="text-xl font-extrabold leading-tight tracking-[-0.02em] text-ink">
              {challenge.questTitle}
            </h3>
          </div>

          <p className="text-sm tracking-tight text-ink-secondary">{challenge.description}</p>

          <Button
            type="button"
            size="lg"
            disabled={completed}
            onClick={() => setIsOpen(true)}
            className="mt-auto w-full sm:w-fit"
          >
            {completed ? t("completed") : t("start")}
          </Button>
        </CardContent>
      </Card>

      {isOpen && <ChallengeConsole challenge={challenge} onClose={() => setIsOpen(false)} />}
    </>
  );
}
