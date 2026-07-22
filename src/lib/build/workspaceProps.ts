import type { SupabaseClient } from "@supabase/supabase-js";
import { getLocale, getTranslations } from "next-intl/server";
import type { Database } from "@/types/supabase";
import { pick } from "@/i18n/content";
import { getProjectTasks, getProjectOutputs } from "@/lib/build/queries";
import { STAGE_LABELS } from "@/lib/build/pathwayTemplates";
import { buildSnapshot, destinationGoalKey, parseSnapshotFields } from "@/lib/build/snapshot";
import { loadProjectAssistant } from "@/lib/actions/assistant";
import { getProofCount } from "@/lib/actions/proof";
import type { WorkspaceViewProps } from "@/components/build/WorkspaceView";
import type { RoadmapStage } from "@/components/build/RoadmapPanel";

type Client = SupabaseClient<Database>;
type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];

// Assembles every prop the immersive WorkspaceView needs for one explicit
// project. Both /build/workspace (legacy, current-project) and /projects/[id]
// (multi-project) call this with a project they've already resolved and
// ownership-checked, so all reads below are scoped to that exact project.id —
// there is no getCurrentProject call in here. The only difference between the
// two callers is `pitchHref`: the legacy route passes the pitch destination;
// the new route omits it (Pitch is retired from the multi-project surface),
// which hides the pitch entry entirely.
export async function buildWorkspaceViewProps(
  supabase: Client,
  project: ProjectRow,
  opts: { pitchHref?: string } = {}
): Promise<WorkspaceViewProps> {
  // Tasks, outputs, the preheated assistant conversation and the proof count are
  // all independent reads for this project — fetch them in parallel so the
  // workspace isn't a request waterfall.
  const [tasks, outputs, assistant, proofCount] = await Promise.all([
    getProjectTasks(supabase, project.id),
    getProjectOutputs(supabase, project.id),
    loadProjectAssistant(project.id),
    getProofCount(supabase, project.id),
  ]);

  const t = await getTranslations("build");
  const locale = await getLocale();
  type BuildKey = Parameters<typeof t>[0];

  const projectName = project.name || t("untitledProject");
  const goalName = project.name || t("destProjectFallback");
  const nextTask = tasks.find((task) => task.status !== "completed") ?? null;
  const completedCount = tasks.filter((task) => task.status === "completed").length;

  const outputByTaskId = new Map(outputs.map((o) => [o.task_id, o.content]));
  const savedFields = parseSnapshotFields(project.snapshot_fields);
  const snapshot = buildSnapshot(project, tasks, outputs, savedFields);

  const stageLabel =
    project.current_stage && STAGE_LABELS[project.current_stage]
      ? pick(STAGE_LABELS[project.current_stage], locale)
      : "—";

  const languageLabel = project.locale === "ru" ? "Русский" : "English";
  const goalLine = t(destinationGoalKey(project.intended_outcome) as BuildKey, { name: goalName });

  // Group tasks by stage, preserving pathway order.
  const stageOrder: string[] = [];
  const tasksByStage = new Map<string, typeof tasks>();
  for (const task of tasks) {
    if (!tasksByStage.has(task.stage)) {
      stageOrder.push(task.stage);
      tasksByStage.set(task.stage, []);
    }
    tasksByStage.get(task.stage)!.push(task);
  }

  const roadmap: RoadmapStage[] = stageOrder.map((stage) => {
    const stageTasks = tasksByStage.get(stage) ?? [];
    return {
      key: stage,
      label: STAGE_LABELS[stage] ? pick(STAGE_LABELS[stage], locale) : stage,
      complete: stageTasks.every((task) => task.status === "completed"),
      tasks: stageTasks.map((task) => {
        const completed = task.status === "completed";
        return {
          id: task.id,
          title: task.title,
          expectedOutput: task.expected_output,
          estimatedTime: task.estimated_time,
          xp: task.xp,
          completed,
          output: completed ? outputByTaskId.get(task.id) ?? null : null,
        };
      }),
    };
  });

  // A project with no roadmap tasks was created through the new AI creation
  // flow (the legacy flow always generates tasks). It hasn't produced its first
  // version yet, so the workspace acknowledges the created direction and offers
  // the Stage 3 handoff instead of a roadmap.
  const awaitingFirstVersion =
    tasks.length === 0 &&
    project.current_stage === null &&
    project.progress === 0 &&
    project.intended_outcome === "first_version";

  // Deterministic, project-specific greeting for the empty conversation.
  let openingMessage: string;
  if (awaitingFirstVersion) {
    const direction = savedFields.solution ?? null;
    openingMessage = direction
      ? t("assistantCreatedGreeting", { name: projectName, direction })
      : t("assistantCreatedGreetingSimple", { name: projectName });
  } else {
    openingMessage = nextTask
      ? t("assistantOpeningTask", { name: projectName, task: nextTask.title })
      : t("assistantOpeningDone", { name: projectName });
  }

  return {
    projectId: project.id,
    projectName,
    projectConcept: savedFields.solution ?? null,
    projectAudience: savedFields.audience ?? project.target_audience ?? null,
    stageLabel,
    languageLabel,
    progress: project.progress,
    completedCount,
    totalCount: tasks.length,
    proofCount,
    awaitingFirstVersion,
    nextTask: nextTask ? { id: nextTask.id, title: nextTask.title } : null,
    pitchHref: opts.pitchHref,
    goalLine,
    snapshot,
    roadmap,
    showRefine: nextTask !== null,
    assistant: {
      available: assistant.available,
      conversationId: assistant.conversationId,
      messages: assistant.messages,
      phase: assistant.phase,
    },
    openingMessage,
  };
}
