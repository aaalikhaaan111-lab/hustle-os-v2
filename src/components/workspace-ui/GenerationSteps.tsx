"use client";

import { IconCheck } from "./parts";

export interface GenerationStep {
  label: string;
  /**
   * `done` is only ever set from something the project already holds — a saved
   * audience, a saved concept, a chosen direction. `active` is the request that
   * is genuinely in flight. Nothing here advances on a timer.
   */
  state: "done" | "active" | "waiting";
}

/**
 * What Ventrio is doing, while it does it.
 *
 * A spinner says "wait"; this says what has been worked out and what is being
 * made from it. The completed rows are facts the project already contains, so
 * the list is a summary of real progress rather than a staged performance —
 * only the active row is animated, and only because something really is
 * running.
 */
export function GenerationSteps({ title, steps }: { title: string; steps: GenerationStep[] }) {
  return (
    <div
      className="ai-sheen rise rounded-[var(--r-lg)] border p-5"
      style={{ borderColor: "var(--line-accent)", background: "var(--accent-soft)" }}
      role="status"
      aria-live="polite"
    >
      <p className="text-[14px] font-semibold tracking-[-0.01em]">{title}</p>

      <ul className="relative mt-4 flex flex-col gap-3">
        {steps.map((step, index) => (
          <li key={step.label} className="flex items-center gap-3">
            <span className="relative grid h-[18px] w-[18px] shrink-0 place-items-center">
              {step.state === "done" && (
                <span
                  className="grid h-[18px] w-[18px] place-items-center rounded-full"
                  style={{ background: "var(--accent)", color: "#fff" }}
                >
                  <IconCheck className="h-3 w-3" />
                </span>
              )}
              {step.state === "active" && (
                <>
                  <span
                    className="ai-pending absolute h-[18px] w-[18px] rounded-full"
                    style={{ background: "rgb(107 100 242 / 0.22)" }}
                  />
                  <span className="h-2 w-2 rounded-full" style={{ background: "var(--accent)" }} />
                </>
              )}
              {step.state === "waiting" && (
                <span
                  className="h-[14px] w-[14px] rounded-full border"
                  style={{ borderColor: "var(--line-2)" }}
                />
              )}
            </span>

            <span
              className="text-[14px] leading-snug"
              style={{
                color: step.state === "waiting" ? "var(--ink-3)" : "var(--ink)",
                fontWeight: step.state === "active" ? 600 : 400,
              }}
            >
              {step.label}
            </span>

            {/* The connecting thread, drawn only between rows. */}
            {index < steps.length - 1 && (
              <span
                aria-hidden
                className="absolute left-[8px] w-px"
                style={{
                  top: `${index * 34 + 22}px`,
                  height: "14px",
                  background: step.state === "done" ? "var(--accent-pale)" : "var(--line-2)",
                }}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
