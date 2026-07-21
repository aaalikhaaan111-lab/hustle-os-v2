"use server";

import { revalidatePath } from "next/cache";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import {
  INTENDED_OUTCOME_OPTIONS,
  NICHE_OPTIONS,
  PROJECT_TYPE_OPTIONS,
  STARTING_STAGE_OPTIONS,
  TIME_AVAILABILITY_OPTIONS,
} from "@/lib/build/options";
import { generatePathway } from "@/lib/build/pathwayTemplates";
import { getActiveProject, getProjectOutputs, getProjectTasks, computeProgress } from "@/lib/build/queries";
import { isStructuredField, parseSnapshotFields, type StructuredField } from "@/lib/build/snapshot";
import {
  refineProjectPathwayAction,
  generateProjectSummaryAction,
  reviewTaskAnswerWithAI,
} from "@/lib/actions/buildAi";
import { buildDeterministicReview, isObviousNonsense } from "@/lib/build/reviewFallback";
import type {
  GeneratedTask,
  IntendedOutcome,
  PathwayMode,
  ProjectCreationInput,
  ProjectPitch,
  ProjectSummary,
  ProjectType,
  StartingStage,
  TaskReview,
  TimeAvailability,
} from "@/lib/build/types";

const NAME_MAX_LENGTH = 80;
const AUDIENCE_MAX_LENGTH = 200;
const MIN_ANSWER_LENGTH = 10;
const STRUCTURED_VALUE_MAX_LENGTH = 800;

export interface CreateProjectResult {
  error: string | null;
  projectId?: string;
}

function isValidCreationInput(input: ProjectCreationInput): boolean {
  if (!PROJECT_TYPE_OPTIONS.some((option) => option.id === input.projectType)) return false;
  if (!NICHE_OPTIONS.some((option) => option.id === input.niche)) return false;
  if (!STARTING_STAGE_OPTIONS.some((option) => option.id === input.startingStage)) return false;
  if (!INTENDED_OUTCOME_OPTIONS.some((option) => option.id === input.intendedOutcome)) return false;
  if (!TIME_AVAILABILITY_OPTIONS.some((option) => option.id === input.timeAvailability)) return false;
  if (input.pathwayMode !== "standard" && input.pathwayMode !== "quick_sprint") return false;
  if (input.name && input.name.length > NAME_MAX_LENGTH) return false;
  if (input.targetAudience && input.targetAudience.length > AUDIENCE_MAX_LENGTH) return false;
  return true;
}

export async function createProjectAction(input: ProjectCreationInput): Promise<CreateProjectResult> {
  const t = await getTranslations("build");
  const locale = await getLocale();

  if (!isValidCreationInput(input)) {
    return { error: t("errorInvalidInput") };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: t("errorSession") };
  }

  const existing = await getActiveProject(supabase, user.id);
  if (existing) {
    return { error: t("errorProjectExists") };
  }

  const nicheOption = NICHE_OPTIONS.find((option) => option.id === input.niche);
  const timeOption = TIME_AVAILABILITY_OPTIONS.find((option) => option.id === input.timeAvailability);
  const nicheLabel = nicheOption ? t(nicheOption.labelKey) : input.niche;
  const timeLabel = timeOption ? t(timeOption.labelKey) : "";
  const audienceLabel = input.targetAudience?.trim() || t("audienceFallback");

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name: input.name?.trim() || null,
      project_type: input.projectType,
      niche: input.niche,
      starting_stage: input.startingStage,
      target_audience: input.targetAudience?.trim() || null,
      intended_outcome: input.intendedOutcome,
      time_availability: input.timeAvailability,
      pathway_mode: input.pathwayMode,
      locale,
    })
    .select()
    .single();

  if (projectError || !project) {
    return { error: t("errorSaveFailed") };
  }

  const deterministicTasks = generatePathway(input, locale, {
    niche: nicheLabel,
    audience: audienceLabel,
    timeAvailability: timeLabel,
  });

  const finalTasks = await refineProjectPathwayAction(input, deterministicTasks, locale);

  const { error: tasksError } = await supabase.from("project_tasks").insert(
    finalTasks.map((task) => ({
      project_id: project.id,
      user_id: user.id,
      stage: task.stage,
      order_index: task.orderIndex,
      title: task.title,
      objective: task.objective,
      why_it_matters: task.whyItMatters,
      action: task.action,
      expected_output: task.expectedOutput,
      estimated_time: task.estimatedTime,
      completion_criteria: task.completionCriteria,
      output_kind: task.outputKind,
      recommended_lesson_id: task.recommendedLessonId ?? null,
      xp: task.xp,
    }))
  );

  if (tasksError) {
    await supabase.from("projects").delete().eq("id", project.id);
    return { error: t("errorSaveFailed") };
  }

  await supabase
    .from("projects")
    .update({ current_stage: finalTasks[0]?.stage ?? null })
    .eq("id", project.id);

  revalidatePath("/build");
  revalidatePath("/build/workspace");
  revalidatePath("/dashboard");

  return { error: null, projectId: project.id };
}

