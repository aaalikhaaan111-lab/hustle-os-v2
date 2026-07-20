"use server";

import Anthropic from "@anthropic-ai/sdk";
import type { Locale } from "@/i18n/locale";
import type {
  GeneratedTask,
  ProjectCreationInput,
  ProjectPitch,
  ProjectSummary,
  TaskReview,
} from "@/lib/build/types";

// ============================================================================
// Pathway refinement
// ============================================================================
// The deterministic templates (src/lib/build/pathwayTemplates.ts) are always
// the source of structure — this only rewrites task text to be more specific
// to the user's niche/audience/outcome. It can never add, remove, or reorder
// tasks: the schema requires the same templateId set that was sent in, and
// the caller must reject (and fall back to the deterministic text) if that
// invariant is violated.

const REFINE_SCHEMA = {
  type: "object",
  properties: {
    tasks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          templateId: { type: "string" },
          title: { type: "string" },
          objective: { type: "string" },
          action: { type: "string" },
          expectedOutput: { type: "string" },
          completionCriteria: { type: "string" },
        },
        required: ["templateId", "title", "objective", "action", "expectedOutput", "completionCriteria"],
        additionalProperties: false,
      },
    },
  },
  required: ["tasks"],
  additionalProperties: false,
};

interface RefinedTaskFields {
  templateId: string;
  title: string;
  objective: string;
  action: string;
  expectedOutput: string;
  completionCriteria: string;
}

function refinePrompt(locale: Locale | string) {
  const language = locale === "ru" ? "Russian" : "English";
  return `You are a business mentor inside Ventrio, an entrepreneurship platform for teenagers building a real project. You are given a deterministic list of project roadmap tasks and the user's project details. Rewrite each task's title, objective, action, expectedOutput, and completionCriteria to be more specific to this exact project (its name, niche, audience, and stated outcome) — sharper wording, concrete nouns instead of placeholders, referencing the project by name where natural (e.g. "Find two tools students use instead of <ProjectName>"), still realistic for a teenager to do alone.

Rules:
- Keep exactly the same tasks, in the same order, identified by the same templateId. Never add, remove, merge, or reorder tasks.
- Never invent research, interviews, or results that haven't happened — you are rewriting instructions, not reporting outcomes.
- Never promise revenue, users, or success.
- Write ALL text in ${language}, matching the language of the input.
- Keep each field roughly the same length as the input — a little more specific, not a different task.

Respond only with the requested JSON.`;
}

function buildRefineUserPrompt(input: ProjectCreationInput, tasks: GeneratedTask[]): string {
  return JSON.stringify({
    projectName: input.name ?? "not named yet",
    projectType: input.projectType,
    niche: input.niche,
    targetAudience: input.targetAudience ?? "not specified",
    intendedOutcome: input.intendedOutcome,
    tasks: tasks.map((task) => ({
      templateId: task.templateId,
      title: task.title,
      objective: task.objective,
      action: task.action,
      expectedOutput: task.expectedOutput,
      completionCriteria: task.completionCriteria,
    })),
  });
}

function isValidRefinement(
  parsed: unknown,
  originalTasks: GeneratedTask[]
): parsed is { tasks: RefinedTaskFields[] } {
  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { tasks?: unknown }).tasks)) {
    return false;
  }
  const tasks = (parsed as { tasks: unknown[] }).tasks;
  if (tasks.length !== originalTasks.length) return false;

  const expectedIds = new Set(originalTasks.map((task) => task.templateId));
  const seenIds = new Set<string>();

  for (const entry of tasks) {
    if (!entry || typeof entry !== "object") return false;
    const candidate = entry as Record<string, unknown>;
    const fields = ["templateId", "title", "objective", "action", "expectedOutput", "completionCriteria"] as const;
    for (const field of fields) {
      if (typeof candidate[field] !== "string" || candidate[field].trim().length === 0) {
        return false;
      }
    }
    const templateId = candidate.templateId as string;
    if (!expectedIds.has(templateId) || seenIds.has(templateId)) return false;
    seenIds.add(templateId);
  }

  return true;
}

