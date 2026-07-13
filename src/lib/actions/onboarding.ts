"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface CompleteOnboardingResult {
  error: string | null;
}

export async function completeOnboardingAction(
  interests: string[],
  dailyMinutes: number
): Promise<CompleteOnboardingResult> {
  if (interests.length === 0) {
    return { error: "Выбери хотя бы одно направление." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Сессия истекла. Пожалуйста, войди снова." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      interests,
      daily_minutes: dailyMinutes,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return { error: "Не удалось сохранить ответы. Попробуй ещё раз." };
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