export interface RefineTasksResult {
  error: string | null;
  refined: number;
}

// Explicit, user-triggered refinement of an existing project's tasks (for
// projects whose tasks are still generic — e.g. created while AI was
// unavailable). Refines ONLY pending tasks, never completed ones, so it can
// never rewrite work the user has already done. Falls back to leaving tasks
// unchanged when AI is unavailable or its output fails validation.
export async function refineExistingTasksAction(projectId: string): Promise<RefineTasksResult> {
  const t = await getTranslations("build");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: t("errorSession"), refined: 0 };

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!project) return { error: t("errorProjectNotFound"), refined: 0 };

  const tasks = await getProjectTasks(supabase, projectId);
  const pending = tasks.filter((task) => task.status !== "completed");
  if (pending.length === 0) return { error: null, refined: 0 };

  const input: ProjectCreationInput = {
    name: project.name,
    projectType: project.project_type as ProjectType,
    niche: project.niche,
    startingStage: project.starting_stage as StartingStage,
    targetAudience: project.target_audience,
    intendedOutcome: project.intended_outcome as IntendedOutcome,
    timeAvailability: project.time_availability as TimeAvailability,
    pathwayMode: project.pathway_mode as PathwayMode,
  };

  // Use each pending task's own id as the refinement key so results map back
  // to the exact rows.
  const generated: GeneratedTask[] = pending.map((task) => ({
    templateId: task.id,
    stage: task.stage,
    orderIndex: task.order_index,
    title: task.title,
    objective: task.objective,
    whyItMatters: task.why_it_matters,
    action: task.action,
    expectedOutput: task.expected_output,
    estimatedTime: task.estimated_time,
    completionCriteria: task.completion_criteria,
    outputKind: task.output_kind,
    xp: task.xp,
    recommendedLessonId: task.recommended_lesson_id ?? undefined,
  }));

  // Refinement output uses the project's own language.
  const refined = await refineProjectPathwayAction(input, generated, project.locale);
  const originalById = new Map(generated.map((g) => [g.templateId, g]));

  let count = 0;
  for (const r of refined) {
    const original = originalById.get(r.templateId);
    if (!original) continue;
    const changed =
      r.title !== original.title ||
      r.objective !== original.objective ||
      r.action !== original.action ||
      r.expectedOutput !== original.expectedOutput ||
      r.completionCriteria !== original.completionCriteria;
    if (!changed) continue;

    // status = pending guard is belt-and-suspenders: `pending` was already
    // filtered, but this makes it impossible to rewrite a task that got
    // completed in between.
    const { error } = await supabase
      .from("project_tasks")
      .update({
        title: r.title,
        objective: r.objective,
        action: r.action,
        expected_output: r.expectedOutput,
        completion_criteria: r.completionCriteria,
      })
      .eq("id", r.templateId)
      .eq("user_id", user.id)
      .eq("status", "pending");
    if (!error) count += 1;
  }

  if (count > 0) {
    revalidatePath("/build/workspace");
  }
  return { error: null, refined: count };
}

