"use client";

import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CheckIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { useGameProgress } from "@/lib/game-progress/GameProgressContext";
import { getCourseProgress } from "@/constants/courses";
import { recommendNextQuest } from "@/lib/game-progress/recommendation";

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

interface PlanItem {
  label: string;
  done: boolean;
  href?: string;
  cta?: string;
}

function PlanRow({ item }: { item: PlanItem }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
          item.done ? "border-success bg-success text-white" : "border-zinc-300 bg-white/70"
        )}
      >
        {item.done && <CheckIcon className="h-3 w-3" />}
      </span>
      <span
        className={cn(
          "flex-1 text-sm font-medium tracking-tight text-ink-secondary",
          item.done && "text-ink-muted line-through"
        )}
      >
        {item.label}
      </span>
      {!item.done && item.href && (
        <Button href={item.href} variant="ghost" size="sm">
          {item.cta ?? "Перейти"}
        </Button>
      )}
    </li>
  );
}

export function DailyPlanCard() {
  const { completions, isReady } = useGameProgress();

  if (!isReady) return null;

  const courseProgress = getCourseProgress(completions);
  const today = todayStamp();
  const completedToday = completions.some((c) => c.completedAt.startsWith(today));
  const recommendation = recommendNextQuest(completions);

  const items: PlanItem[] = [
    { label: "Первый шаг выполнен", done: completions.length > 0 },
    {
      label: "Посмотреть один короткий урок",
      done: courseProgress.completedLessons > 0,
      href: "/courses",
      cta: "Смотреть",
    },
    {
      label: "Выполнить сегодняшнее задание",
      done: completedToday,
      href: recommendation ? `/challenges?open=${recommendation.quest.id}` : "/challenges",
      cta: "Начать",
    },
    {
      label: "Попробовать Workshop с другом",
      done: false,
      href: "/workshops",
      cta: "Открыть",
    },
  ];

  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-8">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600">
          Твой план на сегодня
        </span>
        <ul className="mt-2 flex flex-col divide-y divide-zinc-100">
          {items.map((item) => (
            <PlanRow key={item.label} item={item} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
