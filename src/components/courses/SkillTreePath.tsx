"use client";

import { useState } from "react";
import { COURSE_MODULES, ALL_LESSONS, isLessonUnlocked, type CourseLesson } from "@/constants/courses";
import { useGameProgress } from "@/lib/game-progress/GameProgressContext";
import { LessonNode } from "@/components/courses/LessonNode";
import { LessonConsole } from "@/components/courses/LessonConsole";

const ZIGZAG_OFFSETS = [0, 56, 84, 56, 0, -56, -84, -56];

export function SkillTreePath() {
  const { isReady, completions, isChallengeCompleted } = useGameProgress();
  const [activeLesson, setActiveLesson] = useState<CourseLesson | null>(null);

  if (!isReady) return null;

  return (
    <div className="flex flex-col gap-16">
      {COURSE_MODULES.map((courseModule) => (
        <div key={courseModule.id} className="flex flex-col gap-10">
          <div className="mx-auto flex max-w-md flex-col items-center gap-2 text-center">
            <span className="inline-flex w-fit items-center rounded-full bg-gradient-to-tr from-indigo-50 to-pink-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600 ring-1 ring-inset ring-indigo-100">
              Модуль
            </span>
            <h2 className="text-2xl font-black tracking-[-0.02em] text-ink">{courseModule.title}</h2>
            <p className="text-sm tracking-tight text-ink-secondary">{courseModule.description}</p>
          </div>

          <div className="mx-auto flex w-full max-w-xs flex-col items-center">
            {courseModule.lessons.map((lesson, lessonIndex) => {
              const globalIndex = ALL_LESSONS.findIndex((entry) => entry.id === lesson.id);
              const unlocked = isLessonUnlocked(lesson.id, completions);
              const completed = isChallengeCompleted(lesson.id);
              const isActive = unlocked && !completed;
              const offset = ZIGZAG_OFFSETS[globalIndex % ZIGZAG_OFFSETS.length];
              const isLastInModule = lessonIndex === courseModule.lessons.length - 1;

              return (
                <div key={lesson.id} className="flex flex-col items-center">
                  <LessonNode
                    lesson={lesson}
                    unlocked={unlocked}
                    completed={completed}
                    isActive={isActive}
                    offset={offset}
                    onOpen={() => setActiveLesson(lesson)}
                  />
                  {!isLastInModule && (
                    <span className="h-10 w-1 rounded-full bg-zinc-200/80" aria-hidden />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {activeLesson && <LessonConsole lesson={activeLesson} onClose={() => setActiveLesson(null)} />}
    </div>
  );
}
