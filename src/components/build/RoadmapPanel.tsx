"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { RefineTasksButton } from "@/components/build/RefineTasksButton";

export interface RoadmapTask {
  id: string;
  title: string;
  expectedOutput: string;
  estimatedTime: string;
  xp: number;
  completed: boolean;
  output: string | null;
}

export interface RoadmapStage {
  key: string;
  label: string;
  complete: boolean;
  tasks: RoadmapTask[];
}

interface RoadmapPanelProps {
  stages: RoadmapStage[];
  projectId: string;
  showRefine: boolean;
  className?: string;
}

// Roadmap as a focused mode: the current task (first not-yet-done) is
// prominent; completed work is quietly checked off; future tasks stay calm.
// Progressive disclosure — only the current task shows its full detail.
export function RoadmapPanel({ stages, projectId, showRefine, className }: RoadmapPanelProps) {
  const t = useTranslations("build");

  // The single current task across the whole pathway (first incomplete one).
  const currentTaskId = stages.flatMap((s) => s.tasks).find((task) => !task.completed)?.id ?? null;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {showRefine && <RefineTasksButton projectId={projectId} />}
      {stages.map((stage) => (
        <div key={stage.key} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-muted">
              {stage.label}
            </h3>
            {stage.complete && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-success ring-1 ring-inset ring-success/20">
                ✓ {t("stageReady")}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            {stage.tasks.map((task) => {
              const isCurrent = task.id === currentTaskId;
              return (
                <Link
                  key={task.id}
                  href={`/build/workspace/task/${task.id}`}
                  className={cn(
                    "flex items-start gap-2.5 rounded-xl border px-3 py-2 transition-colors",
                    isCurrent
                      ? "border-accent/30 bg-accent-soft/60 hover:bg-accent-soft"
                      : "border-border/50 bg-surface/50 hover:bg-surface"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                      task.completed
                        ? "bg-success text-white"
                        : isCurrent
                          ? "bg-accent text-white"
                          : "bg-surface-hover text-ink-muted"
                    )}
                  >
                    {task.completed ? "✓" : ""}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    {isCurrent && (
                      <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-accent">
                        {t("roadmapCurrent")}
                      </span>
                    )}
                    <span
                      className={cn(
                        "text-[13px] font-semibold leading-snug",
                        task.completed ? "text-ink-secondary" : "text-ink"
                      )}
                    >
                      {task.title}
                    </span>
                    {isCurrent && (
                      <span className="line-clamp-2 text-[11px] text-ink-secondary">{task.expectedOutput}</span>
                    )}
                    {task.output && (
                      <span className="mt-0.5 line-clamp-2 rounded-lg bg-success-soft/70 px-2 py-1 text-[11px] italic text-ink-secondary">
                        {task.output}
                      </span>
                    )}
                    {isCurrent && (
                      <span className="mt-0.5 text-[10px] text-ink-muted">
                        {task.estimatedTime}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
