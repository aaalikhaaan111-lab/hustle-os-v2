import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type Client = SupabaseClient<Database>;

// Only a project still in progress — used solely to block starting a second
// *concurrent* project. A completed project must not count here, or a user
// could never start a new one after finishing the last (see getCurrentProject).
export async function getActiveProject(supabase: Client, userId: string) {
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

export async function getProjectTasks(supabase: Client, projectId: string) {
  const { data } = await supabase
    .from("project_tasks")
    .select("*")
    .eq("project_id", projectId)
    .order("order_index", { ascending: true });
  return data ?? [];
}

export async function getProjectOutputs(supabase: Client, projectId: string) {
  const { data } = await supabase
    .from("project_outputs")
    .select("*")
    .eq("project_id", projectId);
  return data ?? [];
}

type TaskRow = Database["public"]["Tables"]["project_tasks"]["Row"];

export function computeProgress(tasks: TaskRow[]): { progress: number; currentStage: string | null } {
  if (tasks.length === 0) return { progress: 0, currentStage: null };

  const completed = tasks.filter((task) => task.status === "completed").length;
  const progress = Math.round((completed / tasks.length) * 100);
  const nextPending = tasks.find((task) => task.status !== "completed");
  const currentStage = nextPending ? nextPending.stage : tasks[tasks.length - 1].stage;

  return { progress, currentStage };
}
