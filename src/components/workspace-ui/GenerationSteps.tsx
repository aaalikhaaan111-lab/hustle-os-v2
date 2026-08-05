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
          // `items-start` rather than centred: it keeps every mark a fixed
          // distance from its row's top, which is what lets the thread below
          // connect exactly at any row height. It also reads better when a
          // label wraps, since the mark lines up with the label's first line
          // instead of floating beside its middle.
          <li key={step.label} className="relative flex items-start gap-3">
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

            {/*
              The connecting thread, drawn only between rows.

              Measured from the row rather than from a fixed pitch: it starts at
              the mark's bottom edge (18px down, since the row is `items-start`)
              and runs to the next row's top, where the next mark begins. The
              12px is the list's `gap-3`. Because both ends are pinned to row
              edges rather than to row centres, it stays connected whatever the
              rows are — including when a label wraps to two lines.

              It used to be placed at `index * 34 + 22`, which assumed every row
              was exactly 34px tall. Rows are ~31px, so the thread drifted 3px on
              the first gap and 9px by the third, overshooting past the mark it
              was meant to stop at. A wrapped label detached it completely.
            */}
            {index < steps.length - 1 && (
              <span
                aria-hidden
                className="absolute left-[8px] w-px"
                style={{
                  top: "18px",
                  height: "calc(100% - 6px)",
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
