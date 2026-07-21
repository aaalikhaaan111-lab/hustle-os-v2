"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { SnapshotRow } from "@/lib/build/snapshot";
import { ProjectStatePanel } from "@/components/build/ProjectStatePanel";
import { RoadmapPanel, type RoadmapStage } from "@/components/build/RoadmapPanel";
import type { ProofPanelTask } from "@/components/build/ProofPanel";
import type { ContextMode } from "@/components/build/ProjectHeaderBar";

// Proof (with its upload code) is only pulled in when the Proof mode is opened.
const ProofPanel = dynamic(
  () => import("@/components/build/ProofPanel").then((mod) => mod.ProofPanel),
  { ssr: false }
);

interface ContextOverlayProps {
  mode: ContextMode;
  projectId: string;
  goalLine: string;
  snapshot: SnapshotRow[];
  roadmap: RoadmapStage[];
  showRefine: boolean;
  proofTasks: ProofPanelTask[];
  onClose: () => void;
}

// A focused right-side mode for project context. Opened on demand so it never
// permanently competes with the conversation; has its own scroll.
export function ContextOverlay({
  mode,
  projectId,
  goalLine,
  snapshot,
  roadmap,
  showRefine,
  proofTasks,
  onClose,
}: ContextOverlayProps) {
  const t = useTranslations("build");
  const title =
    mode === "project" ? t("statePanelTitle") : mode === "roadmap" ? t("roadmapTitle") : t("proofTitle");

  return (
    <div className="fixed inset-0 z-[80] flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label={t("assistantClose")}
        onClick={onClose}
        className="animate-overlay-in absolute inset-0 bg-[rgba(4,5,10,0.6)] backdrop-blur-[2px]"
      />
      <div className="animate-drawer-in relative flex h-full w-full flex-col border-l border-white/[0.08] bg-surface-elevated shadow-2xl sm:w-[400px]">
        <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <span className="text-sm font-bold tracking-tight text-ink">{title}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("assistantClose")}
            className="rounded-full px-2 py-1 text-ink-muted transition-colors hover:bg-surface-hover"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {mode === "project" ? (
            <ProjectStatePanel goalLine={goalLine} snapshot={snapshot} />
          ) : mode === "roadmap" ? (
            <RoadmapPanel stages={roadmap} projectId={projectId} showRefine={showRefine} />
          ) : (
            <ProofPanel projectId={projectId} tasks={proofTasks} />
          )}
        </div>
      </div>
    </div>
  );
}
