import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding/OnboardingForm";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.onboarding_completed_at) {
    // Already-onboarded users go straight to the dashboard. The first challenge
    // is never force-opened here — it starts only from the explicit post-tour
    // offer (new users) or when the user chooses to start one themselves.
    redirect("/dashboard");
  }

  return <OnboardingForm />;
}