/**
 * Best-effort AI refinement of the deterministic pathway. Always returns a
 * usable task list: falls back to the untouched deterministic tasks whenever
 * the API key is missing, the call fails, or the response doesn't pass
 * strict validation against the original task set.
 */
export async function refineProjectPathwayAction(
  input: ProjectCreationInput,
  tasks: GeneratedTask[],
  locale: Locale | string
): Promise<GeneratedTask[]> {
  if (!process.env.ANTHROPIC_API_KEY) return tasks;

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: REFINE_SCHEMA },
      },
      system: refinePrompt(locale),
      messages: [{ role: "user", content: buildRefineUserPrompt(input, tasks) }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") return tasks;

    const parsed = JSON.parse(textBlock.text) as unknown;
    if (!isValidRefinement(parsed, tasks)) return tasks;

    const byId = new Map(parsed.tasks.map((entry) => [entry.templateId, entry]));
    return tasks.map((task) => {
      const refined = byId.get(task.templateId);
      if (!refined) return task;
      return {
        ...task,
        title: refined.title,
        objective: refined.objective,
        action: refined.action,
        expectedOutput: refined.expectedOutput,
        completionCriteria: refined.completionCriteria,
      };
    });
  } catch {
    return tasks;
  }
}

// ============================================================================
// Project summary + pitch generation
// ============================================================================

const SUMMARY_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "object",
      properties: {
        oneLiner: { type: "string" },
        problem: { type: "string" },
        audience: { type: "string" },
        solution: { type: "string" },
        whyItMatters: { type: "string" },
        evidence: { type: "string" },
        firstVersion: { type: "string" },
        mainRisk: { type: "string" },
        nextStep: { type: "string" },
      },
      required: [
        "oneLiner", "problem", "audience", "solution", "whyItMatters",
        "evidence", "firstVersion", "mainRisk", "nextStep",
      ],
      additionalProperties: false,
    },
    pitch: {
      type: "object",
      properties: {
        problem: { type: "string" },
        audience: { type: "string" },
        solution: { type: "string" },
        evidence: { type: "string" },
        progress: { type: "string" },
        nextStep: { type: "string" },
        pitch30: { type: "string" },
        pitch60: { type: "string" },
        qaPrep: { type: "array", items: { type: "string" } },
      },
      required: [
        "problem", "audience", "solution", "evidence", "progress",
        "nextStep", "pitch30", "pitch60", "qaPrep",
      ],
      additionalProperties: false,
    },
  },
  required: ["summary", "pitch"],
  additionalProperties: false,
};

interface SummaryInput {
  projectName: string;
  projectType: string;
  niche: string;
  targetAudience: string | null;
  completedTasks: { title: string; answer: string }[];
  locale: Locale | string;
}

function summaryPrompt(locale: Locale | string) {
  const language = locale === "ru" ? "Russian" : "English";
  return `You are a business mentor inside Ventrio, an entrepreneurship platform for teenagers. You are given the real work a teenager has completed on their project (task titles and their own answers). Turn this into a Project Summary and a structured Pitch, using ONLY what the user actually wrote — never invent research, interviews, users, or results they didn't report.

Rules:
- Base every field strictly on the provided completed work. If something (e.g. evidence, or a first version) wasn't reported, say so honestly instead of inventing it (e.g. "Not yet validated" / "No first version yet").
- Never promise revenue, investment, users, or success.
- pitch30 must be speakable in about 30 seconds (roughly 60-80 words), pitch60 in about 60 seconds (roughly 130-160 words).
- qaPrep must be 3 to 5 short likely judge/investor questions with a one-sentence suggested answer each, as single strings like "Q: ... A: ...".
- Write ALL text in ${language}.

Respond only with the requested JSON.`;
}

