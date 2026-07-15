import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CHALLENGE_CATALOG } from "@/lib/challenges";
import { FirstSessionFlow } from "@/components/first-session/FirstSessionFlow";

export default async function FirstSessionPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("interests")
    .eq("id", user.id)
    .maybeSingle();

  const primaryInterest = profile?.interests?.[0];
  const categoryChallenges = primaryInterest
    ? CHALLENGE_CATALOG.filter((challenge) => challenge.categoryId === primaryInterest)
    : CHALLENGE_CATALOG;

  const firstChallenge =
    categoryChallenges.find((challenge) => challenge.difficulty === "bronze") ??
    CHALLENGE_CATALOG.find((challenge) => challenge.difficulty === "bronze");

  // Should never happen (the catalog always has a bronze entry), but if the
  // catalog is ever emptied there's nothing meaningful to guide the user through.
  if (!firstChallenge) {
    redirect("/dashboard");
  }

  return <FirstSessionFlow firstChallenge={firstChallenge} />;
}
