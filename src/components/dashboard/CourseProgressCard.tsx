"use client";

import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useGameProgress } from "@/lib/game-progress/GameProgressContext";
import { getCourseProgress } from "@/constants/courses";

export function CourseProgressCard() {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const { completions, isReady } = useGameProgress();

  if (!isReady) return null;

  const progress = getCourseProgress(completions, locale);

  return (
    <Card>
      <CardContent className="flex h-full flex-col gap-6 py-9">
        <div className="flex items-center gap-4">
          <span className="text-4xl" role="img" aria-hidden>
            📚
          </span>
          <div className="flex flex-col gap-2">
            <span className="inline-flex w-fit items-center rounded-full bg-accent-soft px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-accent shadow-[0_2px_12px_rgba(99,102,241,0.12)] ring-1 ring-inset ring-accent/20">
              {progress.activeModuleTitle || t("courseFallback")}
            </span>
            <h3 className="text-xl font-extrabold leading-tight tracking-[-0.02em] text-ink">
              {progress.allDone
                ? t("allLessonsDone")
                : progress.currentLessonTitle || t("startFirstLesson")}
            </h3>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-bold tracking-wide text-ink-secondary">
            <span>
              {t("lessonsCompleted", {
                completed: progress.completedLessons,
                total: progress.totalLessons,
              })}
            </span>
            <span>{progress.percent}%</span>
          </div>
          <div className="h-4 w-full overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-inset ring-white/10 backdrop-blur-sm">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2 shadow-[0_0_12px_rgba(147,51,234,0.5)] transition-all duration-700 ease-out"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
        <Button href="/courses" variant="secondary" className="mt-auto w-fit">
          {t("watchLessons")}
        </Button>
      </CardContent>
    </Card>
  );
}
