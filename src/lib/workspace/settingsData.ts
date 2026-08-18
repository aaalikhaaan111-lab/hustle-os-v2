import type { SupabaseClient } from "@supabase/supabase-js";
import { loadWorkspaceUsage, type WorkspaceUsage } from "@/lib/workspace/usage";

export interface SettingsData {
  email: string;
  displayName: string;
  preferredName: string;
  workDescription: string;
  personalInstructions: string;
  usage: WorkspaceUsage;
}

/** The personalisation columns, added by 20260818120000. */
const PROFILE_COLUMNS = "display_name, preferred_name, work_description, personal_instructions";

/**
 * Everything the Settings panel shows.
 *
 * WHY IT IS HERE AND NOT IN THE ACTION FILE. Both entry points need it — the
 * overlay through a server action, the /settings route directly — and every
 * export of a `"use server"` module becomes a callable endpoint. A plain module
 * lets the route import the loader without also publishing it.
 *
 * The route used to run its own `select("display_name")`, which is exactly the
 * kind of second copy that silently stops matching: adding the personalisation
 * columns would have fed the overlay and starved the page.
 */
export async function loadSettingsData(
  supabase: SupabaseClient,
  user: { id: string; email?: string | null }
): Promise<SettingsData> {
  /**
   * READ THE NEW COLUMNS, BUT SURVIVE WITHOUT THEM.
   *
   * The personalisation columns arrive with a migration, and a deploy can reach
   * an environment before the migration does. PostgREST answers a select for a
   * column it does not have with an error for the WHOLE row, so an unmigrated
   * database would not degrade to "no preferred name" — it would take the
   * entire settings panel down. One retry against the column that has always
   * existed keeps the panel working either way.
   */
  const [profileResult, usage] = await Promise.all([
    supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", user.id).single(),
    loadWorkspaceUsage(supabase, user.id),
  ]);

  let profile = profileResult.data as Record<string, string | null> | null;
  if (profileResult.error) {
    const { data } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();
    profile = data as Record<string, string | null> | null;
  }

  return {
    email: user.email ?? "",
    displayName: profile?.display_name ?? "",
    preferredName: profile?.preferred_name ?? "",
    workDescription: profile?.work_description ?? "",
    personalInstructions: profile?.personal_instructions ?? "",
    usage,
  };
}
