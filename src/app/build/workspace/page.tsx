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
import { getCurrentProject, getProjectTasks } from "@/lib/build/queries";
import { STAGE_LABELS } from "@/lib/build/pathwayTemplates";
import { PROJECT_TYPE_OPTIONS } from "@/lib/build/options";

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

  const tasks = await getProjectTasks(supabase, project.id);
  const t = await getTranslations("build");
  const locale = await getLocale();

  const typeOption = PROJECT_TYPE_OPTIONS.find((option) => option.id === project.project_type);
  const projectName = project.name || t("untitledProject");
  const nextTask = tasks.find((task) => task.status !== "completed");
  const completedCount = tasks.filter((task) => task.status === "completed").length;

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

      <Card>
        <CardContent className="flex flex-col gap-3 py-6">
          <div className="flex items-center justify-between text-xs font-bold tracking-wide text-ink-secondary">
            <span>{t("progressLabel")}</span>
            <span>{project.progress}%</span>
          </div>
          <div className="h-4 w-full overflow-hidden rounded-full bg-zinc-900/[0.04] ring-1 ring-inset ring-white/60 backdrop-blur-sm">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-[0_0_12px_rgba(147,51,234,0.5)] transition-all duration-700 ease-out"
              style={{ width: `${project.progress}%` }}
            />
          </div>
        </CardContent>
      </Card>

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

      <div className="flex flex-col gap-6">
        {stageOrder.map((stage) => {
          const stageTasks = tasksByStage.get(stage) ?? [];
          const stageLabel = STAGE_LABELS[stage] ? pick(STAGE_LABELS[stage], locale) : stage;
          return (
            <div key={stage} className="flex flex-col gap-3">
              <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-ink-muted">{stageLabel}</h3>
              <div className="flex flex-col gap-2">
                {stageTasks.map((task) => {
                  const completed = task.status === "completed";
                  return (
                    <Link
                      key={task.id}
                      href={`/build/workspace/task/${task.id}`}
                      className="flex items-center gap-3 rounded-2xl border border-t-white/70 border-x-zinc-200/40 border-b-zinc-200/40 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-md transition-all duration-200 hover:bg-white/90"
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                          completed
                            ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white"
                            : "bg-zinc-100 text-ink-muted"
                        )}
                      >
                        {completed ? "✓" : ""}
                      </span>
                      <div className="flex flex-1 flex-col gap-0.5">
                        <span className="text-sm font-semibold text-ink">{task.title}</span>
                        <span className="text-xs text-ink-muted">{task.estimated_time}</span>
                      </div>
                      <span className="shrink-0 text-xs font-bold text-amber-600">+{task.xp} XP</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
