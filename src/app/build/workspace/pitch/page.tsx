import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { getCurrentProject, getProjectTasks } from "@/lib/build/queries";
import { PitchClient } from "@/components/build/PitchClient";
import type { ProjectPitch, ProjectSummary } from "@/lib/build/types";

export default async function ProjectPitchPage() {
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
  const hasCompletedTasks = tasks.some((task) => task.status === "completed");

  const t = await getTranslations("build");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("pitchTitle")} description={t("pitchDescription")} />
      <PitchClient
        projectId={project.id}
        hasCompletedTasks={hasCompletedTasks}
        initialSummary={(project.project_summary as ProjectSummary | null) ?? null}
        initialPitch={(project.pitch as ProjectPitch | null) ?? null}
      />
    </div>
  );
}
