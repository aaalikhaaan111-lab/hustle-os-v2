"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
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

function ChoiceChip({
  selected,
  onClick,
  disabled,
  emoji,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  disabled: boolean;
  emoji?: string;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-2xl border px-3.5 py-3 text-left text-sm font-semibold transition-all duration-300 ease-out hover:scale-[1.02] active:scale-[0.97] disabled:opacity-60 disabled:hover:scale-100",
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
      {label}
    </button>
  );
}

export function ProjectCreateForm({ initialMode }: ProjectCreateFormProps) {
  const t = useTranslations("build");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [projectType, setProjectType] = useState<ProjectType | null>(null);
  const [niche, setNiche] = useState<string | null>(null);
  const [startingStage, setStartingStage] = useState<StartingStage | null>(null);
  const [targetAudience, setTargetAudience] = useState("");
  const [intendedOutcome, setIntendedOutcome] = useState<IntendedOutcome | null>(null);
  const [timeAvailability, setTimeAvailability] = useState<TimeAvailability | null>(null);
  const [pathwayMode, setPathwayMode] = useState<PathwayMode>(initialMode);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    if (!projectType || !niche || !startingStage || !intendedOutcome || !timeAvailability) {
      setError(t("errorSelectRequired"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createProjectAction({
        name: name.trim() || null,
        projectType,
        niche,
        startingStage,
        targetAudience: targetAudience.trim() || null,
        intendedOutcome,
        timeAvailability,
        pathwayMode,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/build/workspace");
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-9 pb-16">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={() => setPathwayMode("standard")}
          className={cn(
            "rounded-2xl border px-4 py-4 text-center text-sm font-bold transition-all duration-300 ease-out disabled:opacity-60",
            pathwayMode === "standard"
              ? "border-accent bg-accent-soft text-accent shadow-[0_8px_20px_rgba(99,102,241,0.15)]"
              : "border-zinc-100/60 bg-white/70 text-ink-secondary shadow-sm backdrop-blur-md"
          )}
        >
          {t("modeStandard")}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => setPathwayMode("quick_sprint")}
          className={cn(
            "rounded-2xl border px-4 py-4 text-center text-sm font-bold transition-all duration-300 ease-out disabled:opacity-60",
            pathwayMode === "quick_sprint"
              ? "border-accent bg-accent-soft text-accent shadow-[0_8px_20px_rgba(99,102,241,0.15)]"
              : "border-zinc-100/60 bg-white/70 text-ink-secondary shadow-sm backdrop-blur-md"
          )}
        >
          {t("modeQuickSprint")}
        </button>
      </div>
      <p className="-mt-6 text-xs tracking-tight text-ink-muted">
        {pathwayMode === "quick_sprint" ? t("modeQuickSprintHint") : t("modeStandardHint")}
      </p>

      <Field label={t("nameLabel")} htmlFor="project-name" hint={t("nameHint")}>
        <Input
          id="project-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={isPending}
          maxLength={80}
          placeholder={t("namePlaceholder")}
        />
      </Field>

      <div className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-ink">{t("projectTypeQuestion")}</h2>
        <div className="grid grid-cols-2 gap-3">
          {PROJECT_TYPE_OPTIONS.map((option) => (
            <ChoiceChip
              key={option.id}
              selected={projectType === option.id}
              onClick={() => setProjectType(option.id)}
              disabled={isPending}
              emoji={option.emoji}
              label={t(option.labelKey)}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-ink">{t("nicheQuestion")}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {NICHE_OPTIONS.map((option) => (
            <ChoiceChip
              key={option.id}
              selected={niche === option.id}
              onClick={() => setNiche(option.id)}
              disabled={isPending}
              emoji={option.emoji}
              label={t(option.labelKey)}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-ink">{t("startingStageQuestion")}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {STARTING_STAGE_OPTIONS.map((option) => (
            <ChoiceChip
              key={option.id}
              selected={startingStage === option.id}
              onClick={() => setStartingStage(option.id)}
              disabled={isPending}
              label={t(option.labelKey)}
            />
          ))}
        </div>
      </div>

      <Field label={t("audienceLabel")} htmlFor="project-audience" hint={t("audienceHint")}>
        <Input
          id="project-audience"
          value={targetAudience}
          onChange={(event) => setTargetAudience(event.target.value)}
          disabled={isPending}
          maxLength={200}
          placeholder={t("audiencePlaceholder")}
        />
      </Field>

      <div className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-ink">{t("outcomeQuestion")}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {INTENDED_OUTCOME_OPTIONS.map((option) => (
            <ChoiceChip
              key={option.id}
              selected={intendedOutcome === option.id}
              onClick={() => setIntendedOutcome(option.id)}
              disabled={isPending}
              label={t(option.labelKey)}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-ink">{t("timeQuestion")}</h2>
        <div className="grid grid-cols-2 gap-3">
          {TIME_AVAILABILITY_OPTIONS.map((option) => (
            <ChoiceChip
              key={option.id}
              selected={timeAvailability === option.id}
              onClick={() => setTimeAvailability(option.id)}
              disabled={isPending}
              label={t(option.labelKey)}
            />
          ))}
        </div>
      </div>

      {error && <p className="text-center text-sm text-danger">{error}</p>}

      <Button onClick={handleSubmit} disabled={isPending} size="lg">
        {isPending ? t("creating") : t("createProject")}
      </Button>
    </div>
  );
}
