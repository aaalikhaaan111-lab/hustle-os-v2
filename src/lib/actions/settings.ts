"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { loadSettingsData, type SettingsData } from "@/lib/workspace/settingsData";

/**
 * The Settings overlay's own data load.
 *
 * Settings is an overlay rather than a page, so this cannot ride along with a
 * route's data — and it should not. Charging every screen in the product a
 * profile read and a usage read on the chance that somebody opens settings is
 * the wrong trade; the panel is opened rarely and can afford to fetch its own
 * contents the first time it appears.
 *
 * The reading itself lives in `loadSettingsData`, which the /settings route
 * calls directly, so there is one implementation and no chance of the two
 * drifting.
 */
export async function loadSettingsDataAction(): Promise<SettingsData | null> {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) return null;
  return loadSettingsData(supabase, user);
}
