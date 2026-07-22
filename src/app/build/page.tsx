import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { getCurrentProject } from "@/lib/build/queries";

// /build is a retired product entry point. Existing users still reach their
// latest project; everyone else enters the canonical creation flow.
export default async function BuildLandingPage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/login");

  const project = await getCurrentProject(supabase, user.id);
  redirect(project ? `/projects/${project.id}` : "/create");
}
