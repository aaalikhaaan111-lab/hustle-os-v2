"use server";

import Anthropic from "@anthropic-ai/sdk";
import type { Locale } from "@/i18n/locale";
import type { GeneratedTask, ProjectCreationInput, ProjectPitch, ProjectSummary } from "@/lib/build/types";

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
  return `You are a business mentor inside Ventrio, an entrepreneurship platform for teenagers building a real project. You are given a deterministic list of project roadmap tasks and the user's project details. Rewrite each task's title, objective, action, expectedOutput, and completionCriteria to be more specific to this exact project (its niche, audience, and stated outcome) — sharper wording, concrete nouns instead of placeholders, still realistic for a teenager to do alone.

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
