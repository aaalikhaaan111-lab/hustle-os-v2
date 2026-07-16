"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { CourseLesson } from "@/constants/courses";

interface LessonNodeProps {
  lesson: CourseLesson;
  unlocked: boolean;
  completed: boolean;
  isActive: boolean;
  offset: number;
  onOpen: () => void;
}

export function LessonNode({ lesson, unlocked, completed, isActive, offset, onOpen }: LessonNodeProps) {
  const t = useTranslations("courses");

  return (
    <div
      className="flex flex-col items-center gap-2 transition-transform duration-500 ease-out"
      style={{ transform: `translateX(${offset}px)` }}
    >
      <button
        type="button"
        disabled={!unlocked}
        onClick={onOpen}
        aria-label={unlocked ? lesson.title : t("lessonLockedAria", { title: lesson.title })}
        className={cn(
          "flex h-20 w-20 items-center justify-center rounded-full text-3xl transition-all duration-300 ease-out",
          completed &&
            "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-[0_12px_28px_rgba(16,185,129,0.35)] hover:scale-105",
          isActive &&
            "animate-glow-pulse bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 text-white hover:scale-105",
          !unlocked && "cursor-not-allowed bg-zinc-100 text-zinc-400 shadow-inner"
        )}
      >
        {completed ? "✅" : unlocked ? lesson.emoji : "🔒"}
      </button>
      <div className="flex max-w-[9rem] flex-col items-center gap-0.5 text-center">
        <span
          className={cn(
            "text-xs font-bold tracking-tight",
            unlocked ? "text-ink" : "text-ink-muted"
          )}
        >
          {lesson.title}
        </span>
        <span className="text-[10px] font-medium text-ink-muted">+{lesson.xpReward} XP</span>
      </div>
    </div>
  );
}
