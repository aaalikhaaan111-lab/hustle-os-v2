import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { getCurrentProject } from "@/lib/build/queries";
import { buildWorkspaceViewProps } from "@/lib/build/workspaceProps";
import { WorkspaceView } from "@/components/build/WorkspaceView";

// Legacy single-project workspace: resolves the user's current project
// implicitly. The multi-project surface lives at /projects/[id]; this route is
// kept working for backward compatibility until it is redirected.
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

  const props = await buildWorkspaceViewProps(supabase, project, {
    pitchHref: "/build/workspace/pitch",
  });

  return <WorkspaceView {...props} />;
}
