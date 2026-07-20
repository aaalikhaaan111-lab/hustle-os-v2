"use client";

import { useLocale, useTranslations } from "next-intl";
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
  labelKey: "firstStepDone" | "watchLesson" | "completeTodayTask" | "tryWorkshop";
  ctaKey?: "watch" | "start" | "open";
  done: boolean;
  href?: string;
}

function PlanRow({ item }: { item: PlanItem }) {
  const t = useTranslations("dashboard");

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
        {t(item.labelKey)}
      </span>
      {!item.done && item.href && (
        <Button href={item.href} variant="ghost" size="sm">
          {t(item.ctaKey ?? "open")}
        </Button>
      )}
    </li>
  );
}

export function DailyPlanCard() {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const { completions, isReady } = useGameProgress();

  if (!isReady) return null;

  const courseProgress = getCourseProgress(completions, locale);
  const today = todayStamp();
  const completedToday = completions.some((c) => c.completedAt.startsWith(today));
  const recommendation = recommendNextQuest(completions);

  const items: PlanItem[] = [
    { labelKey: "firstStepDone", done: completions.length > 0 },
    {
      labelKey: "watchLesson",
      done: courseProgress.completedLessons > 0,
      href: "/courses",
      ctaKey: "watch",
    },
    {
      labelKey: "completeTodayTask",
      done: completedToday,
      href: recommendation
        ? `/courses?tab=challenges&open=${recommendation.quest.id}`
        : "/courses?tab=challenges",
      ctaKey: "start",
    },
    {
      labelKey: "tryWorkshop",
      done: false,
      href: "/workshops",
      ctaKey: "open",
    },
  ];

  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-8">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600">
          {t("dailyPlanTitle")}
        </span>
        <ul className="mt-2 flex flex-col divide-y divide-zinc-100">
          {items.map((item) => (
            <PlanRow key={item.labelKey} item={item} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
