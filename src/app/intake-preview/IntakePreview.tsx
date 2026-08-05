"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { StructuredChoice } from "@/components/build/StructuredChoice";
import { planIntake, type DesignPreviewId, type IntakeAnswers } from "@/lib/build/intake";
import "@/components/workspace-ui/tokens.css";

/**
 * Drives the real components through the real plan, with the generation call
 * replaced by a log line. Everything below the panel is a static stand-in for
 * the workspace so the panel is seen at its true size in context — the whole
 * design claim is that it stays smaller than the composer, and that is only
 * checkable next to one.
 */

const IDEAS = [
  { key: "ambiguous", idea: "i like marvel cinematic universe" },
  { key: "clear", idea: "a landing page for my coffee shop" },
  { key: "ru", idea: "мне нравится вселенная марвел" },
];

export function IntakePreview() {
  const tb = useTranslations("build");
  const params = useSearchParams();

  // Each state is addressable by URL so a capture harness can load it directly
  // instead of driving the UI through a cross-origin frame it cannot click.
  const initialIndex = Math.max(0, IDEAS.findIndex((e) => e.key === params.get("idea")));
  const preAnswered: IntakeAnswers =
    params.get("step") === "design" ? { productType: "fandom.timeline" } : {};

  const [ideaIndex, setIdeaIndex] = useState(initialIndex);
  const [answers, setAnswers] = useState<IntakeAnswers>(preAnswered);
  const [dispatched, setDispatched] = useState<string | null>(null);

  const idea = IDEAS[ideaIndex].idea;
  // Width is applied to the column, which is what the panel actually responds
  // to now that it uses container queries.
  const width = Number(params.get("w")) || 0;
  const plan = planIntake(idea);
  const step = plan.steps.find((s) => !(s.id in answers)) ?? null;
  const stepIndex = step ? plan.steps.findIndex((s) => s.id === step.id) : -1;

  function choose(optionId: string | null) {
    if (!step || dispatched) return;
    const next = { ...answers, [step.id]: optionId };
    setAnswers(next);
    if (plan.steps.every((s) => s.id in next)) {
      setDispatched(JSON.stringify(next));
    }
  }

  function reset(index: number) {
    setIdeaIndex(index);
    setAnswers({});
    setDispatched(null);
  }

  return (
    <main
      className="wsRoot mx-auto flex min-h-screen flex-col px-4 py-6"
      style={{ background: "var(--bg)", width: width ? `${width}px` : "100%", maxWidth: width ? `${width}px` : 820 }}
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {IDEAS.map((entry, index) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => reset(index)}
            className="rounded-full border px-3 py-1 text-[12px]"
            style={{
              borderColor: index === ideaIndex ? "var(--accent)" : "var(--line)",
              background: index === ideaIndex ? "var(--accent-soft)" : "transparent",
              color: "var(--ink)",
            }}
          >
            {entry.key}
          </button>
        ))}
      </div>

      <p className="mb-1 text-[12px]" style={{ color: "var(--ink-3)" }}>
        idea: “{idea}” · domain: {plan.domain} · steps: {plan.steps.length}
      </p>

      {/* Stand-in for the conversation area above the composer. */}
      <div className="mb-3 flex-1 rounded-[14px] border p-4" style={{ borderColor: "var(--line)" }}>
        <p className="text-[19px] font-semibold leading-snug" style={{ color: "var(--ink)" }}>
          {idea}
        </p>
        {dispatched && (
          <p className="mt-3 text-[13px]" style={{ color: "var(--accent)" }} data-testid="intake-dispatched">
            → generation dispatched once with {dispatched}
          </p>
        )}
      </div>

      {step && (
        <StructuredChoice
          key={step.id}
          labelledById="intake-preview-title"
          title={tb(step.titleKey as never)}
          deferLabel={tb(step.deferKey as never)}
          progress={plan.steps.length > 1 ? `${stepIndex + 1} / ${plan.steps.length}` : undefined}
          options={step.options.map((option) => ({
            id: option.id,
            label: tb(option.labelKey as never),
            hint: option.hintKey ? tb(option.hintKey as never) : undefined,
            preview: "preview" in option ? (option as { preview: DesignPreviewId }).preview : undefined,
          }))}
          onChoose={choose}
        />
      )}

      {/* Stand-in for the composer, at its real height. */}
      <div
        className="flex items-center justify-between rounded-[14px] border px-4 py-3"
        style={{ borderColor: "var(--line)", background: "var(--surface)" }}
      >
        <span className="text-[14px]" style={{ color: "var(--ink-3)" }}>
          Describe what you want to change…
        </span>
        <span
          className="grid h-8 w-8 place-items-center rounded-full text-[13px]"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          ↑
        </span>
      </div>
    </main>
  );
}
