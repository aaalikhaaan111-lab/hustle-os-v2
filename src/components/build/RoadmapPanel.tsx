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

// Compact roadmap: small status rows grouped by stage. Kept visually secondary
// to the AI workspace — no oversized cards.
export function RoadmapPanel({ stages, projectId, showRefine, className }: RoadmapPanelProps) {
  const t = useTranslations("build");

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
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-emerald-600 ring-1 ring-inset ring-emerald-100">
                ✓ {t("stageReady")}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            {stage.tasks.map((task) => (
              <Link
                key={task.id}
                href={`/build/workspace/task/${task.id}`}
                className="flex items-start gap-2.5 rounded-xl border border-border/50 bg-white/60 px-3 py-2 transition-colors hover:bg-white/90"
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    task.completed ? "bg-emerald-500 text-white" : "bg-zinc-100 text-ink-muted"
                  )}
                >
                  {task.completed ? "✓" : ""}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[13px] font-semibold leading-snug text-ink">{task.title}</span>
                  <span className="line-clamp-1 text-[11px] text-ink-secondary">{task.expectedOutput}</span>
                  {task.output && (
                    <span className="mt-0.5 line-clamp-2 rounded-lg bg-emerald-50/60 px-2 py-1 text-[11px] italic text-ink-secondary">
                      {task.output}
                    </span>
                  )}
                  <span className="mt-0.5 text-[10px] text-ink-muted">
                    {task.estimatedTime} · {t("xpShort", { xp: task.xp })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