function buildSummaryUserPrompt(input: SummaryInput): string {
  return JSON.stringify({
    projectName: input.projectName,
    projectType: input.projectType,
    niche: input.niche,
    targetAudience: input.targetAudience ?? "not specified",
    completedWork: input.completedTasks,
  });
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidSummaryResponse(
  parsed: unknown
): parsed is { summary: Omit<ProjectSummary, "name">; pitch: ProjectPitch } {
  if (!parsed || typeof parsed !== "object") return false;
  const candidate = parsed as Record<string, unknown>;
  const summary = candidate.summary as Record<string, unknown> | undefined;
  const pitch = candidate.pitch as Record<string, unknown> | undefined;
  if (!summary || !pitch) return false;

  const summaryFields = [
    "oneLiner", "problem", "audience", "solution", "whyItMatters",
    "evidence", "firstVersion", "mainRisk", "nextStep",
  ] as const;
  for (const field of summaryFields) {
    if (!isNonEmptyString(summary[field])) return false;
  }

  const pitchFields = [
    "problem", "audience", "solution", "evidence", "progress",
    "nextStep", "pitch30", "pitch60",
  ] as const;
  for (const field of pitchFields) {
    if (!isNonEmptyString(pitch[field])) return false;
  }

  if (!Array.isArray(pitch.qaPrep) || pitch.qaPrep.length === 0) return false;
  if (!pitch.qaPrep.every((entry) => isNonEmptyString(entry))) return false;

  return true;
}

/**
 * Best-effort AI generation of the final Project Summary and Pitch. Returns
 * null when the API key is missing, the call fails, or validation fails —
 * callers must use the deterministic fallback (buildDeterministicSummary) in
 * that case, so project completion is never blocked on AI availability.
 */
export async function generateProjectSummaryAction(
  input: SummaryInput
): Promise<{ summary: Omit<ProjectSummary, "name">; pitch: ProjectPitch } | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (input.completedTasks.length === 0) return null;

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: SUMMARY_SCHEMA },
      },
      system: summaryPrompt(input.locale),
      messages: [{ role: "user", content: buildSummaryUserPrompt(input) }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") return null;

    const parsed = JSON.parse(textBlock.text) as unknown;
    if (!isValidSummaryResponse(parsed)) return null;

    return parsed;
  } catch {
    return null;
  }
}

// ============================================================================
// Task answer review
// ============================================================================
// A focused review of the user's answer to one Build task, before the task can
// be marked complete. Returns null when the API key is missing, the call
// fails, or the output fails validation — callers fall back to the
// deterministic review (src/lib/build/reviewFallback.ts).

const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["ready", "needs_work"] },
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    missing_points: { type: "array", items: { type: "string" } },
    next_improvement: { type: "string" },
    improved_example: { type: "string" },
  },
  required: ["status", "summary", "strengths", "missing_points", "next_improvement"],
  additionalProperties: false,
};

export interface TaskReviewContext {
  taskTitle: string;
  objective: string;
  action: string;
  expectedOutput: string;
  completionCriteria: string;
  projectType: string;
  niche: string;
  targetAudience: string | null;
}

function reviewPrompt(locale: Locale | string) {
  const language = locale === "ru" ? "Russian" : "English";
  return `You are a supportive but honest project mentor inside Ventrio, an entrepreneurship platform for teenagers. Review the student's answer to ONE build task and decide whether it is good enough to move on.

Judge the answer on:
- relevance: does it actually answer THIS task's question, not a different one?
- specificity: does it contain concrete details about their own project, not vague filler?
- substance: is there enough real thinking to build on?
- honesty: flag claims stated as fact that clearly haven't been checked (e.g. inventing interview results), but do NOT ask them to prove everything — this is early-stage work.
- gibberish: random characters, keyboard mashing, or unrelated text is never "ready".

Decide status:
- "ready": a genuine, on-topic answer with real substance. It does NOT need to be perfect or long — a clear, honest 2-4 sentence answer that addresses the task passes.
- "needs_work": empty, random, unrelated, or too vague/thin to show real thinking. Give specific, actionable guidance.

Rules:
- Never shame the student. Be encouraging and concrete. Write for a teenager.
- Never invent evidence, competitors, or results, and never rewrite their project for them.
- "strengths": 0-3 short points (empty array if genuinely none). "missing_points": 0-3 short points. "next_improvement": one concrete next step. "improved_example" is OPTIONAL — include a short illustrative example ONLY when it would clearly help, and label it as an example, not as their real answer.
- Keep every field short and plain. Write ALL text in ${language}.

Respond only with the requested JSON.`;
}

