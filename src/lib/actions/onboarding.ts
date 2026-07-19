"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { TOPIC_INTEREST_PREFIX, isTopicInterest } from "@/lib/constants";

export interface CompleteOnboardingResult {
  error: string | null;
}

export async function completeOnboardingAction(
  interests: string[],
  dailyMinutes: number,
  topics: string[] = []
): Promise<CompleteOnboardingResult> {
  const t = await getTranslations("onboarding");

  if (interests.length === 0) {
    return { error: t("selectInterest") };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: t("errorSession") };
  }

  // The improve-interests are stored first and unprefixed; the "what are you
  // interested in?" topics follow, namespaced with TOPIC_INTEREST_PREFIX so
  // they coexist in the same array column without a schema change and can be
  // filtered back out by readers of the improve-interests. Deduped defensively.
  const improveInterests = interests.filter((id) => !isTopicInterest(id));
  const topicInterests = Array.from(new Set(topics)).map(
    (id) => `${TOPIC_INTEREST_PREFIX}${id}`
  );
  const storedInterests = [...improveInterests, ...topicInterests];

  const { error } = await supabase
    .from("profiles")
    .update({
      interests: storedInterests,
      daily_minutes: dailyMinutes,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return { error: t("errorSaveFailed") };
  }

  revalidatePath("/dashboard");
  return { error: null };
}

export interface ResetOnboardingResult {
  error: string | null;
}

export async function resetOnboardingAction(): Promise<ResetOnboardingResult> {
  if (process.env.NODE_ENV !== "development") {
    return { error: "Доступно только в режиме разработки." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Сессия истекла. Пожалуйста, войди снова." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_completed_at: null })
    .eq("id", user.id);

  if (error) {
    return { error: "Не удалось сбросить онбординг." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/onboarding");
  redirect("/onboarding");
}