export interface ReviewTaskResult {
  error: string | null;
  /** The review of this submission (null only on a hard error before review). */
  review: TaskReview | null;
  /** Whether this submission is what marked the task complete. */
  completed: boolean;
  xpAwarded: boolean;
  xpAmount: number;
  projectCompleted: boolean;
}

function reviewError(message: string): ReviewTaskResult {
  return {
    error: message,
    review: null,
    completed: false,
    xpAwarded: false,
    xpAmount: 0,
    projectCompleted: false,
  };
}

type TaskUpdatePayload = Database["public"]["Tables"]["project_tasks"]["Update"];

// Persist the task update. Attempts to include the review columns; if they
// don't exist yet (migration not applied), retries with just the base fields
// so completion is never blocked by the review not being persistable.
async function updateTaskResilient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  taskId: string,
  base: TaskUpdatePayload,
  review: TaskReview
): Promise<void> {
  const { error } = await supabase
    .from("project_tasks")
    .update({ ...base, review_status: review.status, review })
    .eq("id", taskId);
  if (!error) return;
  // Fall back to base-only (review columns likely missing). If `base` is empty
  // this is a harmless no-op — the review simply isn't persisted this time.
  if (Object.keys(base).length > 0) {
    await supabase.from("project_tasks").update(base).eq("id", taskId);
  }
}

/**
 * Reviews a task answer and completes the task ONLY if the review says it's
 * ready. Saves the answer either way (so weak work is never lost), persists
 * the review, and can never let empty/gibberish/unrelated input complete a
 * task — even when AI is unavailable, the deterministic review still gates it.
 */
export async function reviewTaskAnswerAction(
  taskId: string,
  content: string
): Promise<ReviewTaskResult> {
  const t = await getTranslations("build");
  const locale = await getLocale();
  const trimmed = content.trim();

  // Deterministic minimum before any network/AI cost: too short to review.
  if (trimmed.length < MIN_ANSWER_LENGTH) {
    return {
      ...reviewError(t("errorAnswerTooShort")),
      error: null,
      review: buildDeterministicReview(trimmed, locale),
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return reviewError(t("errorSession"));

  const { data: task } = await supabase
    .from("project_tasks")
    .select("*")
    .eq("id", taskId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!task) return reviewError(t("errorTaskNotFound"));

  const { data: project } = await supabase
    .from("projects")
    .select("project_type, niche, target_audience, locale")
    .eq("id", task.project_id)
    .eq("user_id", user.id)
    .maybeSingle();

  // AI-generated feedback follows the PROJECT's stored language, not whatever
  // interface locale is currently active — so a Russian project stays Russian
  // even if the user switched the UI to English.
  const projectLocale = project?.locale ?? locale;

  // Save the draft answer up front so the user's work is never lost, even if
  // the review comes back "needs work".
  const { error: outputError } = await supabase.from("project_outputs").upsert(
    {
      project_id: task.project_id,
      task_id: task.id,
      user_id: user.id,
      content: trimmed,
    },
    { onConflict: "task_id" }
  );

  if (outputError) return reviewError(t("errorSaveFailed"));

  // Review: cheap nonsense pre-filter → AI review → deterministic fallback.
  let review: TaskReview;
  if (isObviousNonsense(trimmed)) {
    review = buildDeterministicReview(trimmed, projectLocale);
  } else {
    const aiReview = await reviewTaskAnswerWithAI(
      {
        taskTitle: task.title,
        objective: task.objective,
        action: task.action,
        expectedOutput: task.expected_output,
        completionCriteria: task.completion_criteria,
        projectType: project?.project_type ?? task.stage,
        niche: project?.niche ?? "",
        targetAudience: project?.target_audience ?? null,
      },
      trimmed,
      projectLocale
    );
    review = aiReview ?? buildDeterministicReview(trimmed, projectLocale);
  }

  const wasAlreadyCompleted = task.status === "completed";
  const nowComplete = review.status === "ready";

  const base: TaskUpdatePayload =
    nowComplete && !wasAlreadyCompleted
      ? { status: "completed", completed_at: new Date().toISOString(), xp_awarded: true }
      : {};
  await updateTaskResilient(supabase, task.id, base, review);

  // Recompute progress treating this task as completed only if it now is.
  const allTasks = await getProjectTasks(supabase, task.project_id);
  const effectiveStatus = nowComplete || wasAlreadyCompleted ? "completed" : task.status;
  const { progress, currentStage } = computeProgress(
    allTasks.map((t2) =>
      t2.id === task.id ? { ...t2, status: effectiveStatus as "pending" | "completed" } : t2
    )
  );
  const justAwarded = nowComplete && !wasAlreadyCompleted;
  const projectCompleted = progress === 100 && justAwarded;

  await supabase
    .from("projects")
    .update({
      progress,
      current_stage: currentStage,
      status: progress === 100 ? "completed" : "active",
    })
    .eq("id", task.project_id);

  revalidatePath("/build/workspace");
  revalidatePath(`/build/workspace/task/${taskId}`);
  revalidatePath("/dashboard");

  return {
    error: null,
    review,
    completed: justAwarded,
    xpAwarded: justAwarded,
    xpAmount: justAwarded ? task.xp : 0,
    projectCompleted,
  };
}

export interface UpdatePitchResult {
  error: string | null;
}

export async function updatePitchAction(
  projectId: string,
  pitch: ProjectPitch
): Promise<UpdatePitchResult> {
  const t = await getTranslations("build");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: t("errorSession") };
  }

  const { error } = await supabase
    .from("projects")
    .update({ pitch })
    .eq("id", projectId)
    .eq("user_id", user.id);

  if (error) {
    return { error: t("errorSaveFailed") };
  }

  revalidatePath("/build/workspace/pitch");
  return { error: null };
}

