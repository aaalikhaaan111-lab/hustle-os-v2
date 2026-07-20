"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { ChallengeCard } from "@/components/challenges/ChallengeCard";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { CHALLENGE_CATALOG } from "@/lib/challenges";
import { INTEREST_OPTIONS } from "@/lib/constants";
import { useGameProgress } from "@/lib/game-progress/GameProgressContext";

// The Challenges experience now lives as a tab inside Learn (it used to be a
// top-level /challenges page). This preserves the exact personalization the
// old page had: filter the catalog to the categories matching the user's
// improve-interests, falling back to the full catalog when there's no match.
// The `?open=` param (used by Dashboard deep links) auto-opens one challenge.
export function ChallengesSection() {
  const t = useTranslations("challenges");
  const tInterests = useTranslations("onboarding");
  const searchParams = useSearchParams();
  const openId = searchParams.get("open");
  const { userId, isReady } = useGameProgress();
  const [fetchedInterests, setFetchedInterests] = useState<string[] | null>(null);

  useEffect(() => {
    if (!isReady || !userId) return;
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("interests")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setFetchedInterests(data?.interests ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [isReady, userId]);

  const { challenges, personalized, resolved } = useMemo(() => {
    // Fall back to the generic catalog once we know there's no signed-in user
    // (an edge case on this protected route) instead of hanging on a skeleton.
    const ints = fetchedInterests ?? (isReady && !userId ? [] : null);
    if (ints === null) {
      return { challenges: [], personalized: false, resolved: false };
    }
    const personalizedList =
      ints.length > 0 ? CHALLENGE_CATALOG.filter((c) => ints.includes(c.categoryId)) : [];
    return {
      challenges: personalizedList.length > 0 ? personalizedList : CHALLENGE_CATALOG,
      personalized: personalizedList.length > 0,
      resolved: true,
    };
  }, [fetchedInterests, isReady, userId]);

  if (!resolved) {
    return (
      <div className="grid gap-6 sm:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm tracking-tight text-ink-secondary">
        {personalized ? t("descriptionPersonalized") : t("descriptionGeneric")}
      </p>
      <div className="grid gap-6 sm:grid-cols-2">
        {challenges.map((challenge) => {
          const category = INTEREST_OPTIONS.find((option) => option.id === challenge.categoryId);
          return (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              categoryLabel={category ? tInterests(category.labelKey) : ""}
              initialOpen={challenge.id === openId}
            />
          );
        })}
      </div>
    </div>
  );
}
