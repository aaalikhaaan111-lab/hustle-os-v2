"use client";

import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useGameProgress } from "@/lib/game-progress/GameProgressContext";
import { recommendNextQuest } from "@/lib/game-progress/recommendation";
import { DIFFICULTY_META } from "@/lib/challenges";
import { pick } from "@/i18n/content";
import { cn } from "@/lib/utils";

const DIMENSION_KEYS = {
  depth: "dimensionDepth",
  feasibility: "dimensionFeasibility",
  risk: "dimensionRisk",
} as const;

export function NextGoalCard() {
  const t = useTranslations("dashboard");
  const tChallenges = useTranslations("challenges");
  const locale = useLocale();
  const { completions, isReady } = useGameProgress();

  if (!isReady) return null;

  const recommendation = recommendNextQuest(completions);

  if (!recommendation) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-2 py-8">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600">
            {t("nextGoal")}
          </span>
          <h3 className="text-xl font-extrabold tracking-[-0.02em] text-ink">
            {t("allQuestsDone")}
          </h3>
          <p className="text-sm tracking-tight text-ink-secondary">
            {t("allQuestsDoneDescription")}
          </p>
        </CardContent>
      </Card>
    );
  }

  const { quest, weakDimension, weakDimensionScore } = recommendation;
  const difficulty = DIFFICULTY_META[quest.difficulty];

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-8">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600">
          {t("nextGoal")}
        </span>

        {weakDimension && (
          <p className="rounded-2xl bg-accent-soft px-4 py-3 text-sm tracking-tight text-ink-secondary">
            {t("weakDimension")}{" "}
            <strong className="text-ink">{t(DIMENSION_KEYS[weakDimension])}</strong>{" "}
            {t("weakDimensionScore", { score: weakDimensionScore ?? 0 })}. {t("weakDimensionHelp")}
          </p>
        )}

        <div className="flex items-start gap-3">
          <span className="text-3xl" role="img" aria-hidden>
            {quest.emoji}
          </span>
          <div className="flex flex-col gap-1.5">
            <span
              className={cn(
                "inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ring-1 ring-inset",
                difficulty.className
              )}
            >
              {tChallenges(difficulty.labelKey)}
            </span>
            <h3 className="text-lg font-extrabold leading-tight tracking-[-0.02em] text-ink">
              {pick(quest.questTitle, locale)}
            </h3>
          </div>
        </div>

        <p className="text-sm tracking-tight text-ink-secondary">{pick(quest.description, locale)}</p>

        <Button href={`/courses?tab=challenges&open=${quest.id}`} size="lg" className="w-full sm:w-fit">
          {t("goToQuest")}
        </Button>
      </CardContent>
    </Card>
  );
}
