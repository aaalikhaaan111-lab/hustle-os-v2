import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { ChallengeCard } from "@/components/challenges/ChallengeCard";
import { CHALLENGE_CATALOG } from "@/lib/challenges";
import { INTEREST_OPTIONS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export default async function ChallengesPage() {
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

  const interests = profile?.interests ?? [];
  const personalized =
    interests.length > 0
      ? CHALLENGE_CATALOG.filter((challenge) => interests.includes(challenge.categoryId))
      : [];
  const challenges = personalized.length > 0 ? personalized : CHALLENGE_CATALOG;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Challenges"
        description={
          personalized.length > 0
            ? "Подборка под твои интересы — выбирай и начинай."
            : "Пройди онбординг, чтобы увидеть персональную подборку. А пока — все челленджи."
        }
      />
      <div className="grid gap-6 sm:grid-cols-2">
        {challenges.map((challenge) => {
          const category = INTEREST_OPTIONS.find(
            (option) => option.id === challenge.categoryId
          );
          return (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              categoryLabel={category?.label ?? ""}
            />
          );
        })}
      </div>
    </div>
  );
}
