"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { loadWorkspaceUsage, type WorkspaceUsage } from "@/lib/workspace/usage";

export interface SettingsData {
  email: string;
  displayName: string;
  usage: WorkspaceUsage;
}

/**
 * Everything the settings panel shows, fetched when it is opened.
 *
 * Settings is an overlay now rather than a page, so this cannot be part of a
 * route's own data load — and it should not be. Charging every screen in the
 * product a profile read and a usage read on the chance that somebody opens
 * settings is the wrong trade; the panel is opened rarely and can afford to
 * fetch its own contents the first time it appears.
 *
 * Exactly the same two reads the /settings route already performs, moved
 * behind an action so both entry points share one source.
 */
export async function loadSettingsDataAction(): Promise<SettingsData | null> {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) return null;

  const [{ data: profile }, usage] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).single(),
    loadWorkspaceUsage(supabase, user.id),
  ]);

  return {
    email: user.email ?? "",
    displayName: profile?.display_name ?? "",
    usage,
  };
}
