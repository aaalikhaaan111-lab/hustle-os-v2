"use client";

import { useRef, useState } from "react";
import { DesignPreview } from "./DesignPreview";
import type { DesignPreviewId } from "@/lib/build/intake";

/**
 * A compact structured choice, shown directly above the composer.
 *
 * Generic by construction: it takes options and labels and knows nothing about
 * what is being chosen. The intake happens to use it twice; anything else that
 * needs "pick one of three, or skip" can use it without change.
 *
 * Sizing is the point of this component. The alternative already in the product
 * was full-width pills stacked down the workspace, which read as a page of
 * controls rather than as one question. Here the whole thing is a single
 * bordered strip roughly the height of the composer: a heading line, a row of
 * three cards, and a skip. It never becomes the tallest thing on screen.
 *
 * The caller gives this a `key` per question so a new step remounts it. That
 * is what re-homes the keyboard cursor: resetting an index in an effect would
 * render one frame pointing at an option from the previous question.
 *
 * KEYBOARD: the row is a radiogroup. Arrow keys move and select, Home/End jump
 * to the ends, Enter/Space confirm, Escape skips. Roving tabindex keeps the
 * group a single tab stop, so someone tabbing to the composer passes the whole
 * question in one press rather than three.
 */

export interface StructuredChoiceOption {
  id: string;
  label: string;
  hint?: string;
  /** Present only for visual-direction options. */
  preview?: DesignPreviewId;
}

interface StructuredChoiceProps {
  title: string;
  options: StructuredChoiceOption[];
  deferLabel: string;
  /** Number and total, e.g. "1 / 2" — omitted when there is only one step. */
  progress?: string;
  disabled?: boolean;
  /** `null` means the user deferred this step. */
  onChoose: (optionId: string | null) => void;
  labelledById?: string;
}

export function StructuredChoice({
  title,
  options,
  deferLabel,
  progress,
  disabled = false,
  onChoose,
  labelledById,
}: StructuredChoiceProps) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const hasPreviews = options.some((option) => option.preview);

  function move(next: number) {
    const index = (next + options.length) % options.length;
    setActive(index);
    refs.current[index]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (disabled) return;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        move(active + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        move(active - 1);
        break;
      case "Home":
        event.preventDefault();
        move(0);
        break;
      case "End":
        event.preventDefault();
        move(options.length - 1);
        break;
      case "Escape":
        event.preventDefault();
        onChoose(null);
        break;
      default:
        break;
    }
  }

  return (
    <section
      aria-labelledby={labelledById}
      className="@container mb-2 rounded-[14px] border"
      style={{ borderColor: "var(--line)", background: "var(--surface)" }}
      data-testid="structured-choice"
    >
      <header className="flex items-center justify-between gap-3 px-3 pb-1.5 pt-2.5">
        <h2 id={labelledById} className="text-[13px] font-semibold leading-tight" style={{ color: "var(--ink)" }}>
          {title}
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          {progress && (
            <span className="text-[11px] tabular-nums" style={{ color: "var(--ink-3)" }}>
              {progress}
            </span>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChoose(null)}
            data-testid="structured-choice-defer"
            className="rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors disabled:opacity-50"
            style={{ color: "var(--ink-2)" }}
          >
            {deferLabel}
          </button>
        </div>
      </header>

      {/*
        Container queries, not viewport ones. This panel lives inside the
        conversation's measure column, which is 560px when the preview is open
        and 820px when it is not — so the window width says nothing useful
        about how much room the cards actually have. `@container` makes the row
        respond to its own box.

        Horizontal scroll when narrow rather than a wrap: three cards wrapping
        to 2 + 1 reads as a broken grid, and a stacked column would push the
        composer off-screen — the one thing the intake must never do.
      */}
      <div
        role="radiogroup"
        aria-labelledby={labelledById}
        onKeyDown={onKeyDown}
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-3 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {options.map((option, index) => {
          const isActive = index === active;
          return (
            <button
              key={option.id}
              ref={(node) => { refs.current[index] = node; }}
              type="button"
              role="radio"
              aria-checked={isActive}
              tabIndex={isActive ? 0 : -1}
              disabled={disabled}
              data-testid="structured-choice-option"
              data-option-id={option.id}
              onFocus={() => setActive(index)}
              onClick={() => onChoose(option.id)}
              className="group flex min-w-[148px] flex-1 snap-start flex-col gap-1.5 rounded-[11px] border p-2 text-left transition-all disabled:opacity-50 @sm:min-w-0"
              style={{
                borderColor: isActive ? "var(--accent)" : "var(--line)",
                background: isActive ? "var(--accent-soft)" : "var(--surface)",
                boxShadow: isActive ? "0 0 0 1px var(--accent)" : "none",
              }}
            >
              {option.preview && (
                <span className="block h-[52px] w-full overflow-hidden rounded-[10px]">
                  <DesignPreview id={option.preview} />
                </span>
              )}
              <span className="text-[12.5px] font-semibold leading-snug" style={{ color: "var(--ink)" }}>
                {option.label}
              </span>
              {option.hint && (
                <span className="text-[11px] leading-snug" style={{ color: "var(--ink-3)" }}>
                  {option.hint}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {hasPreviews && <span className="sr-only">{/* previews are decorative; labels carry the meaning */}</span>}
    </section>
  );
}
