"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { saveTaskOutputAction } from "@/lib/actions/build";
import { useGameProgress } from "@/lib/game-progress/GameProgressContext";
import type { Database } from "@/types/supabase";

type ProjectTask = Database["public"]["Tables"]["project_tasks"]["Row"];

interface TaskDetailFormProps {
  task: ProjectTask;
  existingAnswer: string;
  recommendedLessonTitle: string | null;
}

export function TaskDetailForm({ task, existingAnswer, recommendedLessonTitle }: TaskDetailFormProps) {
  const t = useTranslations("build");
  const router = useRouter();
  const { completeChallenge } = useGameProgress();
  const [answer, setAnswer] = useState(existingAnswer);
  const [error, setError] = useState<string | null>(null);
  const [savedState, setSavedState] = useState<"idle" | "saved" | "project_completed">(
    task.status === "completed" ? "saved" : "idle"
  );
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await saveTaskOutputAction(task.id, answer);
      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.xpAwarded) {
        completeChallenge({
          challengeId: `build:${task.id}`,
          title: task.title,
          emoji: "🛠️",
          categoryLabel: t("categoryLabel"),
          xp: result.xpAmount,
          answer: answer.trim(),
        });
        confetti({ particleCount: 80, spread: 80, origin: { y: 0.6 }, colors: ["#4f46e5", "#9333ea", "#ec4899"] });
      }

      setSavedState(result.projectCompleted ? "project_completed" : "saved");
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-16">
      <Card>
        <CardContent className="flex flex-col gap-4 py-8">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-ink-muted">
            <span className="rounded-full bg-surface-hover px-2.5 py-1">{task.estimated_time}</span>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-600 ring-1 ring-inset ring-amber-100">
              +{task.xp} XP
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600">
              {t("whyItMattersLabel")}
            </span>
            <p className="text-sm leading-relaxed tracking-tight text-ink-secondary">{task.why_it_matters}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600">
              {t("actionLabel")}
            </span>
            <p className="text-sm leading-relaxed tracking-tight text-ink">{task.action}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600">
              {t("expectedOutputLabel")}
            </span>
            <p className="text-sm leading-relaxed tracking-tight text-ink-secondary">{task.expected_output}</p>
          </div>

          {recommendedLessonTitle && (
            <a
              href="/courses?tab=quizzes"
              className="flex items-center gap-3 rounded-2xl bg-accent-soft px-4 py-3 text-sm font-semibold text-accent transition-colors hover:bg-indigo-100"
            >
              <span aria-hidden>📚</span>
              <span>
                {t("helpfulLesson")}: {recommendedLessonTitle}
              </span>
            </a>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 py-8">
          <h2 className="text-base font-bold text-ink">{t("yourAnswerLabel")}</h2>
          <p className="text-xs tracking-tight text-ink-muted">{task.completion_criteria}</p>
          {task.output_kind === "text" ? (
            <input
              type="text"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              disabled={isPending}
              placeholder={t("answerPlaceholder")}
              className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          ) : (
            <textarea
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              disabled={isPending}
              rows={6}
              placeholder={t("answerPlaceholder")}
              className="w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-muted transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          {savedState !== "idle" && (
            <p className="text-sm font-semibold text-success">
              {savedState === "project_completed" ? t("projectCompletedNotice") : t("answerSavedNotice")}
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={handleSubmit} disabled={isPending} size="lg" className="w-full sm:w-fit">
              {isPending ? t("saving") : t("saveAnswer")}
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className="w-full sm:w-fit"
              onClick={() => router.push(savedState === "project_completed" ? "/build/workspace/pitch" : "/build/workspace")}
            >
              {savedState === "project_completed" ? t("viewPitch") : t("backToWorkspace")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