function buildReviewUserPrompt(context: TaskReviewContext, answer: string): string {
  return JSON.stringify({
    task: {
      title: context.taskTitle,
      objective: context.objective,
      action: context.action,
      expectedOutput: context.expectedOutput,
      completionCriteria: context.completionCriteria,
    },
    project: {
      type: context.projectType,
      niche: context.niche,
      audience: context.targetAudience ?? "not specified",
    },
    studentAnswer: answer,
  });
}

function isValidReview(parsed: unknown): parsed is {
  status: "ready" | "needs_work";
  summary: string;
  strengths: string[];
  missing_points: string[];
  next_improvement: string;
  improved_example?: string;
} {
  if (!parsed || typeof parsed !== "object") return false;
  const c = parsed as Record<string, unknown>;
  if (c.status !== "ready" && c.status !== "needs_work") return false;
  if (!isNonEmptyString(c.summary) || !isNonEmptyString(c.next_improvement)) return false;
  if (!Array.isArray(c.strengths) || !c.strengths.every((s) => typeof s === "string")) return false;
  if (!Array.isArray(c.missing_points) || !c.missing_points.every((s) => typeof s === "string")) return false;
  if (c.improved_example !== undefined && typeof c.improved_example !== "string") return false;
  return true;
}

/**
 * Best-effort AI review of a task answer. Returns null when AI is unavailable
 * or the output fails validation — the caller must then use the deterministic
 * review so a task can never be blocked (or wrongly completed) purely because
 * AI is down.
 */
