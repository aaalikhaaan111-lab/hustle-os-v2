import { LandingExperience } from "@/components/landing/LandingExperience";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { CreateExperience } from "@/components/create/CreateExperience";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { loadCreationDraftAction } from "@/lib/actions/creation";

// The homepage is the single entry surface. A signed-in visitor lands directly
// in the Create workspace (so submitting the first message never navigates away
// — the onboarding is simply behind them); a logged-out visitor sees the
// chat-first landing that carries their first message through signup.
export default async function Home() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (user) {
    const initialDraft = await loadCreationDraftAction();
    return <CreateExperience userId={user.id} initialDraft={initialDraft} />;
  }

  return (
    <LandingExperience isAuthenticated={false}>
      <PublicFooter />
    </LandingExperience>
  );
}
