"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type ContextMode = "project" | "roadmap" | "proof";

interface ProjectHeaderBarProps {
  projectName: string;
  stageLabel: string;
  languageLabel: string;
  completedCount: number;
  totalCount: number;
  proofCount: number;
  nextTask: { id: string; title: string } | null;
  pitchHref: string;
  onOpenContext: (mode: ContextMode) => void;
}

// A compact header integrated into the canvas — the identity + status of the
// current project, not a dashboard toolbar. Name is primary; stage/progress
// secondary; the next action is a calm CTA; project context is one tap away.
export function ProjectHeaderBar({
  projectName,
  stageLabel,
  languageLabel,
  completedCount,
  totalCount,
  proofCount,
  nextTask,
  pitchHref,
  onOpenContext,
}: ProjectHeaderBarProps) {
  const t = useTranslations("build");
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="shrink-0 border-b border-border/50 bg-canvas/70 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-2.5 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="relative flex items-center gap-1">
              <h1 className="truncate text-lg font-bold tracking-tight text-ink">{projectName}</h1>
              <button
                type="button"
                aria-label={t("projectMenu")}
                onClick={() => setMenuOpen((v) => !v)}
                className="shrink-0 rounded-full p-1 text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
                  <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {menuOpen && (
                <>
                  <button
                    type="button"
                    aria-hidden
                    tabIndex={-1}
                    onClick={() => setMenuOpen(false)}
                    className="fixed inset-0 z-30 cursor-default"
                  />
                  <div className="absolute left-0 top-8 z-40 w-44 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg">
                    <Link
                      href={pitchHref}
                      className="block px-3.5 py-2 text-sm text-ink-secondary transition-colors hover:bg-surface-hover hover:text-ink"
                    >
                      {t("viewPitch")}
                    </Link>
                  </div>
                </>
              )}
            </div>
            <p className="mt-0.5 truncate text-[12px] tracking-tight text-ink-secondary">
              {stageLabel} · {t("hdrTasksOf", { completed: completedCount, total: totalCount })} ·{" "}
              {t("hdrProofsCount", { count: proofCount })} · {languageLabel}
            </p>
          </div>

          {/* Context triggers */}
          <div className="flex shrink-0 items-center gap-1">
            <ContextButton label={t("ctxProject")} onClick={() => onOpenContext("project")} />
            <ContextButton label={t("roadmapTitle")} onClick={() => onOpenContext("roadmap")} />
            <ContextButton
              label={proofCount > 0 ? `${t("ctxProof")} ${proofCount}` : t("ctxProof")}
              onClick={() => onOpenContext("proof")}
            />
          </div>
        </div>

        {/* Next action */}
        {nextTask && (
          <Link
            href={`/build/workspace/task/${nextTask.id}`}
            className="inline-flex w-fit max-w-full items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-[13px] font-semibold text-accent transition-colors hover:bg-accent/15"
          >
            <span className="truncate">{t("hdrContinue", { task: nextTask.title })}</span>
            <span aria-hidden>→</span>
          </Link>
        )}
      </div>
    </header>
  );
}

function ContextButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border border-border bg-surface/60 px-2.5 py-1 text-[12px] font-semibold text-ink-secondary transition-colors hover:bg-surface-hover hover:text-ink"
      )}
    >
      {label}
    </button>
  );
}
