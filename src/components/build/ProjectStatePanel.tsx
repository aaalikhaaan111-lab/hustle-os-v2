"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { SnapshotRow } from "@/lib/build/snapshot";

interface ProjectStatePanelProps {
  goalLine: string;
  snapshot: SnapshotRow[];
  className?: string;
}

// Compact live view of the project's real saved outputs (Problem, Audience,
// Solution, …). Content comes ONLY from the snapshot — undefined fields show
// "Not defined yet" rather than any invented value.
export function ProjectStatePanel({ goalLine, snapshot, className }: ProjectStatePanelProps) {
  const t = useTranslations("build");
  type BuildKey = Parameters<typeof t>[0];

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-muted">
          {t("statePanelTitle")}
        </h2>
        <p className="text-xs leading-snug tracking-tight text-ink-secondary">{goalLine}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        {snapshot.map((row) => {
          const defined = row.value !== null;
          const inner = (
            <>
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-muted">
                {t(row.labelKey as BuildKey)}
              </span>
              <span
                className={cn(
                  "line-clamp-2 text-[13px] leading-snug",
                  defined ? "font-medium text-ink" : "italic text-ink-muted"
                )}
              >
                {defined ? row.value : t("snapNotDefined")}
              </span>
            </>
          );
          const base =
            "flex flex-col gap-0.5 rounded-xl border border-border/50 px-3 py-2 transition-colors";
          return row.taskId ? (
            <Link
              key={row.labelKey}
              href={`/build/workspace/task/${row.taskId}`}
              className={cn(base, "bg-white/50 hover:bg-white/80")}
            >
              {inner}
            </Link>
          ) : (
            <div key={row.labelKey} className={cn(base, "bg-white/30")}>
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
