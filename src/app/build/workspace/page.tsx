import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/utils";
import { pick } from "@/i18n/content";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { getCurrentProject, getProjectTasks, getProjectOutputs } from "@/lib/build/queries";
import { STAGE_LABELS } from "@/lib/build/pathwayTemplates";
import { PROJECT_TYPE_OPTIONS } from "@/lib/build/options";
import { buildSnapshot, destinationGoalKey } from "@/lib/build/snapshot";
import { RefineTasksButton } from "@/components/build/RefineTasksButton";
import { ProjectAssistant } from "@/components/build/ProjectAssistant";

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

  // Tasks and outputs are independent reads for this project — fetch them in
  // parallel so the workspace isn't a request waterfall.
  const [tasks, outputs] = await Promise.all([
    getProjectTasks(supabase, project.id),
    getProjectOutputs(supabase, project.id),
  ]);

  const t = await getTranslations("build");
  const locale = await getLocale();

  // Snapshot field labels and the destination goal key are computed
  // dynamically, but always resolve to real build.* message keys — cast so
  // next-intl's typed t() accepts them.
  type BuildKey = Parameters<typeof t>[0];

  const typeOption = PROJECT_TYPE_OPTIONS.find((option) => option.id === project.project_type);
  const projectName = project.name || t("untitledProject");
  const goalName = project.name || t("destProjectFallback");
  const nextTask = tasks.find((task) => task.status !== "completed");
  const completedCount = tasks.filter((task) => task.status === "completed").length;

  const outputByTaskId = new Map(outputs.map((o) => [o.task_id, o.content]));
  const snapshot = buildSnapshot(project, tasks, outputs);

  const currentStageLabel =
    project.current_stage && STAGE_LABELS[project.current_stage]
      ? pick(STAGE_LABELS[project.current_stage], locale)
      : "—";

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

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={typeOption ? `${typeOption.emoji} ${t(typeOption.labelKey)}` : undefined}
        title={projectName}
        description={t("workspaceDescription", { completed: completedCount, total: tasks.length })}
        actions={
          <Button href="/build/workspace/pitch" variant="secondary">
            {t("viewPitch")}
          </Button>
        }
      />

      {/* ─── Destination: where the pathway is leading ─── */}
      <Card className="overflow-hidden">
        <CardContent className="flex flex-col gap-4 py-7">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600">
              {t("yourGoal")}
            </span>
            <p className="text-base font-semibold leading-snug tracking-tight text-ink sm:text-lg">
              {t(destinationGoalKey(project.intended_outcome) as BuildKey, { name: goalName })}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-bold tracking-wide text-ink-secondary">
              <span>{t("progressLabel")}</span>
              <span>{project.progress}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-900/[0.04] ring-1 ring-inset ring-white/60 backdrop-blur-sm">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-700 ease-out"
                style={{ width: `${project.progress}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MetaCell label={t("destCurrentStage")} value={currentStageLabel} />
            <MetaCell label={t("destNextMilestone")} value={nextTask ? nextTask.title : t("destAllDone")} />
            <MetaCell label={t("destDeliverable")} value={t("destDeliverableValue")} />
          </div>
        </CardContent>
      </Card>

      {/* ─── Project Snapshot: what the project is, from saved work only ─── */}
      <Card>
        <CardContent className="flex flex-col gap-3 py-7">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-base font-extrabold tracking-[-0.01em] text-ink">{t("snapshotTitle")}</h3>
            <p className="text-xs tracking-tight text-ink-muted">{t("snapshotSubtitle")}</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {snapshot.map((row) => {
              const defined = row.value !== null;
              const inner = (
                <>
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted">
                    {t(row.labelKey as BuildKey)}
                  </span>
                  <span
                    className={cn(
                      "line-clamp-2 text-sm",
                      defined ? "font-medium text-ink" : "italic text-ink-muted"
                    )}
                  >
                    {defined ? row.value : t("snapNotDefined")}
                  </span>
                </>
              );
              return row.taskId ? (
                <Link
                  key={row.labelKey}
                  href={`/build/workspace/task/${row.taskId}`}
                  className="flex flex-col gap-1 rounded-xl border border-t-white/60 border-x-zinc-200/30 border-b-zinc-200/30 bg-white/60 px-3.5 py-2.5 transition-colors hover:bg-white/90"
                >
                  {inner}
                </Link>
              ) : (
                <div
                  key={row.labelKey}
                  className="flex flex-col gap-1 rounded-xl border border-t-white/60 border-x-zinc-200/30 border-b-zinc-200/30 bg-white/40 px-3.5 py-2.5"
                >
                  {inner}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ─── Next task / completion ─── */}
      {nextTask ? (
        <Card className="overflow-hidden">
          <CardContent className="flex flex-col gap-4 py-8">
            <span className="inline-flex w-fit items-center rounded-full bg-gradient-to-tr from-indigo-50 to-pink-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600 shadow-[0_2px_12px_rgba(99,102,241,0.12)] ring-1 ring-inset ring-indigo-100">
              {t("nextTaskBadge")}
            </span>
            <h3 className="text-xl font-extrabold leading-tight tracking-[-0.02em] text-ink">
              {nextTask.title}
            </h3>
            <p className="text-sm tracking-tight text-ink-secondary">{nextTask.objective}</p>
            <Button href={`/build/workspace/task/${nextTask.id}`} size="lg" className="w-full sm:w-fit">
              {t("startTask")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="text-4xl" role="img" aria-hidden>
              🎉
            </span>
            <h3 className="text-xl font-extrabold tracking-[-0.02em] text-ink">{t("pathwayCompleteTitle")}</h3>
            <p className="max-w-md text-sm tracking-tight text-ink-secondary">
              {t("pathwayCompleteDescription")}
            </p>
            <Button href="/build/workspace/pitch" size="lg">
              {t("viewPitch")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ─── Pathway stages with visible completed outputs ─── */}
      {nextTask && <RefineTasksButton projectId={project.id} />}
      <div className="flex flex-col gap-6">
        {stageOrder.map((stage) => {
          const stageTasks = tasksByStage.get(stage) ?? [];
          const stageLabel = STAGE_LABELS[stage] ? pick(STAGE_LABELS[stage], locale) : stage;
          const stageComplete = stageTasks.every((task) => task.status === "completed");
          return (
            <div key={stage} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-ink-muted">{stageLabel}</h3>
                {stageComplete && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-600 ring-1 ring-inset ring-emerald-100">
                    ✓ {t("stageReady")}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {stageTasks.map((task) => {
                  const completed = task.status === "completed";
                  const output = completed ? outputByTaskId.get(task.id) : undefined;
                  return (
                    <Link
                      key={task.id}
                      href={`/build/workspace/task/${task.id}`}
                      className="flex items-start gap-3 rounded-2xl border border-t-white/70 border-x-zinc-200/40 border-b-zinc-200/40 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-md transition-all duration-200 hover:bg-white/90"
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                          completed
                            ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white"
                            : "bg-zinc-100 text-ink-muted"
                        )}
                      >
                        {completed ? "✓" : ""}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-sm font-semibold text-ink">{task.title}</span>
                        {/* Primary supporting info: expected output + time. */}
                        <span className="line-clamp-1 text-xs text-ink-secondary">
                          {task.expected_output}
                        </span>
                        {output && (
                          <span className="mt-1 line-clamp-2 rounded-lg bg-emerald-50/60 px-2.5 py-1.5 text-xs italic text-ink-secondary">
                            {output}
                          </span>
                        )}
                        <span className="mt-0.5 text-[11px] text-ink-muted">
                          {task.estimated_time} · {t("xpShort", { xp: task.xp })}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <ProjectAssistant projectId={project.id} />
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-white/50 px-3 py-2 ring-1 ring-inset ring-zinc-200/40">
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-muted">{label}</span>
      <span className="line-clamp-2 text-xs font-semibold text-ink">{value}</span>
    </div>
  );
}
