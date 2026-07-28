import { LandingExperience } from "@/components/landing/LandingExperience";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";

// The homepage is always the public onboarding — for logged-out AND
// logged-in visitors alike, so the Ventrio logo/brand control reliably
// returns here from anywhere. Submitting the composer (or a starting-point
// button) writes a seed and routes an authenticated visitor straight into
// /create — same mechanism already used to carry a logged-out visitor's
// first message through signup. If they already have a draft in progress,
// CreateExperience only pre-fills the seed into the composer rather than
// starting a new conversation, so returning home never loses existing data.
export default async function Home() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  return (
    <LandingExperience isAuthenticated={Boolean(user)}>
      <PublicFooter />
    </LandingExperience>
  );
}
