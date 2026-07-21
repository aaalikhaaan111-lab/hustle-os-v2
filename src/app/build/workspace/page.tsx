import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { pick } from "@/i18n/content";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { getCurrentProject, getProjectTasks, getProjectOutputs } from "@/lib/build/queries";
import { STAGE_LABELS } from "@/lib/build/pathwayTemplates";
import { buildSnapshot, destinationGoalKey, parseSnapshotFields } from "@/lib/build/snapshot";
import { loadProjectAssistant } from "@/lib/actions/assistant";
import { WorkspaceView } from "@/components/build/WorkspaceView";
import type { RoadmapStage } from "@/components/build/RoadmapPanel";

export default async function ProjectWorkspacePage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    redirect("/login");
  }

  const project = await getCurrentProject(supabase, user.id);
  if (!project) {
    redirect("/build");
  }

  // Tasks, outputs and the preheated assistant conversation are all independent
  // reads for this project — fetch them in parallel so the workspace isn't a
  // request waterfall (and the chat renders without a second client round-trip).
  const [tasks, outputs, assistant] = await Promise.all([
    getProjectTasks(supabase, project.id),
    getProjectOutputs(supabase, project.id),
    loadProjectAssistant(project.id),
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

  // Deterministic, project-specific greeting for the empty conversation.
  const openingMessage = nextTask
    ? t("assistantOpeningTask", { name: projectName, task: nextTask.title })
    : t("assistantOpeningDone", { name: projectName });

  return (
    <WorkspaceView
      projectId={project.id}
      projectName={projectName}
      stageLabel={stageLabel}
      languageLabel={languageLabel}
      progress={project.progress}
      completedCount={completedCount}
      totalCount={tasks.length}
      proofCount={0}
      nextTask={nextTask ? { id: nextTask.id, title: nextTask.title } : null}
      pitchHref="/build/workspace/pitch"
      goalLine={goalLine}
      snapshot={snapshot}
      roadmap={roadmap}
      showRefine={nextTask !== null}
      assistant={{
        available: assistant.available,
        conversationId: assistant.conversationId,
        messages: assistant.messages,
        phase: assistant.phase,
      }}
      openingMessage={openingMessage}
    />
  );
}
