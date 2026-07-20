import type { Database } from "@/types/supabase";
import { familyForProjectType } from "@/lib/build/options";
import type { ProjectFamily } from "@/lib/build/types";

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
type TaskRow = Database["public"]["Tables"]["project_tasks"]["Row"];
type OutputRow = Database["public"]["Tables"]["project_outputs"]["Row"];

// ============================================================================
// Project Snapshot
// ============================================================================
// A compact "this is what my project currently is" view, assembled ONLY from
// the user's real saved task outputs — never invented. Each snapshot field is
// filled by the saved output of one specific pathway stage; if that stage
// isn't completed yet the field stays empty ("Not defined yet"). The mapping
// is the smallest one compatible with the deterministic pathway templates.

export interface SnapshotFieldSpec {
  labelKey: string;
  stage: string;
}

// Standard-pathway snapshots, per project family. Stage ids match
// src/lib/build/pathwayTemplates.ts.
const STANDARD_SNAPSHOT: Record<ProjectFamily, SnapshotFieldSpec[]> = {
  commercial: [
    { labelKey: "snapProblem", stage: "problem" },
    { labelKey: "snapAudience", stage: "audience" },
    { labelKey: "snapSolution", stage: "solution" },
    { labelKey: "snapEvidence", stage: "validation" },
    { labelKey: "snapFirstVersion", stage: "first_version" },
    { labelKey: "snapTesting", stage: "testing" },
  ],
  content: [
    { labelKey: "snapAudience", stage: "audience" },
    { labelKey: "snapContentAngle", stage: "content_angle" },
    { labelKey: "snapFormat", stage: "format" },
    { labelKey: "snapPublished", stage: "publishing" },
  ],
  community: [
    { labelKey: "snapProblem", stage: "community_problem" },
    { labelKey: "snapParticipants", stage: "participants" },
    { labelKey: "snapPartners", stage: "partners" },
    { labelKey: "snapPilot", stage: "pilot" },
  ],
  research: [
    { labelKey: "snapQuestion", stage: "research_question" },
    { labelKey: "snapMethodology", stage: "methodology" },
    { labelKey: "snapEvidence", stage: "data_collection" },
    { labelKey: "snapFindings", stage: "findings" },
  ],
  smart_city: [
    { labelKey: "snapUrbanProblem", stage: "urban_problem" },
    { labelKey: "snapStakeholders", stage: "stakeholders" },
    { labelKey: "snapSolution", stage: "solution" },
    { labelKey: "snapFeasibility", stage: "feasibility" },
    { labelKey: "snapPublicValue", stage: "public_value" },
  ],
};

// Quick Sprint uses the same five stages across every family, so one mapping
// covers them all.
const QUICK_SPRINT_SNAPSHOT: SnapshotFieldSpec[] = [
  { labelKey: "snapProblem", stage: "problem" },
  { labelKey: "snapAudience", stage: "audience" },
  { labelKey: "snapSolution", stage: "solution" },
  { labelKey: "snapMainRisk", stage: "risk" },
];

export interface SnapshotRow {
  labelKey: string;
  /** The saved output content, or null when the source stage isn't done yet. */
  value: string | null;
  /** The task that fills this field, so the UI can link to it for editing. */
  taskId: string | null;
}

export function buildSnapshot(
  project: Pick<ProjectRow, "project_type" | "pathway_mode">,
  tasks: TaskRow[],
  outputs: OutputRow[]
): SnapshotRow[] {
  const family = familyForProjectType(project.project_type);
  const specs =
    project.pathway_mode === "quick_sprint" ? QUICK_SPRINT_SNAPSHOT : STANDARD_SNAPSHOT[family];

  const outputByTaskId = new Map(outputs.map((o) => [o.task_id, o.content]));

  return specs.map((spec) => {
    // The first task in the stage is the one that fills the field.
    const task = tasks.find((t) => t.stage === spec.stage);
    const done = task?.status === "completed";
    const content = task ? outputByTaskId.get(task.id) : undefined;
    return {
      labelKey: spec.labelKey,
      value: done && content ? content : null,
      taskId: task?.id ?? null,
    };
  });
}

// ============================================================================
// Destination ("Your goal")
// ============================================================================
// Explains where the pathway is leading, derived deterministically from the
// intended outcome and project name. Deliberately avoids promising success,
// users, revenue, publication or investment.

// Returns a message key + params for next-intl; the page resolves it. Keeping
// this as data (not a pre-rendered string) means the localization stays in the
// message files.
export function destinationGoalKey(outcome: string): string {
  switch (outcome) {
    case "validate_idea":
      return "destGoalValidateIdea";
    case "first_version":
      return "destGoalFirstVersion";
    case "launch_publicly":
      return "destGoalLaunchPublicly";
    case "run_event":
      return "destGoalRunEvent";
    case "complete_research":
      return "destGoalCompleteResearch";
    case "prepare_pitch":
      return "destGoalPreparePitch";
    default:
      return "destGoalFirstVersion";
  }
}
