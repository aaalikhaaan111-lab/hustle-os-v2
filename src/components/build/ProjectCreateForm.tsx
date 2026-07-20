"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { createProjectAction } from "@/lib/actions/build";
import {
  INTENDED_OUTCOME_OPTIONS,
  NICHE_OPTIONS,
  PROJECT_TYPE_OPTIONS,
  STARTING_STAGE_OPTIONS,
  TIME_AVAILABILITY_OPTIONS,
} from "@/lib/build/options";
import type {
  IntendedOutcome,
  PathwayMode,
  ProjectType,
  StartingStage,
  TimeAvailability,
} from "@/lib/build/types";

interface ProjectCreateFormProps {
  initialMode: PathwayMode;
}

// One focused question per step, then a review screen. Order matches the
// product spec: type -> niche -> starting point -> audience -> outcome ->
// time -> review. The pathway mode (Full project vs Quick sprint) is chosen
// on the Build landing and shown here as a switchable header chip, so the
// steps themselves stay focused on the six questions.
type StepId = "type" | "niche" | "start" | "audience" | "outcome" | "time" | "review";
const STEP_ORDER: StepId[] = ["type", "niche", "start", "audience", "outcome", "time", "review"];
const QUESTION_STEPS = STEP_ORDER.length - 1; // everything except the review

function ChoiceCard({
  selected,
  onClick,
  disabled,
  emoji,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  emoji?: string;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 rounded-2xl border px-4 py-3.5 text-left text-sm font-semibold transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:hover:scale-100",
        selected
          ? "border-accent bg-accent-soft text-accent shadow-[0_8px_20px_rgba(99,102,241,0.15)]"
          : "border-zinc-100/60 bg-white/70 text-ink-secondary shadow-sm backdrop-blur-md hover:border-zinc-200 hover:text-ink"
      )}
    >
      {emoji && (
        <span className="text-lg" role="img" aria-hidden>
          {emoji}
        </span>
      )}
      <span>{label}</span>
    </button>
  );
}

