import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { listProjects } from "@/lib/build/queries";
import { loadProjectPublicationSummaries } from "@/lib/publishing/queries";
import { presentProject } from "@/lib/workspace/present";
import { WorkspaceShell } from "@/components/workspace-ui/WorkspaceShell";
import { OverviewScreen } from "@/components/workspace/OverviewScreen";

// The authenticated entry point. Everything shown here is the signed-in user's
// own data; a user with no projects still lands here and gets the first-project
// state rather than being pushed into /create every time.
export default async function DashboardPage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/login");

  // Overview no longer shows allowances — they live behind the composer's
  // settings control and in Settings, so this page does not read the ledger.
  const [projects, publications] = await Promise.all([
    listProjects(supabase, user.id),
    loadProjectPublicationSummaries(supabase, user.id),
  ]);

  const presented = projects.map((project) => presentProject(project, publications.get(project.id)));
  const active = presented[0] ?? null;
  const activeResponses = active ? (publications.get(active.id)?.responseCount ?? 0) : 0;

  return (
    <WorkspaceShell
      initials={(user.email ?? "?").slice(0, 2).toUpperCase()}
      recent={presented.slice(0, 3).map((p) => ({ id: p.id, name: p.name, accent: p.preview.accent }))}
    >
      <OverviewScreen
        active={active}
        recent={presented.slice(1, 4)}
        activeResponses={activeResponses}
      />
    </WorkspaceShell>
  );
}
