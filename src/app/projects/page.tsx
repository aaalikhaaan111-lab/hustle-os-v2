import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { listProjects } from "@/lib/build/queries";
import type { Database } from "@/types/supabase";

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
type StatusLabelKey = "statusCompleted" | "statusDraft" | "statusActive";

// Stage 1 has only the base 'active'/'completed' statuses; the richer set
// (published, paused, archived, …) arrives with later stages. Draft = an active
// project with no progress yet.
function statusFor(project: ProjectRow): { key: StatusLabelKey; variant: "accent" | "default" | "muted" } {
  if (project.status === "completed") return { key: "statusCompleted", variant: "accent" };
  if (project.progress === 0) return { key: "statusDraft", variant: "muted" };
  return { key: "statusActive", variant: "default" };
}

export default async function ProjectsPage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    redirect("/login");
  }

  const projects = await listProjects(supabase, user.id);
  const t = await getTranslations("projects");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader title={t("title")} description={t("description")} />
        {projects.length > 0 && (
          <Button href="/create" size="md">
            {t("newProject")}
          </Button>
        )}
      </div>

      {projects.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={<Button href="/create" size="lg">{t("emptyCta")}</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const status = statusFor(project);
            return (
              <Link key={project.id} href={`/projects/${project.id}`} className="group block">
                <Card className="h-full">
                  <CardContent className="flex h-full flex-col gap-3 py-6">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="min-w-0 flex-1 truncate text-base font-bold tracking-tight text-ink">
                        {project.name || t("untitled")}
                      </h2>
                      <Badge variant={status.variant} className="shrink-0">
                        {t(status.key)}
                      </Badge>
                    </div>
                    <p className="text-sm text-ink-secondary">
                      {t("progressLabel", { progress: project.progress })}
                    </p>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-all duration-300 ease-out"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                    <span className="mt-auto pt-2 text-sm font-semibold text-accent">
                      {t("open")} →
                    </span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