export function ProjectCreateForm({ initialMode }: ProjectCreateFormProps) {
  const t = useTranslations("build");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [stepIndex, setStepIndex] = useState(0);
  const [mode, setMode] = useState<PathwayMode>(initialMode);
  const [name, setName] = useState("");
  const [projectType, setProjectType] = useState<ProjectType | null>(null);
  const [niche, setNiche] = useState<string | null>(null);
  const [startingStage, setStartingStage] = useState<StartingStage | null>(null);
  const [audience, setAudience] = useState("");
  const [outcome, setOutcome] = useState<IntendedOutcome | null>(null);
  const [time, setTime] = useState<TimeAvailability | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const step = STEP_ORDER[stepIndex];

  function isStepComplete(s: StepId): boolean {
    switch (s) {
      case "type":
        return !!projectType;
      case "niche":
        return !!niche;
      case "start":
        return !!startingStage;
      case "audience":
        return true; // optional — "not sure yet" is a valid answer
      case "outcome":
        return !!outcome;
      case "time":
        return !!time;
      default:
        return true;
    }
  }

  function firstIncompleteStep(): StepId | null {
    for (const s of STEP_ORDER) {
      if (!isStepComplete(s)) return s;
    }
    return null;
  }

  function goNext() {
    if (!isStepComplete(step)) {
      setStepError(t("chooseToContinue"));
      return;
    }
    setStepError(null);
    setStepIndex((i) => Math.min(i + 1, STEP_ORDER.length - 1));
  }

  function goBack() {
    setStepError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  function jumpTo(target: StepId) {
    setStepError(null);
    setSubmitError(null);
    setStepIndex(STEP_ORDER.indexOf(target));
  }

  function handleCreate() {
    // Validation identifies the exact incomplete step and navigates back to it.
    const incomplete = firstIncompleteStep();
    if (incomplete) {
      setStepError(t("chooseToContinue"));
      setStepIndex(STEP_ORDER.indexOf(incomplete));
      return;
    }
    if (isPending) return; // guard against double submit
    setSubmitError(null);
    startTransition(async () => {
      const result = await createProjectAction({
        name: name.trim() || null,
        projectType: projectType!,
        niche: niche!,
        startingStage: startingStage!,
        targetAudience: audience.trim() || null,
        intendedOutcome: outcome!,
        timeAvailability: time!,
        pathwayMode: mode,
      });
      if (result.error) {
        // Answers stay in state — the user retries without re-entering anything.
        setSubmitError(result.error);
        return;
      }
      router.push("/build/workspace");
    });
  }

  const typeLabel = () => {
    const o = PROJECT_TYPE_OPTIONS.find((x) => x.id === projectType);
    return o ? t(o.labelKey) : "—";
  };
  const nicheLabel = () => {
    const o = NICHE_OPTIONS.find((x) => x.id === niche);
    return o ? t(o.labelKey) : "—";
  };
  const startLabel = () => {
    const o = STARTING_STAGE_OPTIONS.find((x) => x.id === startingStage);
    return o ? t(o.labelKey) : "—";
  };
  const outcomeLabel = () => {
    const o = INTENDED_OUTCOME_OPTIONS.find((x) => x.id === outcome);
    return o ? t(o.labelKey) : "—";
  };
  const timeLabel = () => {
    const o = TIME_AVAILABILITY_OPTIONS.find((x) => x.id === time);
    return o ? t(o.labelKey) : "—";
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 pb-24">
      {/* Mode chip (clearly separates Full project vs Quick sprint) + progress */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold",
              mode === "quick_sprint"
                ? "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100"
                : "bg-accent-soft text-accent ring-1 ring-inset ring-indigo-100"
            )}
          >
            {mode === "quick_sprint" ? `⚡ ${t("modeQuickSprint")}` : `🧭 ${t("modeStandard")}`}
          </span>
          {mode === "quick_sprint" && (
            <span className="text-xs text-ink-muted">{t("quickSprintTime")}</span>
          )}
          <button
            type="button"
            disabled={isPending}
            onClick={() => setMode(mode === "quick_sprint" ? "standard" : "quick_sprint")}
            className="ml-auto text-xs font-semibold text-accent underline-offset-2 hover:underline disabled:opacity-60"
          >
            {mode === "quick_sprint" ? t("modeSwitchFull") : t("modeSwitchQuick")}
          </button>
        </div>

        {step !== "review" && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-muted">
              {t("stepLabel", { current: stepIndex + 1, total: QUESTION_STEPS })}
            </span>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-900/[0.05]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 transition-all duration-300 ease-out"
                style={{ width: `${((stepIndex + 1) / QUESTION_STEPS) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ─── Question steps ─── */}
      {step === "type" && (
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-black tracking-[-0.02em] text-ink">{t("projectTypeQuestion")}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {PROJECT_TYPE_OPTIONS.map((option) => (
              <ChoiceCard
                key={option.id}
                selected={projectType === option.id}
                disabled={isPending}
                emoji={option.emoji}
                label={t(option.labelKey)}
                onClick={() => {
                  setProjectType(option.id);
                  setStepError(null);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {step === "niche" && (
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-black tracking-[-0.02em] text-ink">{t("nicheQuestion")}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {NICHE_OPTIONS.map((option) => (
              <ChoiceCard
                key={option.id}
                selected={niche === option.id}
                disabled={isPending}
                emoji={option.emoji}
                label={t(option.labelKey)}
                onClick={() => {
                  setNiche(option.id);
                  setStepError(null);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {step === "start" && (
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-black tracking-[-0.02em] text-ink">
            {t("startingStageQuestion")}
          </h2>
          <div className="flex flex-col gap-3">
            {STARTING_STAGE_OPTIONS.map((option) => (
              <ChoiceCard
                key={option.id}
                selected={startingStage === option.id}
                disabled={isPending}
                label={t(option.labelKey)}
                onClick={() => {
                  setStartingStage(option.id);
                  setStepError(null);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {step === "audience" && (
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-black tracking-[-0.02em] text-ink">{t("audienceLabel")}</h2>
          <p className="-mt-2 text-sm tracking-tight text-ink-secondary">{t("audienceHint")}</p>
          <input
            type="text"
            value={audience}
            disabled={isPending}
            maxLength={200}
            placeholder={t("audiencePlaceholder")}
            onChange={(event) => setAudience(event.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-muted transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>
      )}

      {step === "outcome" && (
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-black tracking-[-0.02em] text-ink">{t("outcomeQuestion")}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {INTENDED_OUTCOME_OPTIONS.map((option) => (
              <ChoiceCard
                key={option.id}
                selected={outcome === option.id}
                disabled={isPending}
                label={t(option.labelKey)}
                onClick={() => {
                  setOutcome(option.id);
                  setStepError(null);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {step === "time" && (
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-black tracking-[-0.02em] text-ink">{t("timeQuestion")}</h2>
          <div className="grid grid-cols-2 gap-3">
            {TIME_AVAILABILITY_OPTIONS.map((option) => (
              <ChoiceCard
                key={option.id}
                selected={time === option.id}
                disabled={isPending}
                label={t(option.labelKey)}
                onClick={() => {
                  setTime(option.id);
                  setStepError(null);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ─── Review ─── */}
      {step === "review" && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-black tracking-[-0.02em] text-ink">{t("reviewTitle")}</h2>
            <p className="text-sm tracking-tight text-ink-secondary">{t("reviewSubtitle")}</p>
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border border-t-white/70 border-x-zinc-200/40 border-b-zinc-200/40 bg-white/70 p-2 shadow-sm backdrop-blur-md">
            <ReviewRow label={t("reviewTypeLabel")} value={typeLabel()} onEdit={() => jumpTo("type")} editLabel={t("reviewEdit")} />
            <ReviewRow label={t("reviewNicheLabel")} value={nicheLabel()} onEdit={() => jumpTo("niche")} editLabel={t("reviewEdit")} />
            <ReviewRow label={t("reviewStartLabel")} value={startLabel()} onEdit={() => jumpTo("start")} editLabel={t("reviewEdit")} />
            <ReviewRow
              label={t("reviewAudienceLabel")}
              value={audience.trim() || t("reviewAudienceEmpty")}
              onEdit={() => jumpTo("audience")}
              editLabel={t("reviewEdit")}
            />
            <ReviewRow label={t("reviewOutcomeLabel")} value={outcomeLabel()} onEdit={() => jumpTo("outcome")} editLabel={t("reviewEdit")} />
            <ReviewRow label={t("reviewTimeLabel")} value={timeLabel()} onEdit={() => jumpTo("time")} editLabel={t("reviewEdit")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="project-name" className="text-sm font-medium text-ink">
              {t("nameLabel")}
            </label>
            <input
              id="project-name"
              type="text"
              value={name}
              disabled={isPending}
              maxLength={80}
              placeholder={t("namePlaceholder")}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-muted transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            <p className="text-xs text-ink-muted">{t("nameHint")}</p>
          </div>

          {submitError && <p className="text-sm text-danger">{submitError}</p>}

          <Button onClick={handleCreate} disabled={isPending} size="lg">
            {isPending ? t("creating") : t("createProject")}
          </Button>
        </div>
      )}

      {stepError && step !== "review" && <p className="text-sm text-danger">{stepError}</p>}

      {/* ─── Navigation controls ─── */}
      {step !== "review" && (
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="md"
            disabled={isPending || stepIndex === 0}
            onClick={goBack}
          >
            {t("backBtn")}
          </Button>
          <Button type="button" size="md" disabled={isPending} onClick={goNext}>
            {t("continueBtn")}
          </Button>
        </div>
      )}

      {step === "review" && (
        <Button type="button" variant="ghost" size="md" disabled={isPending} onClick={goBack} className="w-fit">
          {t("backBtn")}
        </Button>
      )}
    </div>
  );
}

function ReviewRow({
  label,
  value,
  onEdit,
  editLabel,
}: {
  label: string;
  value: string;
  onEdit: () => void;
  editLabel: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/70">
      <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted">{label}</span>
        <span className="truncate text-sm font-semibold text-ink">{value}</span>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 text-xs font-semibold text-accent underline-offset-2 hover:underline"
      >
        {editLabel}
      </button>
    </div>
  );
}
