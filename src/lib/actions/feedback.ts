"use server";

import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import {
  mergeStage3ProjectState,
  parseStage3ProjectState,
  sanitizeStage3Output,
  type Stage3ProjectOutput,
  type Stage3ProjectState,
} from "@/lib/build/stage3Types";
import { compactResponseContext } from "@/lib/feedback/context";
import {
  feedbackStateFromRow,
  loadFeedbackAnalysisState,
  loadResponseIds,
  responseFingerprint,
} from "@/lib/feedback/queries";
import { FEEDBACK_ANALYSIS_SCHEMA, FEEDBACK_IMPROVEMENT_SCHEMA } from "@/lib/feedback/schemas";
import {
  sanitizeFeedbackAnalysis,
  sanitizeTargetedFeedbackOutput,
  targetedFeedbackOutput,
  type FeedbackAnalysisState,
  type FeedbackImprovementProposal,
} from "@/lib/feedback/types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RECOMMENDATION_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,47}$/;
const FEEDBACK_MODEL = "claude-haiku-4-5-20251001";
const LOCK_TIMEOUT_MS = 5 * 60 * 1000;
const HAIKU_INPUT_USD_PER_MILLION = 1;
const HAIKU_OUTPUT_USD_PER_MILLION = 5;

interface AnalysisResult {
  error: string | null;
  feedback: FeedbackAnalysisState | null;
}

interface ImprovementResult {
  error: string | null;
  proposal: FeedbackImprovementProposal | null;
}

interface ApplyResult {
  error: string | null;
  output: Stage3ProjectOutput | null;
  message: string | null;
}

interface DeleteResult {
  error: string | null;
  deletedId: string | null;
  responseCount: number | null;
  feedback: FeedbackAnalysisState | null;
}

function stableUuid(seed: string): string {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function plain(value: unknown, max: number): string {
  return typeof value === "string"
    ? value.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max)
    : "";
}

function logUsage(
  operation: "feedback_analysis" | "feedback_improvement_proposal",
  projectId: string,
  responseCount: number,
  startedAt: number,
  response: Anthropic.Message,
) {
  const estimatedCostUsd = (
    response.usage.input_tokens * HAIKU_INPUT_USD_PER_MILLION
    + response.usage.output_tokens * HAIKU_OUTPUT_USD_PER_MILLION
  ) / 1_000_000;
  console.info("[ventrio-ai-usage]", JSON.stringify({
    operation,
    projectId,
    model: response.model,
    durationMs: Date.now() - startedAt,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(6)),
    responsesAnalyzed: responseCount,
  }));
}

