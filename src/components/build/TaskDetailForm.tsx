"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { reviewTaskAnswerAction } from "@/lib/actions/build";
import { useGameProgress } from "@/lib/game-progress/GameProgressContext";
import type { Database } from "@/types/supabase";
import type { TaskReview } from "@/lib/build/types";

type ProjectTask = Database["public"]["Tables"]["project_tasks"]["Row"];

interface TaskDetailFormProps {
  task: ProjectTask;
  existingAnswer: string;
  recommendedLessonTitle: string | null;
  initialReview: TaskReview | null;
}

export function TaskDetailForm({
  task,
  existingAnswer,
  recommendedLessonTitle,
  initialReview,
}: TaskDetailFormProps) {
  const t = useTranslations("build");
  const router = useRouter();
  const { completeChallenge } = useGameProgress();
  const [answer, setAnswer] = useState(existingAnswer);
  const [review, setReview] = useState<TaskReview | null>(initialReview);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(task.status === "completed");
  const [projectCompleted, setProjectCompleted] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (isPending) return; // request lock — prevents duplicate reviews / cost
    setError(null);
    startTransition(async () => {
      const result = await reviewTaskAnswerAction(task.id, answer);
      if (result.error) {
        setError(result.error);
        return;
      }
      setReview(result.review);

      if (result.completed) {
        setCompleted(true);
        completeChallenge({
          challengeId: `build:${task.id}`,
          title: task.title,
          emoji: "🛠️",
          categoryLabel: t("categoryLabel"),
          xp: result.xpAmount,
          answer: answer.trim(),
        });
        confetti({
          particleCount: 80,
          spread: 80,
          origin: { y: 0.6 },
          colors: ["#4f46e5", "#9333ea", "#ec4899"],
        });
      }
      if (result.projectCompleted) setProjectCompleted(true);
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-16">
      <Card>
        <CardContent className="flex flex-col gap-4 py-8">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            <span className="rounded-full bg-surface-hover px-2.5 py-1 font-medium">
              {task.estimated_time}
            </span>
            <span className="font-medium">{t("xpShort", { xp: task.xp })}</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600">
              {t("whyItMattersLabel")}
            </span>
            <p className="text-sm leading-relaxed tracking-tight text-ink-secondary">
              {task.why_it_matters}
            </p>
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
            <p className="text-sm leading-relaxed tracking-tight text-ink-secondary">
              {task.expected_output}
            </p>
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

          {review && <ReviewFeedback review={review} completed={completed} />}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={handleSubmit} disabled={isPending} size="lg" className="w-full sm:w-fit">
              {isPending
                ? t("reviewing")
                : completed
                  ? t("resubmitForReview")
                  : t("submitForReview")}
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className="w-full sm:w-fit"
              onClick={() =>
                router.push(projectCompleted ? "/build/workspace/pitch" : "/build/workspace")
              }
            >
              {projectCompleted ? t("viewPitch") : t("backToWorkspace")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReviewFeedback({ review, completed }: { review: TaskReview; completed: boolean }) {
  const t = useTranslations("build");
  const ready = review.status === "ready";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border p-4",
        ready ? "border-emerald-100 bg-emerald-50/60" : "border-amber-100 bg-amber-50/60"
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.1em]",
            ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
          )}
        >
          {ready ? `✓ ${t("reviewReady")}` : t("reviewNeedsWork")}
        </span>
        {completed && ready && (
          <span className="text-xs font-semibold text-emerald-700">{t("reviewCompleteHint")}</span>
        )}
      </div>

      <p className="text-sm leading-relaxed tracking-tight text-ink-secondary">{review.summary}</p>

      {review.strengths.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-700">
            {t("reviewStrengths")}
          </span>
          <ul className="flex flex-col gap-0.5">
            {review.strengths.map((s, i) => (
              <li key={i} className="text-sm tracking-tight text-ink-secondary">
                ✓ {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {review.missingPoints.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-700">
            {t("reviewMissing")}
          </span>
          <ul className="flex flex-col gap-0.5">
            {review.missingPoints.map((s, i) => (
              <li key={i} className="text-sm tracking-tight text-ink-secondary">
                • {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {review.nextImprovement && (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-600">
            {t("reviewNext")}
          </span>
          <p className="text-sm tracking-tight text-ink">{review.nextImprovement}</p>
        </div>
      )}

      {review.improvedExample && (
        <div className="flex flex-col gap-1 rounded-xl bg-white/70 px-3 py-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted">
            {t("reviewExample")}
          </span>
          <p className="text-sm italic tracking-tight text-ink-secondary">{review.improvedExample}</p>
        </div>
      )}
    </div>
  );
}
