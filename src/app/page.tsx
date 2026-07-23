import { LandingExperience } from "@/components/landing/LandingExperience";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";

export default async function Home() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const isAuthenticated = Boolean(user);

  return (
    <LandingExperience isAuthenticated={isAuthenticated}>
      <PublicFooter />
    </LandingExperience>
  );
}
