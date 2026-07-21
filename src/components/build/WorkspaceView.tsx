"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { AssistantMessage } from "@/lib/actions/assistant";
import type { AssistantPhase } from "@/lib/build/assistantPrompts";
import type { SnapshotRow, StructuredField } from "@/lib/build/snapshot";
import { AssistantChat } from "@/components/build/AssistantChat";
import { ProjectStatePanel } from "@/components/build/ProjectStatePanel";
import { RoadmapPanel, type RoadmapStage } from "@/components/build/RoadmapPanel";

export interface WorkspaceViewProps {
  projectId: string;
  projectName: string;
  stageLabel: string;
  languageLabel: string;
  progress: number;
  completedCount: number;
  totalCount: number;
  proofCount: number;
  nextTask: { id: string; title: string } | null;
  pitchHref: string;
  goalLine: string;
  snapshot: SnapshotRow[];
  roadmap: RoadmapStage[];
  showRefine: boolean;
  assistant: {
    available: boolean;
    conversationId: string | null;
    messages: AssistantMessage[];
    phase: AssistantPhase;
  };
  openingMessage: string;
}

type Drawer = "state" | "roadmap" | null;

export function WorkspaceView(props: WorkspaceViewProps) {
  const t = useTranslations("build");
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [roadmapOpen, setRoadmapOpen] = useState(false);

  // The project-state panel updates live when the assistant saves a structured
  // field, without waiting for a full navigation. The server revalidate still
  // reconciles this on the next load.
  const [snapshot, setSnapshot] = useState<SnapshotRow[]>(props.snapshot);

  const existingValues = useMemo(() => {
    const map: Partial<Record<StructuredField, string>> = {};
    for (const row of snapshot) {
      if (row.field && row.value) map[row.field] = row.value;
    }
    return map;
  }, [snapshot]);

  function handleFieldSaved(field: StructuredField, value: string) {
    setSnapshot((prev) =>
      prev.map((row) =>
        row.field === field ? { ...row, value, source: "assistant" } : row
      )
    );
  }

  const meta = [
    props.stageLabel,
    t("hdrTasksCount", { completed: props.completedCount, total: props.totalCount }),
    t("hdrProofsCount", { count: props.proofCount }),
    props.languageLabel,
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Compact project header ─── */}
      <header className="flex flex-col gap-3 border-b border-border/60 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="truncate text-xl font-black tracking-[-0.02em] text-ink sm:text-2xl">
              {props.projectName}
            </h1>
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-medium tracking-tight text-ink-secondary">
              {meta.map((part, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-ink-muted" aria-hidden>·</span>}
                  {part}
                </span>
              ))}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {props.nextTask ? (
              <Link
                href={`/build/workspace/task/${props.nextTask.id}`}
                className="inline-flex max-w-[14rem] items-center gap-1.5 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition-transform hover:scale-[1.02] active:scale-95"
              >
                <span className="truncate">{t("hdrNextAction", { task: props.nextTask.title })}</span>
                <span aria-hidden>→</span>
              </Link>
            ) : (
              <Link
                href={props.pitchHref}
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition-transform hover:scale-[1.02] active:scale-95"
              >
                {t("viewPitch")}
              </Link>
            )}
            <Link
              href={props.pitchHref}
              className="hidden rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-ink-secondary transition-colors hover:bg-surface-hover sm:inline-flex"
            >
              {t("viewPitch")}
            </Link>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-900/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-700 ease-out"
              style={{ width: `${props.progress}%` }}
            />
          </div>
          <span className="text-[11px] font-bold tabular-nums text-ink-secondary">{props.progress}%</span>
        </div>
      </header>

      {/* ─── Workspace: chat (main) + project state (aside) ─── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Chat */}
        <div className="flex h-[calc(100dvh-16rem)] min-h-[440px] flex-col overflow-hidden rounded-3xl border border-border/60 bg-white/70 backdrop-blur-xl lg:h-[calc(100dvh-13rem)]">
          <AssistantChat
            projectId={props.projectId}
            available={props.assistant.available}
            initialConversationId={props.assistant.conversationId}
            initialMessages={props.assistant.messages}
            phase={props.assistant.phase}
            openingMessage={props.openingMessage}
            existingValues={existingValues}
            onFieldSaved={handleFieldSaved}
            className="h-full"
          />
        </div>

        {/* Aside (desktop only) */}
        <aside className="hidden flex-col gap-4 lg:flex">
          <div className="rounded-3xl border border-border/60 bg-white/70 p-4 backdrop-blur-xl">
            <ProjectStatePanel goalLine={props.goalLine} snapshot={snapshot} />
          </div>
          <div className="rounded-3xl border border-border/60 bg-white/70 p-4 backdrop-blur-xl">
            <button
              type="button"
              onClick={() => setRoadmapOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2"
            >
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-muted">
                {t("roadmapTitle")}
              </span>
              <span className="text-xs font-semibold text-ink-secondary">
                {roadmapOpen ? t("roadmapHide") : t("roadmapShow")}
              </span>
            </button>
            {roadmapOpen && (
              <div className="mt-3 border-t border-border/50 pt-3">
                <RoadmapPanel stages={props.roadmap} projectId={props.projectId} showRefine={props.showRefine} />
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ─── Mobile access to state + roadmap ─── */}
      <div className="grid grid-cols-2 gap-2 lg:hidden">
        <button
          type="button"
          onClick={() => setDrawer("state")}
          className="rounded-full border border-border bg-white/70 px-3 py-2 text-xs font-semibold text-ink-secondary transition-colors hover:bg-white/90"
        >
          {t("statePanelTitle")}
        </button>
        <button
          type="button"
          onClick={() => setDrawer("roadmap")}
          className="rounded-full border border-border bg-white/70 px-3 py-2 text-xs font-semibold text-ink-secondary transition-colors hover:bg-white/90"
        >
          {t("roadmapTitle")}
        </button>
      </div>

      {/* ─── Mobile drawer ─── */}
      {drawer && (
        <div className="fixed inset-0 z-[80] flex justify-end lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label={t("assistantClose")}
            onClick={() => setDrawer(null)}
            className="absolute inset-0 bg-[rgba(15,15,23,0.4)]"
          />
          <div className="relative flex h-full w-[88%] max-w-sm flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
              <span className="text-sm font-extrabold tracking-tight text-ink">
                {drawer === "state" ? t("statePanelTitle") : t("roadmapTitle")}
              </span>
              <button
                type="button"
                onClick={() => setDrawer(null)}
                aria-label={t("assistantClose")}
                className="rounded-full px-2 py-1 text-ink-muted transition-colors hover:bg-surface-hover"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {drawer === "state" ? (
                <ProjectStatePanel goalLine={props.goalLine} snapshot={snapshot} />
              ) : (
                <RoadmapPanel stages={props.roadmap} projectId={props.projectId} showRefine={props.showRefine} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
