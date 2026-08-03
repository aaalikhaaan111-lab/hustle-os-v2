import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { getProjectById } from "@/lib/build/queries";
import { buildWorkspaceViewProps } from "@/lib/build/workspaceProps";
import { loadWorkspaceUsage } from "@/lib/workspace/usage";
import { WorkspaceShell } from "@/components/workspace-ui/WorkspaceShell";
import { WorkspaceView } from "@/components/build/WorkspaceView";

interface ProjectWorkspacePageProps {
  params: Promise<{ id: string }>;
}

// The canonical, id-scoped project workspace. The project is resolved by its
// explicit id and ownership-checked; every read and mutation inside the
// workspace is scoped to this same project. Pitch is intentionally not passed
// (retired from the multi-project surface), which hides the pitch menu.
export default async function ProjectWorkspacePage({ params }: ProjectWorkspacePageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    redirect("/login");
  }

  const project = await getProjectById(supabase, user.id, id);
  if (!project) {
    notFound();
  }

  const [props, usage] = await Promise.all([
    buildWorkspaceViewProps(supabase, project),
    loadWorkspaceUsage(supabase, user.id),
  ]);

  const published = Boolean(props.publication?.isPublished);

  // The shell is new; what it wraps is the same WorkspaceView with the same
  // assistant, publication and stage-3 props it already received.
  return (
    <WorkspaceShell
      initials={(user.email ?? "?").slice(0, 2).toUpperCase()}
      project={{ id: project.id, name: props.projectName, state: published ? "published" : "draft" }}
      defaultCollapsed
      fill
    >
      <WorkspaceView {...props} usage={usage} />
    </WorkspaceShell>
  );
}
