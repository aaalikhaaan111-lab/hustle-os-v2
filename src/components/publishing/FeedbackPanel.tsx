"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  analyzeProjectFeedbackAction,
  applyFeedbackImprovementAction,
  deleteProjectResponseAction,
  proposeFeedbackImprovementAction,
} from "@/lib/actions/feedback";
import type { Locale } from "@/i18n/locale";
import type { Stage3ProjectOutput } from "@/lib/build/stage3Types";
import type { ProjectPublicationState, ProjectResponseItem } from "@/lib/publishing/types";
import type { FeedbackAnalysisState, FeedbackImprovementProposal } from "@/lib/feedback/types";
import { cn } from "@/lib/utils";

interface FeedbackPanelProps {
  projectId: string;
  projectLocale: Locale;
  publication: ProjectPublicationState;
  onDraftChanged: (output: Stage3ProjectOutput) => void;
}

export function FeedbackPanel({ projectId, projectLocale, publication, onDraftChanged }: FeedbackPanelProps) {
  const t = useTranslations("feedback");
  const [responses, setResponses] = useState(publication.recentResponses);
  const [responseCount, setResponseCount] = useState(publication.responseCount);
  const [feedback, setFeedback] = useState<FeedbackAnalysisState>(publication.feedback);
  const [proposal, setProposal] = useState<FeedbackImprovementProposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isAnalyzing, startAnalysis] = useTransition();
  const [isProposing, startProposal] = useTransition();
  const [isApplying, startApply] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const fieldLabels = new Map(publication.output.form.fields.map((field) => [field.id, field.label]));
  const canAnalyze = responseCount > 0 && !feedback.isCurrent && !isAnalyzing && !feedback.analyzing;

  function analyze() {
    if (!canAnalyze) return;
    setError(null);
    setNotice(null);
    setProposal(null);
    startAnalysis(async () => {
      const result = await analyzeProjectFeedbackAction(projectId);
      if (result.error) return setError(result.error);
      if (result.feedback) setFeedback(result.feedback);
    });
  }

  function improve(recommendationId: string) {
    if (isProposing || isApplying) return;
    setError(null);
    setNotice(null);
    setProposal(null);
    startProposal(async () => {
      const result = await proposeFeedbackImprovementAction(projectId, recommendationId);
      if (result.error || !result.proposal) return setError(result.error ?? t("improvementFailed"));
      setProposal(result.proposal);
    });
  }

  function apply() {
    if (!proposal || isApplying) return;
    setError(null);
    setNotice(null);
    startApply(async () => {
      const result = await applyFeedbackImprovementAction(projectId, proposal.recommendationId, proposal.output);
      if (result.error || !result.output) return setError(result.error ?? t("applyFailed"));
      onDraftChanged(result.output);
      setProposal(null);
      setNotice(result.message ?? t("applied"));
    });
  }

  function remove(response: ProjectResponseItem) {
    if (isDeleting || !window.confirm(t("deleteConfirm"))) return;
    setError(null);
    setNotice(null);
    setDeletingId(response.id);
    startDelete(async () => {
      const result = await deleteProjectResponseAction(projectId, response.id);
      setDeletingId(null);
      if (result.error || !result.deletedId || result.responseCount === null || !result.feedback) {
        return setError(result.error ?? t("deleteFailed"));
      }
      setResponses((current) => current.filter((entry) => entry.id !== result.deletedId));
      setResponseCount(result.responseCount);
      setFeedback(result.feedback);
      setProposal(null);
      setNotice(t("deleted"));
    });
  }

  return (
    <section className="feedback-panel" aria-labelledby="feedback-heading">
      <div className="feedback-panel-header">
        <div><p className="feedback-eyebrow">{t("eyebrow")}</p><h2 id="feedback-heading">{t("title")}</h2></div>
        <strong>{t("responseCount", { count: responseCount })}</strong>
      </div>

      {responseCount === 0 ? (
        <div className="feedback-empty"><h3>{t("emptyTitle")}</h3><p>{t("emptyBody")}</p></div>
      ) : (
        <>
          {responseCount === 1 && !feedback.analysis && (
            <div className="feedback-first-response"><span aria-hidden /><div><strong>{t("firstResponseTitle")}</strong><p>{t("firstResponseBody")}</p></div></div>
          )}

          <div className="feedback-analysis-bar">
            <div>
              <strong>
                {feedback.isCurrent
                  ? t("current")
                  : feedback.analysis && feedback.newResponseCount > 0
                    ? t("newResponses", { count: feedback.newResponseCount })
                    : feedback.analysis && feedback.feedbackChanged
                      ? t("feedbackChanged")
                      : responseCount < 3 ? t("earlyAvailable") : t("newAvailable")}
              </strong>
              <p>{responseCount < 3 ? t("earlyEvidence") : feedback.isCurrent ? t("currentBody") : t("analysisReadyBody")}</p>
            </div>
            <button type="button" onClick={analyze} disabled={!canAnalyze} className="publication-primary">
              {isAnalyzing || feedback.analyzing ? t("analyzing") : feedback.analysis ? t("analyzeAgain") : t("analyze")}
            </button>
          </div>

          {feedback.analysis && (
            <div className="feedback-intelligence">
              <div className="feedback-intelligence-heading"><p className="feedback-eyebrow">{t("whatPeopleSay")}</p><p>{feedback.analysis.summary}</p></div>
              <div className="feedback-signal-list">
                {feedback.analysis.signals.map((signal, index) => (
                  <article key={`${signal.title}-${index}`} className="feedback-signal">
                    <div className="feedback-signal-title">
                      <h3>{signal.title}</h3>
                      <span className={`feedback-confidence is-${signal.confidence}`}>
                        {signal.confidence === "strong" ? t("confidenceStrong") : signal.confidence === "moderate" ? t("confidenceModerate") : t("confidenceEarly")}
                      </span>
                    </div>
                    <p className="feedback-signal-count">
                      {t("signalCount", {
                        count: signal.responseCount,
                        total: feedback.analyzedResponseCount ?? responseCount,
                      })}
                    </p>
                    <p className="feedback-evidence">{signal.evidence}</p>
                    <p>{signal.implication}</p>
                  </article>
                ))}
              </div>
              {feedback.analysis.uncertainties.map((uncertainty) => <p key={uncertainty} className="feedback-uncertainty"><span>{t("uncertainty")}</span>{uncertainty}</p>)}
              {feedback.analysis.recommendedChanges.length > 0 && (
                <div className="feedback-recommendations">
                  <h3>{t("recommendedChanges")}</h3>
                  {feedback.analysis.recommendedChanges.map((recommendation) => (
                    <article key={recommendation.id}>
                      <div><strong>{recommendation.title}</strong><p>{recommendation.reason}</p></div>
                      <button type="button" className="publication-secondary" disabled={!feedback.isCurrent || isProposing || isApplying} onClick={() => improve(recommendation.id)}>
                        {isProposing ? t("preparing") : t("improve")}
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {proposal && (
            <section className="feedback-proposal" aria-labelledby="feedback-proposal-heading">
              <p className="feedback-eyebrow">{t("proposedChange")}</p><h3 id="feedback-proposal-heading">{proposal.title}</h3>
              <div className="feedback-before-after">
                <div><span>{t("currentLabel")}</span><p>{proposal.current}</p></div>
                <div className="is-proposed"><span>{t("proposedLabel")}</span><p>{proposal.proposed}</p></div>
              </div>
              <p className="feedback-proposal-note">{t("draftOnlyNote")}</p>
              <div className="feedback-proposal-actions">
                <button type="button" className="publication-primary" disabled={isApplying} onClick={apply}>{isApplying ? t("applying") : t("apply")}</button>
                <button type="button" className="publication-secondary" disabled={isApplying} onClick={() => setProposal(null)}>{t("cancel")}</button>
              </div>
            </section>
          )}

          <details className="feedback-inbox" open={!feedback.analysis}>
            <summary><span>{t("latestResponses")}</span><span aria-hidden>+</span></summary>
            <div className="publication-response-list">
              {responses.map((response) => (
                <article key={response.id}>
                  <div className="feedback-response-meta">
                    <time dateTime={response.createdAt}>{new Intl.DateTimeFormat(projectLocale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(response.createdAt))}</time>
                    <button type="button" disabled={isDeleting} onClick={() => remove(response)}>{deletingId === response.id ? t("deleting") : t("delete")}</button>
                  </div>
                  {Object.entries(response.payload).map(([key, value]) => <p key={key}><span>{fieldLabels.get(key) ?? key}</span>{value || "—"}</p>)}
                </article>
              ))}
            </div>
          </details>
        </>
      )}

      {(error || notice) && <p role={error ? "alert" : "status"} className={cn("feedback-message", error && "is-error")}>{error ?? notice}</p>}
    </section>
  );
}
