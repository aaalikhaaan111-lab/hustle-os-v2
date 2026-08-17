import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { WorkspaceShell } from "@/components/workspace-ui/WorkspaceShell";
import { loadWorkspaceUsage } from "@/lib/workspace/usage";
import { loadShellNav } from "@/lib/workspace/shellNav";
import { SettingsClient } from "./SettingsClient";

const SECTIONS = ["profile", "usage", "appearance", "language", "privacy", "account"] as const;
type Section = (typeof SECTIONS)[number];

interface SettingsPageProps {
  searchParams: Promise<{ section?: string }>;
}

// The one settings surface. /profile redirects here so there is no second,
// divergent version of the same thing.
export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const { section } = await searchParams;
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/login");

  const [{ data: profile }, usage, nav] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).single(),
    loadWorkspaceUsage(supabase, user.id),
    loadShellNav(supabase, user.id, user.email),
  ]);

  const initial: Section = SECTIONS.includes(section as Section) ? (section as Section) : "profile";

  return (
    <WorkspaceShell initials={nav.initials} email={nav.email} recent={nav.recent}>
      <SettingsClient
        initialSection={initial}
        email={user.email ?? ""}
        displayName={profile?.display_name ?? ""}
        usage={usage}
      />
    </WorkspaceShell>
  );
}