export interface GenerateSummaryResult {
  error: string | null;
  summary?: ProjectSummary;
  pitch?: ProjectPitch;
}

function buildDeterministicSummary(
  projectName: string,
  completed: { title: string; answer: string }[],
  locale: string
): { summary: Omit<ProjectSummary, "name">; pitch: ProjectPitch } {
  const isRu = locale === "ru";
  const find = (keyword: string) =>
    completed.find((c) => c.title.toLowerCase().includes(keyword))?.answer ?? "";

  const problem = find(isRu ? "проблем" : "problem") || completed[0]?.answer || "";
  const audience = find(isRu ? "аудитор" : "audience") || "";
  const solution = find(isRu ? "решен" : "solution") || "";
  const evidence = find(isRu ? "интервью" : "interview") || find(isRu ? "тест" : "test") || "";
  const firstVersion = find(isRu ? "верси" : "version") || "";
  const notYet = isRu ? "Пока не заполнено." : "Not yet filled in.";

  const summary: Omit<ProjectSummary, "name"> = {
    oneLiner: solution || notYet,
    problem: problem || notYet,
    audience: audience || notYet,
    solution: solution || notYet,
    whyItMatters: problem || notYet,
    evidence: evidence || (isRu ? "Пока не собрано." : "Not yet collected."),
    firstVersion: firstVersion || (isRu ? "Ещё не создана." : "Not yet built."),
    mainRisk: isRu ? "Определи главный риск в разделе питча." : "Name your main risk in the pitch section.",
    nextStep: isRu ? "Продолжи работу над проектом в рабочем пространстве." : "Keep going in the project workspace.",
  };

  const pitch: ProjectPitch = {
    problem: summary.problem,
    audience: summary.audience,
    solution: summary.solution,
    evidence: summary.evidence,
    progress: firstVersion || (isRu ? "В процессе." : "In progress."),
    nextStep: summary.nextStep,
    pitch30: `${projectName}: ${summary.solution}`.trim(),
    pitch60: `${summary.problem} ${summary.solution} ${summary.evidence}`.trim(),
    qaPrep: [
      isRu
        ? "В: Почему это важно? О: " + summary.whyItMatters
        : "Q: Why does this matter? A: " + summary.whyItMatters,
    ],
  };

  return { summary, pitch };
}