async function ownedFeedbackContext(projectId: string) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) return { supabase, user: null, project: null, stage3: null, publication: null, responses: [], responseIds: [], responseCount: 0, feedbackRow: null };

  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id, name, niche, target_audience, locale, snapshot_fields")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  const stage3 = parseStage3ProjectState(project?.snapshot_fields);
  if (!project || !stage3?.output) {
    return { supabase, user, project, stage3, publication: null, responses: [], responseIds: [], responseCount: 0, feedbackRow: null };
  }

  const [{ data: publication }, { data: responses }, { data: responseIds }, { count }, { data: feedbackRow }] = await Promise.all([
    supabase
      .from("project_publications")
      .select("id, project_id, user_id, slug, locale, output, is_published, published_at, updated_at")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("project_responses")
      .select("id, payload, created_at")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("project_responses")
      .select("id")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("project_responses")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("user_id", user.id),
    supabase
      .from("project_feedback_analyses")
      .select("project_id, publication_id, user_id, analysis, analyzed_response_count, analyzed_response_fingerprint, analyzed_at, analysis_started_at, created_at, updated_at")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  return {
    supabase,
    user,
    project,
    stage3,
    publication,
    responses: responses ?? [],
    responseIds: (responseIds ?? []).map((row) => row.id),
    responseCount: count ?? 0,
    feedbackRow,
  };
}

function analysisPrompt(locale: string, responseCount: number): string {
  const language = locale === "ru" ? "Russian" : "English";
  const evidenceRule = responseCount <= 2
    ? "This is weak evidence. Every signal MUST use confidence early, explicitly say this is one person's comment or an early signal, and avoid trend language."
    : responseCount < 8
      ? "This is a small sample. Use moderate only for a repeated point in at least two responses. Never use strong."
      : "Use strong only for a clear repeated pattern across a meaningful share of the submitted responses.";
  return `You analyze private visitor feedback for one Ventrio project. Produce a small, evidence-grounded editorial analysis in ${language}.

EVIDENCE RULES
- Use only the supplied responses. Never invent sentiment, demand, validation, percentages, quotes, people, or trends.
- ${evidenceRule}
- Return at most 3 primary signals, at most 1 uncertainty, and at most 3 concrete recommended changes.
- Every signal's responseCount must be the exact number of supplied responses supporting that claim and can never exceed totalResponseCount.
- Evidence must state the count plainly, such as "2 of 3 responses mentioned...". Do not expose names, emails, or contact details.
- Prefer cautious language: suggests, mentioned, early signal, more evidence is needed. Never say the idea is validated.
- Recommendations must improve the existing structured project; do not propose analytics, campaigns, billing, CRM, or unrelated features.

PRESET LENS
- community_social: purpose, willingness to join, interested participants, participation barriers, activities and benefits.
- service: willingness to request, pricing uncertainty, offer clarity, trust, client fit and onboarding friction.
- content_media: topic interest, format preference, reason to subscribe, audience and positioning.
- digital_product: problem clarity, waitlist intent, requested features, target user, CTA friction and usefulness.

Return only the requested JSON.`;
}

async function claimAnalysisLock(
  context: Awaited<ReturnType<typeof ownedFeedbackContext>>,
): Promise<boolean> {
  if (!context.user || !context.publication) return false;
  const startedAt = new Date().toISOString();
  if (!context.feedbackRow) {
    const { error } = await context.supabase.from("project_feedback_analyses").insert({
      project_id: context.project.id,
      publication_id: context.publication.id,
      user_id: context.user.id,
      analysis_started_at: startedAt,
    });
    return !error;
  }

  const staleBefore = new Date(Date.now() - LOCK_TIMEOUT_MS).toISOString();
  const { data } = await context.supabase
    .from("project_feedback_analyses")
    .update({ analysis_started_at: startedAt })
    .eq("project_id", context.project.id)
    .eq("user_id", context.user.id)
    .or(`analysis_started_at.is.null,analysis_started_at.lt.${staleBefore}`)
    .select("project_id")
    .maybeSingle();
  return !!data;
}

async function clearAnalysisLock(context: Awaited<ReturnType<typeof ownedFeedbackContext>>) {
  if (!context.user || !context.project) return;
  await context.supabase
    .from("project_feedback_analyses")
    .update({ analysis_started_at: null })
    .eq("project_id", context.project.id)
    .eq("user_id", context.user.id);
}

export async function analyzeProjectFeedbackAction(projectId: string): Promise<AnalysisResult> {
  const t = await getTranslations("feedback");
  if (!UUID_PATTERN.test(projectId)) return { error: t("errorInvalid"), feedback: null };
  const context = await ownedFeedbackContext(projectId);
  if (!context.user) return { error: t("errorSession"), feedback: null };
  if (!context.project || !context.stage3?.output || !context.publication) {
    return { error: t("errorUnauthorized"), feedback: null };
  }
  if (context.responseCount < 1) return { error: t("errorNoResponses"), feedback: null };

  const fingerprint = responseFingerprint(context.responseIds, context.responseCount);
  const currentState = feedbackStateFromRow(
    context.feedbackRow,
    context.responseIds,
    context.responseCount,
  );
  if (currentState.isCurrent) return { error: null, feedback: currentState };
  if (!(await claimAnalysisLock(context))) return { error: t("analysisInProgress"), feedback: currentState };
  if (!process.env.ANTHROPIC_API_KEY) {
    await clearAnalysisLock(context);
    return { error: t("analysisFailed"), feedback: currentState };
  }

  const publishedOutput = sanitizeStage3Output(context.publication.output, context.stage3.output.preset);
  if (!publishedOutput) {
    await clearAnalysisLock(context);
    return { error: t("analysisFailed"), feedback: currentState };
  }

  try {
    const startedAt = Date.now();
    const client = new Anthropic();
    const response = await client.messages.create({
      model: FEEDBACK_MODEL,
      max_tokens: 2200,
      output_config: { format: { type: "json_schema", schema: FEEDBACK_ANALYSIS_SCHEMA } },
      system: analysisPrompt(context.project.locale, context.responseCount),
      messages: [{
        role: "user",
        content: JSON.stringify({
          project: {
            name: context.project.name,
            niche: context.project.niche,
            targetAudience: context.project.target_audience,
            preset: context.stage3.output.preset,
            locale: context.project.locale,
          },
          totalResponseCount: context.responseCount,
          currentDraft: context.stage3.output,
          publishedSnapshot: publishedOutput,
          responseContext: compactResponseContext(publishedOutput, context.responses),
        }),
      }],
    });
    logUsage("feedback_analysis", projectId, context.responseCount, startedAt, response);
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("missing_text");
    const analysis = sanitizeFeedbackAnalysis(JSON.parse(textBlock.text), context.responseCount);
    if (!analysis) throw new Error("invalid_analysis");

    const analyzedAt = new Date().toISOString();
    const { error } = await context.supabase
      .from("project_feedback_analyses")
      .update({
        analysis,
        analyzed_response_count: context.responseCount,
        analyzed_response_fingerprint: fingerprint,
        analyzed_at: analyzedAt,
        analysis_started_at: null,
      })
      .eq("project_id", projectId)
      .eq("user_id", context.user.id);
    if (error) throw new Error("save_failed");

    const feedback = await loadFeedbackAnalysisState(
      context.supabase,
      projectId,
      context.user.id,
      context.responseIds,
      context.responseCount,
    );
    revalidatePath(`/projects/${projectId}`);
    return { error: null, feedback };
  } catch (error) {
    await clearAnalysisLock(context);
    console.error("[ventrio-ai-error]", JSON.stringify({
      operation: "feedback_analysis",
      projectId,
      message: error instanceof Error ? error.message : "unknown",
    }));
    return { error: t("analysisFailed"), feedback: currentState };
  }
}

function improvementPrompt(locale: string, target: string): string {
  const language = locale === "ru" ? "Russian" : "English";
  return `You prepare one targeted improvement to a Ventrio structured project using an evidence-grounded recommendation the owner selected.

- Write all visible text in ${language}.
- Return a complete valid project output with the same preset and compatible section/form/CTA types.
- Focus on target "${target}". Preserve strong content and avoid unrelated rewrites.
- Never invent traction, validation, users, results, prices, features, or claims not supported by the recommendation.
- "current" and "proposed" are concise human-readable before/after intents, not long dumps.
- No HTML, Markdown, URLs, or executable content.
- This is only a proposal. Do not claim it has already been applied.

Return only the requested JSON.`;
}

export async function proposeFeedbackImprovementAction(
  projectId: string,
  recommendationId: string,
): Promise<ImprovementResult> {
  const t = await getTranslations("feedback");
  if (!UUID_PATTERN.test(projectId) || !RECOMMENDATION_ID_PATTERN.test(recommendationId)) {
    return { error: t("errorInvalid"), proposal: null };
  }
  const context = await ownedFeedbackContext(projectId);
  if (!context.user) return { error: t("errorSession"), proposal: null };
  if (!context.project || !context.stage3?.output || !context.publication) {
    return { error: t("errorUnauthorized"), proposal: null };
  }
  const feedbackState = feedbackStateFromRow(
    context.feedbackRow,
    context.responseIds,
    context.responseCount,
  );
  if (!feedbackState.isCurrent) return { error: t("errorRecommendation"), proposal: null };
  const analysis = sanitizeFeedbackAnalysis(
    context.feedbackRow?.analysis,
    context.feedbackRow?.analyzed_response_count ?? context.responseCount,
  );
  const recommendation = analysis?.recommendedChanges.find((entry) => entry.id === recommendationId);
  if (!recommendation) return { error: t("errorRecommendation"), proposal: null };
  if (!process.env.ANTHROPIC_API_KEY) return { error: t("improvementFailed"), proposal: null };

  try {
    const startedAt = Date.now();
    const client = new Anthropic();
    const response = await client.messages.create({
      model: FEEDBACK_MODEL,
      max_tokens: 3800,
      output_config: { format: { type: "json_schema", schema: FEEDBACK_IMPROVEMENT_SCHEMA } },
      system: improvementPrompt(context.project.locale, recommendation.target),
      messages: [{
        role: "user",
        content: JSON.stringify({
          recommendation,
          analysisSummary: analysis?.summary,
          currentOutput: context.stage3.output,
          projectLocale: context.project.locale,
        }),
      }],
    });
    logUsage("feedback_improvement_proposal", projectId, context.responseCount, startedAt, response);
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("missing_text");
    const parsed = JSON.parse(textBlock.text) as Record<string, unknown>;
    const output = sanitizeTargetedFeedbackOutput(
      context.stage3.output,
      parsed.output,
      recommendation.target,
    );
    const title = plain(parsed.title, 120);
    const current = plain(parsed.current, 500);
    const proposed = plain(parsed.proposed, 500);
    if (!output || !title || !current || !proposed) throw new Error("invalid_proposal");
    return {
      error: null,
      proposal: {
        recommendationId,
        title,
        current,
        proposed,
        target: recommendation.target,
        output,
      },
    };
  } catch (error) {
    console.error("[ventrio-ai-error]", JSON.stringify({
      operation: "feedback_improvement_proposal",
      projectId,
      message: error instanceof Error ? error.message : "unknown",
    }));
    return { error: t("improvementFailed"), proposal: null };
  }
}

export async function applyFeedbackImprovementAction(
  projectId: string,
  recommendationId: string,
  proposedOutput: unknown,
): Promise<ApplyResult> {
  const t = await getTranslations("feedback");
  if (!UUID_PATTERN.test(projectId) || !RECOMMENDATION_ID_PATTERN.test(recommendationId)) {
    return { error: t("errorInvalid"), output: null, message: null };
  }
  const context = await ownedFeedbackContext(projectId);
  if (!context.user) return { error: t("errorSession"), output: null, message: null };
  if (!context.project || !context.stage3?.output) {
    return { error: t("errorUnauthorized"), output: null, message: null };
  }
  const feedbackState = feedbackStateFromRow(
    context.feedbackRow,
    context.responseIds,
    context.responseCount,
  );
  if (!feedbackState.isCurrent) {
    return { error: t("errorRecommendation"), output: null, message: null };
  }
  const analysis = sanitizeFeedbackAnalysis(
    context.feedbackRow?.analysis,
    context.feedbackRow?.analyzed_response_count ?? context.responseCount,
  );
  const recommendation = analysis?.recommendedChanges.find((entry) => entry.id === recommendationId);
  if (!recommendation) return { error: t("errorRecommendation"), output: null, message: null };
  const candidate = sanitizeStage3Output(proposedOutput, context.stage3.output.preset);
  if (!candidate) return { error: t("applyFailed"), output: null, message: null };

  const output = targetedFeedbackOutput(context.stage3.output, candidate, recommendation.target);
  const nextState: Stage3ProjectState = {
    ...context.stage3,
    status: "first_version_ready",
    lastRequestId: `feedback:${recommendation.id}`,
    output,
  };
  const snapshot = mergeStage3ProjectState(context.project.snapshot_fields, nextState);
  snapshot.solution = output.identity.description;
  snapshot.audience = output.targetUser;
  snapshot.first_version = output.primaryValue;

  const { error } = await context.supabase
    .from("projects")
    .update({
      name: output.identity.name,
      target_audience: output.targetUser,
      snapshot_fields: snapshot,
    })
    .eq("id", projectId)
    .eq("user_id", context.user.id);
  if (error) return { error: t("applyFailed"), output: null, message: null };

  const message = t("changeRecorded", { title: recommendation.title });
  await context.supabase.from("project_ai_messages").insert({
    id: stableUuid(`${context.stage3.conversationId}:feedback:${recommendation.id}:${createHash("sha256").update(JSON.stringify(output)).digest("hex")}`),
    conversation_id: context.stage3.conversationId,
    project_id: projectId,
    user_id: context.user.id,
    role: "assistant",
    content: message,
  });
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  return { error: null, output, message };
}

export async function deleteProjectResponseAction(
  projectId: string,
  responseId: string,
): Promise<DeleteResult> {
  const t = await getTranslations("feedback");
  if (!UUID_PATTERN.test(projectId) || !UUID_PATTERN.test(responseId)) {
    return { error: t("errorInvalid"), deletedId: null, responseCount: null, feedback: null };
  }
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) return { error: t("errorSession"), deletedId: null, responseCount: null, feedback: null };
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!project) return { error: t("errorUnauthorized"), deletedId: null, responseCount: null, feedback: null };

  const { data: deleted, error } = await supabase
    .from("project_responses")
    .delete()
    .eq("id", responseId)
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error || !deleted) return { error: t("deleteFailed"), deletedId: null, responseCount: null, feedback: null };

  const [{ count }, responseIds] = await Promise.all([
    supabase
      .from("project_responses")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("user_id", user.id),
    loadResponseIds(supabase, projectId, user.id),
  ]);
  const responseCount = count ?? 0;
  const feedback = await loadFeedbackAnalysisState(
    supabase,
    projectId,
    user.id,
    responseIds,
    responseCount,
  );
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  return { error: null, deletedId: deleted.id, responseCount, feedback };
}
