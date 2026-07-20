"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { generateSummaryAction, updatePitchAction } from "@/lib/actions/build";
import type { ProjectPitch, ProjectSummary } from "@/lib/build/types";

interface PitchClientProps {
  projectId: string;
  hasCompletedTasks: boolean;
  initialSummary: ProjectSummary | null;
  initialPitch: ProjectPitch | null;
}

function TextAreaField({
  label,
  value,
  onChange,
  disabled,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  rows?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        rows={rows}
        className="w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
      />
    </div>
  );
}

export function PitchClient({ projectId, hasCompletedTasks, initialSummary, initialPitch }: PitchClientProps) {
  const t = useTranslations("build");
  const [summary, setSummary] = useState(initialSummary);
  const [pitch, setPitch] = useState(initialPitch);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isGenerating, startGenerating] = useTransition();
  const [isSaving, startSaving] = useTransition();

  function handleGenerate() {
    setError(null);
    setSaved(false);
    startGenerating(async () => {
      const result = await generateSummaryAction(projectId);
      if (result.error || !result.summary || !result.pitch) {
        setError(result.error ?? t("errorGenerateFailed"));
        return;
      }
      setSummary(result.summary);
      setPitch(result.pitch);
    });
  }

  function updatePitchField<K extends keyof ProjectPitch>(key: K, value: ProjectPitch[K]) {
    setPitch((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function handleSave() {
    if (!pitch) return;
    setError(null);
    startSaving(async () => {
      const result = await updatePitchAction(projectId, pitch);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  if (!summary || !pitch) {
    return (
      <Card>
        <CardContent className="py-8">
          <EmptyState
            icon={<span className="text-2xl">🎤</span>}
            title={t("pitchEmptyTitle")}
            description={hasCompletedTasks ? t("pitchEmptyDescription") : t("pitchEmptyNoTasks")}
            action={
              <Button onClick={handleGenerate} disabled={!hasCompletedTasks || isGenerating} size="lg">
                {isGenerating ? t("generating") : t("generatePitch")}
              </Button>
            }
          />
          {error && <p className="mt-4 text-center text-sm text-danger">{error}</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-3 py-8">
          <h2 className="text-base font-bold text-ink">{t("projectSummaryTitle")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">{t("problemLabel")}</span>
              <p className="text-sm text-ink-secondary">{summary.problem}</p>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">{t("audienceSummaryLabel")}</span>
              <p className="text-sm text-ink-secondary">{summary.audience}</p>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">{t("solutionLabel")}</span>
              <p className="text-sm text-ink-secondary">{summary.solution}</p>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">{t("evidenceLabel")}</span>
              <p className="text-sm text-ink-secondary">{summary.evidence}</p>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">{t("firstVersionLabel")}</span>
              <p className="text-sm text-ink-secondary">{summary.firstVersion}</p>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">{t("mainRiskLabel")}</span>
              <p className="text-sm text-ink-secondary">{summary.mainRisk}</p>
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="mt-2 w-fit"
          >
            {isGenerating ? t("generating") : t("regeneratePitch")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 py-8">
          <h2 className="text-base font-bold text-ink">{t("editPitchTitle")}</h2>

          <Field label={t("pitch30Label")} htmlFor="pitch-30">
            <textarea
              id="pitch-30"
              value={pitch.pitch30}
              onChange={(event) => updatePitchField("pitch30", event.target.value)}
              disabled={isSaving}
              rows={2}
              className="w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </Field>

          <TextAreaField
            label={t("pitch60Label")}
            value={pitch.pitch60}
            onChange={(value) => updatePitchField("pitch60", value)}
            disabled={isSaving}
            rows={4}
          />
          <TextAreaField
            label={t("problemLabel")}
            value={pitch.problem}
            onChange={(value) => updatePitchField("problem", value)}
            disabled={isSaving}
          />
          <TextAreaField
            label={t("audienceSummaryLabel")}
            value={pitch.audience}
            onChange={(value) => updatePitchField("audience", value)}
            disabled={isSaving}
          />
          <TextAreaField
            label={t("solutionLabel")}
            value={pitch.solution}
            onChange={(value) => updatePitchField("solution", value)}
            disabled={isSaving}
          />
          <TextAreaField
            label={t("evidenceLabel")}
            value={pitch.evidence}
            onChange={(value) => updatePitchField("evidence", value)}
            disabled={isSaving}
          />
          <TextAreaField
            label={t("progressLabel")}
            value={pitch.progress}
            onChange={(value) => updatePitchField("progress", value)}
            disabled={isSaving}
          />
          <TextAreaField
            label={t("nextStepLabel")}
            value={pitch.nextStep}
            onChange={(value) => updatePitchField("nextStep", value)}
            disabled={isSaving}
          />
          <TextAreaField
            label={t("qaPrepLabel")}
            value={pitch.qaPrep.join("\n")}
            onChange={(value) =>
              updatePitchField(
                "qaPrep",
                value.split("\n").filter((line) => line.trim().length > 0)
              )
            }
            disabled={isSaving}
            rows={5}
          />

          {error && <p className="text-sm text-danger">{error}</p>}
          {saved && <p className="text-sm font-semibold text-success">{t("pitchSavedNotice")}</p>}

          <Button onClick={handleSave} disabled={isSaving} size="lg" className="w-fit">
            {isSaving ? t("saving") : t("savePitch")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
