"use client";

import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useGameProgress } from "@/lib/game-progress/GameProgressContext";
import { recommendNextQuest } from "@/lib/game-progress/recommendation";
import { DIFFICULTY_META } from "@/lib/challenges";
import { cn } from "@/lib/utils";

export function NextGoalCard() {
  const { completions, isReady } = useGameProgress();

  if (!isReady) return null;

  const recommendation = recommendNextQuest(completions);

  if (!recommendation) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-2 py-8">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600">
            Ближайшая цель
          </span>
          <h3 className="text-xl font-extrabold tracking-[-0.02em] text-ink">
            Ты прошёл все квесты! 🏆
          </h3>
          <p className="text-sm tracking-tight text-ink-secondary">
            Невероятный результат. Загляни на дашборд позже — мы готовим новые квесты.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { quest, weakDimensionLabel, weakDimensionScore } = recommendation;
  const difficulty = DIFFICULTY_META[quest.difficulty];

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-8">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600">
          Ближайшая цель
        </span>

        {weakDimensionLabel && (
          <p className="rounded-2xl bg-accent-soft px-4 py-3 text-sm tracking-tight text-ink-secondary">
            Слабое место по твоим ответам: <strong className="text-ink">{weakDimensionLabel}</strong>{" "}
            (в среднем {weakDimensionScore}/10). Этот квест поможет подтянуть именно это.
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
              {difficulty.label}
            </span>
            <h3 className="text-lg font-extrabold leading-tight tracking-[-0.02em] text-ink">
              {quest.questTitle}
            </h3>
          </div>
        </div>

        <p className="text-sm tracking-tight text-ink-secondary">{quest.description}</p>

        <Button href={`/challenges?open=${quest.id}`} size="lg" className="w-full sm:w-fit">
          Перейти к квесту
        </Button>
      </CardContent>
    </Card>
  );
}
