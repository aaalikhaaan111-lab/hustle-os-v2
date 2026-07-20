import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProjectCreateForm } from "@/components/build/ProjectCreateForm";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { getActiveProject } from "@/lib/build/queries";
import type { PathwayMode } from "@/lib/build/types";

interface NewProjectPageProps {
  searchParams: Promise<{ mode?: string }>;
}

export default async function NewProjectPage({ searchParams }: NewProjectPageProps) {
  const { mode } = await searchParams;
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    redirect("/login");
  }

  const project = await getActiveProject(supabase, user.id);
  if (project) {
    redirect("/build/workspace");
  }

  const t = await getTranslations("build");
  const initialMode: PathwayMode = mode === "quick_sprint" ? "quick_sprint" : "standard";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("newProjectTitle")} description={t("newProjectDescription")} />
      <ProjectCreateForm initialMode={initialMode} />
    </div>
  );
}
