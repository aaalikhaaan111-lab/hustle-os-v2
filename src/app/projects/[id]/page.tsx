import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { getProjectById } from "@/lib/build/queries";
import { buildWorkspaceViewProps } from "@/lib/build/workspaceProps";
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

  const props = await buildWorkspaceViewProps(supabase, project);

  return <WorkspaceView {...props} />;
}
