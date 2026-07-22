import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { CreateExperience } from "@/components/create/CreateExperience";

// The AI-first creation experience. Replaces the temporary Stage 1 bridge (the
// old ProjectCreateForm + /build/new stay as legacy for backward compatibility).
// Multiple projects are allowed, so /create always starts a fresh conversation.
export default async function CreatePage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    redirect("/login");
  }

  return <CreateExperience userId={user.id} />;
}
