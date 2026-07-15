"use server";

import { createClient } from "@/lib/supabase/server";

// xp, streak_days, and last_activity_at are all defined together in migration
// 20260713120000_add_game_progress.sql (see src/types/supabase.ts for the generated
// types). If that migration hasn't been applied to this environment's database yet —
// or the PostgREST schema cache is stale — Supabase rejects the whole update with a
// "column not found" error. Rather than losing every field because one is missing,
// drop whichever specific column Supabase reports as unknown and retry, so progress
// that *can* be saved still gets saved.
const DROPPABLE_COLUMNS = ["last_activity_at", "streak_days", "xp"] as const;

interface ProgressPayload {
  xp?: number;
  streak_days?: number;
  last_activity_at?: string;
}

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

  let payload: ProgressPayload = {
    xp,
    streak_days: streakDays,
    last_activity_at: lastActivityAt,
  };

  for (let attempt = 0; attempt <= DROPPABLE_COLUMNS.length; attempt++) {
    if (Object.keys(payload).length === 0) {
      console.warn(
        "syncGameProgressAction: none of xp/streak_days/last_activity_at exist on profiles yet — apply migration 20260713120000_add_game_progress.sql. Skipping sync."
      );
      return;
    }

    const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
    if (!error) return;

    const missingColumn = DROPPABLE_COLUMNS.find(
      (column) => column in payload && error.message.includes(column)
    );

    if (!missingColumn) {
      console.error("syncGameProgressAction failed:", error.message);
      throw new Error(error.message);
    }

    console.warn(
      `profiles.${missingColumn} not found in schema — apply migration 20260713120000_add_game_progress.sql. Retrying sync without it.`
    );
    const rest = { ...payload };
    delete rest[missingColumn];
    payload = rest;
  }
}