export async function generateSummaryAction(projectId: string): Promise<GenerateSummaryResult> {
  const t = await getTranslations("build");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: t("errorSession") };
  }

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!project) {
    return { error: t("errorProjectNotFound") };
  }

  // Summary + pitch are written in the project's own language.
  const locale = project.locale;

  const [tasks, outputs] = await Promise.all([
    getProjectTasks(supabase, projectId),
    getProjectOutputs(supabase, projectId),
  ]);
  const outputByTask = new Map(outputs.map((output) => [output.task_id, output.content]));

  const completedTasks = tasks
    .filter((task) => task.status === "completed" && outputByTask.has(task.id))
    .map((task) => ({ title: task.title, answer: outputByTask.get(task.id) ?? "" }));

  if (completedTasks.length === 0) {
    return { error: t("errorNoCompletedTasks") };
  }

  const projectName = project.name || t("untitledProject");

  const aiResult = await generateProjectSummaryAction({
    projectName,
    projectType: project.project_type,
    niche: project.niche,
    targetAudience: project.target_audience,
    completedTasks,
    locale,
  });

  const { summary: partialSummary, pitch } =
    aiResult ?? buildDeterministicSummary(projectName, completedTasks, locale);

  const summary: ProjectSummary = { name: projectName, ...partialSummary };

  await supabase
    .from("projects")
    .update({ project_summary: summary, pitch })
    .eq("id", projectId);

  revalidatePath("/build/workspace/pitch");

  return { error: null, summary, pitch };
}

// ============================================================================
// Assistant-confirmed structured outputs
// ============================================================================

export interface SaveStructuredFieldResult {
  error: string | null;
  /** The saved value (echoed back so the client can update the state panel). */
  saved: { field: StructuredField; value: string } | null;
}

/**
 * Persists ONE user-confirmed structured field (problem, audience, …) into
 * projects.snapshot_fields. Enforced constraints:
 *  - the field must be on the allowlist (never an arbitrary column);
 *  - the project must belong to the caller;
 *  - the value is trimmed and length-capped.
 * It never touches tasks, review state, XP, or progress — this is a snapshot
 * overlay, not task completion. Degrades gracefully when the snapshot_fields
 * column hasn't been migrated yet (reports it's unavailable rather than
 * throwing), mirroring how the review/assistant tables were rolled out.
 */
export async function saveStructuredFieldAction(
  projectId: string,
  field: string,
  value: string
): Promise<SaveStructuredFieldResult> {
  const t = await getTranslations("build");

  if (!isStructuredField(field)) {
    return { error: t("errorInvalidInput"), saved: null };
  }
  const trimmed = value.trim().slice(0, STRUCTURED_VALUE_MAX_LENGTH);
  if (trimmed.length === 0) {
    return { error: t("errorAnswerTooShort"), saved: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("errorSession"), saved: null };

  const { data: project } = await supabase
    .from("projects")
    .select("id, snapshot_fields")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!project) return { error: t("errorProjectNotFound"), saved: null };

  // Merge into the existing allowlisted map; parse discards anything unknown.
  const current = parseSnapshotFields(project.snapshot_fields);
  const next = { ...current, [field]: trimmed };

  const { error } = await supabase
    .from("projects")
    .update({ snapshot_fields: next })
    .eq("id", projectId)
    .eq("user_id", user.id);

  // Column not migrated yet → the assistant still works, saving just isn't
  // persistable. Report it plainly instead of failing hard.
  if (error) {
    return { error: t("errorSaveUnavailable"), saved: null };
  }

  revalidatePath("/build/workspace");
  return { error: null, saved: { field, value: trimmed } };
}
