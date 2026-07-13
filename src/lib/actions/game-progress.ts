"use server";

import { createClient } from "@/lib/supabase/server";

export async function syncGameProgressAction(
  xp: number,
  streakDays: number,
  lastActivityAt: string
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { error } = await supabase
    .from("profiles")
    .update({ xp, streak_days: streakDays, last_activity_at: lastActivityAt })
    .eq("id", user.id);

  if (error) {
    console.error("syncGameProgressAction failed:", error.message);
    throw new Error(error.message);
  }
}
