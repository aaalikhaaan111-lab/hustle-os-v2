import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { CreateExperience } from "@/components/create/CreateExperience";
import { loadCreationDraftAction } from "@/lib/actions/creation";

// The AI-first creation experience. /build/new redirects here so the retired
// questionnaire can no longer become a user's primary creation path.
// An unfinished Stage 3 creation session resumes from server persistence. A
// second project is only created after the user intentionally starts over.
export default async function CreatePage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    redirect("/login");
  }

  const initialDraft = await loadCreationDraftAction();

  return <CreateExperience userId={user.id} initialDraft={initialDraft} />;
}
