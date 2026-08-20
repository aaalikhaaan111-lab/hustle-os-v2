import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { WorkspaceShell } from "@/components/workspace-ui/WorkspaceShell";
import { loadShellNav } from "@/lib/workspace/shellNav";
import { loadSettingsData } from "@/lib/workspace/settingsData";
import { SettingsClient } from "./SettingsClient";
import { isSettingsSection, SETTINGS_ENTRIES, type SettingsSection } from "@/lib/settings/registry";

interface SettingsPageProps {
  searchParams: Promise<{ section?: string; focus?: string }>;
}

// The one settings surface. /profile redirects here so there is no second,
// divergent version of the same thing.
export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const { section, focus } = await searchParams;
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/login");

  const [data, nav] = await Promise.all([
    loadSettingsData(supabase, user),
    loadShellNav(supabase, user.id, user.email),
  ]);

  /* The registry is the only list of sections; this route validated its own
     copy of it before, which is exactly the kind of duplicate that drifts. */
  const initial: SettingsSection = isSettingsSection(section) ? section : "profile";

  /**
   * `?focus=` is how the command palette lands on a CONTROL rather than a
   * panel. Searching "dark mode" and arriving at the top of Appearance to hunt
   * for the option is most of the way to not having search at all.
   *
   * Validated against the registry rather than passed through: this value ends
   * up in `document.getElementById`, and only ids the registry actually names
   * are legitimate targets.
   */
  const anchor = SETTINGS_ENTRIES.find((entry) => entry.anchor === focus)?.anchor;

  return (
    <WorkspaceShell initials={nav.initials} email={nav.email} recent={nav.recent}>
      <SettingsClient
        initialSection={initial}
        initialAnchor={anchor}
        email={data.email}
        displayName={data.displayName}
        preferredName={data.preferredName}
        workDescription={data.workDescription}
        personalInstructions={data.personalInstructions}
        usage={data.usage}
      />
    </WorkspaceShell>
  );
}
