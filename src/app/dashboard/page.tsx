import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { CourseProgressCard } from "@/components/dashboard/CourseProgressCard";
import { BuildProjectCard } from "@/components/dashboard/BuildProjectCard";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { getCurrentProject, getProjectTasks } from "@/lib/build/queries";

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex w-fit items-center rounded-full bg-accent-soft px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-accent ring-1 ring-inset ring-accent/20">
      {children}
    </span>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    redirect("/login");
  }

  const t = await getTranslations("dashboard");
  const tNav = await getTranslations("nav");

  const activeProject = await getCurrentProject(supabase, user.id);
  const projectTasks = activeProject ? await getProjectTasks(supabase, activeProject.id) : [];
  const nextProjectTask = projectTasks.find((task) => task.status !== "completed");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("title")} description={t("description")} />

      {/* Build is the main destination — the project is surfaced first as the hero. */}
      <BuildProjectCard
        hasProject={!!activeProject}
        projectName={activeProject?.name ?? undefined}
        progress={activeProject?.progress ?? 0}
        nextTaskTitle={nextProjectTask?.title ?? null}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <CourseProgressCard />

        <Card>
          <CardContent className="flex h-full flex-col gap-6 py-9">
            <div className="flex items-center gap-4">
              <span className="text-4xl" role="img" aria-hidden>
                🗓️
              </span>
              <div className="flex flex-col gap-2">
                <Eyebrow>{tNav("learn")}</Eyebrow>
                <h3 className="text-xl font-extrabold leading-tight tracking-[-0.02em] text-ink">
                  {t("workshopsTeaserTitle")}
                </h3>
              </div>
            </div>
            <p className="text-sm tracking-tight text-ink-secondary">
              {t("workshopsTeaserBody")}
            </p>
            <Button href="/courses" variant="secondary" className="mt-auto w-fit">
              {t("allWorkshops")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
