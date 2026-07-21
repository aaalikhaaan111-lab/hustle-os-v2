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

// The project as a living document: each field is a quiet label followed by its
// current value (or "Not defined yet"). Content comes ONLY from saved outputs —
// never invented. Values confirmed from the conversation carry a subtle accent
// marker so it's clear the chat is what's building the project.
export function ProjectStatePanel({ goalLine, snapshot, className }: ProjectStatePanelProps) {
  const t = useTranslations("build");
  type BuildKey = Parameters<typeof t>[0];

  return (
    <div className={cn("flex flex-col", className)}>
      <p className="mb-1 text-[13px] leading-snug tracking-tight text-ink-secondary">{goalLine}</p>

      <div className="flex flex-col divide-y divide-border/40">
        {snapshot.map((row) => {
          const defined = row.value !== null;
          const fromChat = row.source === "assistant";
          const inner = (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
                  {t(row.labelKey as BuildKey)}
                </span>
                {fromChat && <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />}
              </div>
              <p
                className={cn(
                  "mt-1 text-[14px] leading-relaxed",
                  defined ? "text-ink" : "italic text-ink-muted"
                )}
              >
                {defined ? row.value : t("snapNotDefined")}
              </p>
            </>
          );
          return row.taskId ? (
            <Link
              key={row.labelKey}
              href={`/build/workspace/task/${row.taskId}`}
              className="group -mx-2 rounded-lg px-2 py-3 transition-colors hover:bg-surface-hover"
            >
              {inner}
            </Link>
          ) : (
            <div key={row.labelKey} className="px-0 py-3">
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
