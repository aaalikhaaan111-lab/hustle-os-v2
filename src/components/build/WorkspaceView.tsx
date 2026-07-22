"use client";

import { useMemo, useState } from "react";
import type { AssistantMessage } from "@/lib/actions/assistant";
import type { AssistantPhase } from "@/lib/build/assistantPrompts";
import type { SnapshotRow, StructuredField } from "@/lib/build/snapshot";
import { AssistantChat } from "@/components/build/AssistantChat";
import { ProjectHeaderBar, type ContextMode } from "@/components/build/ProjectHeaderBar";
import { ContextOverlay } from "@/components/build/ContextOverlay";
import type { RoadmapStage } from "@/components/build/RoadmapPanel";

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
  /** Pitch destination. Omitted on the multi-project surface, where Pitch is retired. */
  pitchHref?: string;
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

// The immersive Build canvas: a compact floating header, the AI conversation as
// the dominant central surface, and project context (state / roadmap / proof)
// opened as focused right-side modes rather than permanent panels.
export function WorkspaceView(props: WorkspaceViewProps) {
  const [mode, setMode] = useState<ContextMode | null>(null);

  // The project-state panel updates live when the assistant saves a structured
  // field, without waiting for a navigation; the server revalidate reconciles
  // it on the next load.
  const [snapshot, setSnapshot] = useState<SnapshotRow[]>(props.snapshot);

  const existingValues = useMemo(() => {
    const map: Partial<Record<StructuredField, string>> = {};
    for (const row of snapshot) {
      if (row.field && row.value) map[row.field] = row.value;
    }
    return map;
  }, [snapshot]);

  const proofTasks = useMemo(
    () =>
      props.roadmap.flatMap((stage) =>
        stage.tasks.map((task) => ({ id: task.id, title: task.title, stage: stage.key }))
      ),
    [props.roadmap]
  );

  function handleFieldSaved(field: StructuredField, value: string) {
    setSnapshot((prev) =>
      prev.map((row) => (row.field === field ? { ...row, value, source: "assistant" } : row))
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ProjectHeaderBar
        projectName={props.projectName}
        stageLabel={props.stageLabel}
        languageLabel={props.languageLabel}
        completedCount={props.completedCount}
        totalCount={props.totalCount}
        proofCount={props.proofCount}
        nextTask={props.nextTask}
        pitchHref={props.pitchHref}
        onOpenContext={setMode}
      />

      <div className="min-h-0 flex-1">
        <AssistantChat
          projectId={props.projectId}
          available={props.assistant.available}
          initialConversationId={props.assistant.conversationId}
          initialMessages={props.assistant.messages}
          phase={props.assistant.phase}
          openingMessage={props.openingMessage}
          existingValues={existingValues}
          onFieldSaved={handleFieldSaved}
        />
      </div>

      {mode && (
        <ContextOverlay
          mode={mode}
          projectId={props.projectId}
          goalLine={props.goalLine}
          snapshot={snapshot}
          roadmap={props.roadmap}
          showRefine={props.showRefine}
          proofTasks={proofTasks}
          onClose={() => setMode(null)}
        />
      )}
    </div>
  );
}
