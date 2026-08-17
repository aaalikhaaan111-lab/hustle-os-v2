import type { SupabaseClient } from "@supabase/supabase-js";
import { listProjects } from "@/lib/build/queries";
import { accentFor } from "@/lib/workspace/present";
import type { ShellRecent } from "@/components/workspace-ui/WorkspaceShell";

export interface ShellNav {
  recent: ShellRecent[];
  initials: string;
  email: string;
}

/**
 * What the sidebar needs, loaded once and the same way on every route.
 *
 * The rail lists projects and its search covers all of them, so every screen
 * that mounts the shell needs the same list — previously only two of the six
 * had it, which is why the sidebar emptied out the moment you opened a project
 * and why there was nothing to search from anywhere else.
 *
 * Deliberately NOT the presented projects: the rail needs an id, a name and a
 * colour, and the colour is a pure hash of the id. Publication summaries and
 * generated previews are a second query and a parse per project for data no
 * row in this list displays.
 */
export async function loadShellNav(
  supabase: SupabaseClient,
  userId: string,
  email: string | null | undefined
): Promise<ShellNav> {
  const projects = await listProjects(supabase, userId);
  return {
    recent: projects.map((project) => ({
      id: project.id,
      name: project.name?.trim() ?? "",
      accent: accentFor(project.id),
    })),
    initials: (email ?? "?").slice(0, 2).toUpperCase(),
    email: email ?? "",
  };
}
