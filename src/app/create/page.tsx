import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { CreateExperience } from "@/components/create/CreateExperience";
import { WorkspaceShell } from "@/components/workspace-ui/WorkspaceShell";
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

  // Creation lives inside the one authenticated shell, so Overview, Projects
  // and Settings stay one click away and there is no second navigation on
  // screen. The rail starts compact: this surface is about the conversation.
  return (
    <WorkspaceShell initials={(user.email ?? "?").slice(0, 2).toUpperCase()} defaultCollapsed fill>
      <CreateExperience userId={user.id} initialDraft={initialDraft} />
    </WorkspaceShell>
  );
}
