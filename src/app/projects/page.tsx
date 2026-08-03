import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { listProjects } from "@/lib/build/queries";
import { loadProjectPublicationSummaries } from "@/lib/publishing/queries";
import { presentProject } from "@/lib/workspace/present";
import { WorkspaceShell } from "@/components/workspace-ui/WorkspaceShell";
import { ProjectsScreen } from "@/components/workspace/ProjectsScreen";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/login");

  const [projects, publications] = await Promise.all([
    listProjects(supabase, user.id),
    loadProjectPublicationSummaries(supabase, user.id),
  ]);

  const presented = projects.map((project) => presentProject(project, publications.get(project.id)));

  return (
    <WorkspaceShell
      initials={(user.email ?? "?").slice(0, 2).toUpperCase()}
      recent={presented.slice(0, 3).map((p) => ({ id: p.id, name: p.name, accent: p.preview.accent }))}
    >
      <ProjectsScreen projects={presented} />
    </WorkspaceShell>
  );
}
