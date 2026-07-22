import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProjectCreateForm } from "@/components/build/ProjectCreateForm";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import type { PathwayMode } from "@/lib/build/types";

interface CreatePageProps {
  searchParams: Promise<{ mode?: string }>;
}

// Temporary Stage 1 bridge: reuses the existing step-based creation flow to
// create a new draft project, then routes to the id-scoped workspace. Multiple
// projects are allowed, so there is no existing-project guard here — /create
// always starts a fresh draft. Stage 2 replaces the form body with the in-chat
// onboarding experience.
export default async function CreatePage({ searchParams }: CreatePageProps) {
  const { mode } = await searchParams;
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    redirect("/login");
  }

  const t = await getTranslations("build");
  const initialMode: PathwayMode = mode === "quick_sprint" ? "quick_sprint" : "standard";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("newProjectTitle")} description={t("newProjectDescription")} />
      <ProjectCreateForm initialMode={initialMode} redirectMode="project" />
    </div>
  );
}
