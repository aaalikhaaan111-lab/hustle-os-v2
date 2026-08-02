import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { getCurrentProject } from "@/lib/build/queries";

// Retired. This was the single-project workspace, which resolved "the" project
// implicitly — an assumption the product outgrew the moment someone could have
// more than one. The canonical surface is /projects/[id].
//
// Kept as a redirect rather than deleted because the URL was live and may sit
// in a bookmark or someone's history. It lands on the same project the old page
// would have opened, so an old link still arrives somewhere true.
export default async function RetiredWorkspacePage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/login");

  const project = await getCurrentProject(supabase, user.id);
  redirect(project ? `/projects/${project.id}` : "/create");
}
