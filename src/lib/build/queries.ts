import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type Client = SupabaseClient<Database>;

// Only a project still in progress. Kept separate from getCurrentProject
// because "active" and "most recent" are different questions and the fallback
// below depends on asking them in that order.
async function getActiveProject(supabase: Client, userId: string) {
  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

// The project to show in the workspace/pitch/dashboard: the in-progress one
// if there is one, otherwise the most recently finished one — so a completed
// project's pitch stays reachable (e.g. to present at a demo day) instead of
// becoming permanently unreachable the moment it hits 100%.
export async function getCurrentProject(supabase: Client, userId: string) {
  const active = await getActiveProject(supabase, userId);
  if (active) return active;

  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

// All of a user's projects for the Projects list, newest first. The `archived`
// status doesn't exist yet (it arrives with the publishing migration that
// widens projects.status), so there is nothing to hide today — the
// hide-archived filter is added here once that status, and its generated type,
// land.
export async function listProjects(supabase: Client, userId: string) {
  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

// A single project addressed explicitly by id, scoped to its owner. This is the
// canonical multi-project accessor: every per-project route and mutation must
// resolve the project this way (or from a child row's own project_id) rather
// than via getCurrentProject, so opening project B never operates on project A.
export async function getProjectById(supabase: Client, userId: string, projectId: string) {
  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}