export async function reviewTaskAnswerWithAI(
  context: TaskReviewContext,
  answer: string,
  locale: Locale | string
): Promise<TaskReview | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: REVIEW_SCHEMA },
      },
      system: reviewPrompt(locale),
      messages: [{ role: "user", content: buildReviewUserPrompt(context, answer) }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") return null;

    const parsed = JSON.parse(textBlock.text) as unknown;
    if (!isValidReview(parsed)) return null;

    return {
      status: parsed.status,
      summary: parsed.summary,
      strengths: parsed.strengths,
      missingPoints: parsed.missing_points,
      nextImprovement: parsed.next_improvement,
      improvedExample: parsed.improved_example,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// Project assistant (chat)
// ============================================================================
// A project-scoped mentor. It answers using ONLY the current project's context
// and stays focused on building/validating/launching/pitching that project.
// Chat-only: it never writes to project data — so "must not change project
// data without confirmation" holds by construction.

export interface AssistantContext {
  projectName: string;
  projectType: string;
  niche: string;
  intendedOutcome: string;
  targetAudience: string | null;
  timeAvailability: string;
  currentStage: string | null;
  currentTaskTitle: string | null;
  snapshot: { label: string; value: string }[];
  pitchSummary: string | null;
  memorySummary: string | null;
}

export interface AssistantTurn {
  role: "user" | "assistant";
  content: string;
}

function assistantSystemPrompt(context: AssistantContext, locale: Locale | string): string {
  const language = locale === "ru" ? "Russian" : "English";
  const redirect =
    locale === "ru"
      ? "Я помогаю именно с этим проектом. Спроси меня об идее, аудитории, проверке, следующих шагах, запуске или питче."
      : "I'm here to help with this project. Ask me about its idea, audience, validation, next steps, launch or pitch.";

  const snapshotLines =
    context.snapshot.length > 0
      ? context.snapshot.map((s) => `- ${s.label}: ${s.value}`).join("\n")
      : "- (nothing saved yet)";

  return `You are the project mentor inside Ventrio, an entrepreneurship app for teenagers. You help ONE specific project and nothing else. You are a mentor, not a general chatbot and not an autonomous agent.

STAY ON THIS PROJECT. Allowed topics: the project idea, problem, audience, niche, competitors, value proposition, validation, interview questions, research, planning, first version/prototype, relevant tools, testing, launch, feedback, risks, business model, pitch, presentation, next actions, clarifying the current Build task, and entrepreneurship concepts directly connected to THIS project. A design / coding / marketing / research question IS allowed when it clearly helps this project. If a message is unrelated to the project (homework, trivia, other businesses, general chatting), do NOT answer it — reply briefly with exactly: "${redirect}"

BEHAVE LIKE A PRACTICAL MENTOR: remember earlier decisions, don't re-ask what's already answered, refer back to the saved context, ask ONE useful clarifying question only when needed, challenge weak assumptions respectfully, separate evidence from guesses, give specific next actions and say why they matter, keep advice realistic for a teenager, be concise by default and go deeper only when asked.

NEVER: fabricate market data, interviews, competitors, users, traction, or research; claim work was done that wasn't; complete or edit the user's tasks; change their saved project; make financial/legal guarantees; or promise users, income, investment or success. When you give an example, label it clearly as an example, not as their real evidence.

Write ALL replies in ${language}. Keep replies short and plain.

── THIS PROJECT ──
Name: ${context.projectName}
Type: ${context.projectType} | Niche: ${context.niche} | Goal: ${context.intendedOutcome}
Audience: ${context.targetAudience ?? "not specified yet"}
Weekly time: ${context.timeAvailability}
Current stage: ${context.currentStage ?? "just starting"}${context.currentTaskTitle ? ` | Current task: ${context.currentTaskTitle}` : ""}

Saved work so far (the user's real, confirmed inputs — treat as facts):
${snapshotLines}
${context.pitchSummary ? `\nPitch so far: ${context.pitchSummary}` : ""}
${context.memorySummary ? `\nEarlier in this project's conversations: ${context.memorySummary}` : ""}`;
}

/**
 * Best-effort assistant reply. Returns null when AI is unavailable or fails —
 * the caller then shows a temporary "assistant unavailable" note WITHOUT
 * persisting a fake assistant message or memory.
 */
export async function generateAssistantReply(
  context: AssistantContext,
  history: AssistantTurn[],
  locale: Locale | string
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (history.length === 0) return null;

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      output_config: { effort: "low" },
      system: assistantSystemPrompt(context, locale),
      messages: history.map((turn) => ({ role: turn.role, content: turn.content })),
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") return null;
    const text = textBlock.text.trim();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

/**
 * Compresses older conversation turns into a short structured memory summary.
 * Best-effort — returns null on any failure and the caller keeps the previous
 * summary rather than inventing memory.
 */
export async function summarizeProjectMemory(
  previousSummary: string | null,
  olderTurns: AssistantTurn[],
  locale: Locale | string
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (olderTurns.length === 0) return null;

  const language = locale === "ru" ? "Russian" : "English";
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 512,
      output_config: { effort: "low" },
      system: `You maintain a compact memory of a teenager's project mentoring conversation. Update the running summary with anything important from the new messages: decisions the user confirmed, facts they gave, assumptions still to validate, risks identified, and current priorities/next actions. Keep it under ~120 words, factual, and clearly separate confirmed facts from open questions. Do NOT invent anything. Write in ${language}. Return only the updated summary text.`,
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            previousSummary: previousSummary ?? "(none yet)",
            newMessages: olderTurns.map((t) => `${t.role}: ${t.content}`),
          }),
        },
      ],
    });
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") return null;
    const text = textBlock.text.trim();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}
