import type { Stage3ProjectOutput } from "@/lib/build/stage3Types";

export const FEEDBACK_TARGETS = [
  "positioning",
  "audience",
  "copy",
  "cta",
  "form",
  "offer",
  "content",
  "structure",
] as const;
export type FeedbackTarget = (typeof FEEDBACK_TARGETS)[number];

export const FEEDBACK_PRIORITIES = ["high", "medium", "low"] as const;
export type FeedbackPriority = (typeof FEEDBACK_PRIORITIES)[number];

export const FEEDBACK_CONFIDENCES = ["early", "moderate", "strong"] as const;
export type FeedbackConfidence = (typeof FEEDBACK_CONFIDENCES)[number];

export interface FeedbackSignal {
  title: string;
  evidence: string;
  responseCount: number;
  confidence: FeedbackConfidence;
  implication: string;
}

export interface FeedbackRecommendation {
  id: string;
  title: string;
  reason: string;
  target: FeedbackTarget;
  priority: FeedbackPriority;
}

export interface FeedbackAnalysis {
  summary: string;
  signals: FeedbackSignal[];
  uncertainties: string[];
  recommendedChanges: FeedbackRecommendation[];
}

export interface FeedbackAnalysisState {
  analysis: FeedbackAnalysis | null;
  analyzedResponseCount: number | null;
  analyzedAt: string | null;
  isCurrent: boolean;
  feedbackChanged: boolean;
  newResponseCount: number;
  analyzing: boolean;
}

export interface FeedbackImprovementProposal {
  recommendationId: string;
  title: string;
  current: string;
  proposed: string;
  target: FeedbackTarget;
  output: Stage3ProjectOutput;
}

export function targetedFeedbackOutput(
  current: Stage3ProjectOutput,
  candidate: Stage3ProjectOutput,
  target: FeedbackTarget,
): Stage3ProjectOutput {
  switch (target) {
    case "cta":
      return {
        ...current,
        hero: { ...current.hero, subheadline: candidate.hero.subheadline },
        cta: candidate.cta,
        form: {
          ...current.form,
          title: candidate.form.title,
          description: candidate.form.description,
          submitLabel: candidate.form.submitLabel,
        },
      };
    case "form":
      return { ...current, form: candidate.form, cta: candidate.cta };
    case "audience":
      return {
        ...current,
        identity: candidate.identity,
        targetUser: candidate.targetUser,
        hero: candidate.hero,
        sections: current.sections.map((section) =>
          section.type === "audience"
            ? candidate.sections.find((entry) => entry.type === "audience") ?? section
            : section
        ),
        launchCopy: candidate.launchCopy,
      };
    case "offer":
      return {
        ...current,
        primaryValue: candidate.primaryValue,
        hero: { ...current.hero, subheadline: candidate.hero.subheadline },
        sections: current.sections.map((section) =>
          section.type === "offer"
            ? candidate.sections.find((entry) => entry.type === "offer") ?? section
            : section
        ),
        cta: candidate.cta,
      };
    case "content":
      return {
        ...current,
        sections: current.sections.map((section) =>
          section.type === "content"
            ? candidate.sections.find((entry) => entry.type === "content") ?? section
            : section
        ),
        launchCopy: candidate.launchCopy,
      };
    case "structure":
      return { ...current, sections: candidate.sections };
    case "positioning":
      return {
        ...current,
        identity: candidate.identity,
        targetUser: candidate.targetUser,
        primaryValue: candidate.primaryValue,
        hero: candidate.hero,
        launchCopy: candidate.launchCopy,
      };
    case "copy":
      return {
        ...candidate,
        preset: current.preset,
        visual: current.visual,
        form: { ...candidate.form, fields: current.form.fields },
      };
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function plain(value: unknown, max: number): string {
  return typeof value === "string"
    ? value.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max)
    : "";
}

export function sanitizeFeedbackAnalysis(value: unknown, totalResponses: number): FeedbackAnalysis | null {
  const raw = record(value);
  if (!raw) return null;
  const summary = plain(raw.summary, 600);
  if (!summary) return null;

  const signals: FeedbackSignal[] = [];
  for (const entry of (Array.isArray(raw.signals) ? raw.signals : []).slice(0, 3)) {
    const signal = record(entry);
    if (!signal) continue;
    const title = plain(signal.title, 100);
    const evidence = plain(signal.evidence, 320);
    const implication = plain(signal.implication, 320);
    const rawCount = typeof signal.responseCount === "number" ? Math.floor(signal.responseCount) : 0;
    const responseCount = Math.max(1, Math.min(totalResponses, rawCount));
    if (!title || !evidence || !implication || totalResponses < 1) continue;

    let confidence: FeedbackConfidence = "early";
    if (
      totalResponses >= 8
      && responseCount >= Math.max(4, Math.ceil(totalResponses * 0.5))
      && signal.confidence === "strong"
    ) {
      confidence = "strong";
    } else if (
      totalResponses >= 3
      && responseCount >= 2
      && (signal.confidence === "moderate" || signal.confidence === "strong")
    ) {
      confidence = "moderate";
    }
    signals.push({ title, evidence, responseCount, confidence, implication });
  }

  const uncertainties = (Array.isArray(raw.uncertainties) ? raw.uncertainties : [])
    .map((entry) => plain(entry, 320))
    .filter(Boolean)
    .slice(0, 1);

  const recommendedChanges: FeedbackRecommendation[] = [];
  const seenIds = new Set<string>();
  for (const entry of (Array.isArray(raw.recommendedChanges) ? raw.recommendedChanges : []).slice(0, 3)) {
    const recommendation = record(entry);
    if (!recommendation) continue;
    const id = plain(recommendation.id, 48)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/-+/g, "-");
    const title = plain(recommendation.title, 120);
    const reason = plain(recommendation.reason, 360);
    if (
      !id || seenIds.has(id) || !title || !reason
      || typeof recommendation.target !== "string"
      || !(FEEDBACK_TARGETS as readonly string[]).includes(recommendation.target)
      || typeof recommendation.priority !== "string"
      || !(FEEDBACK_PRIORITIES as readonly string[]).includes(recommendation.priority)
    ) continue;
    seenIds.add(id);
    recommendedChanges.push({
      id,
      title,
      reason,
      target: recommendation.target as FeedbackTarget,
      priority: recommendation.priority as FeedbackPriority,
    });
  }

  if (signals.length === 0 && uncertainties.length === 0) return null;
  return { summary, signals, uncertainties, recommendedChanges };
}
