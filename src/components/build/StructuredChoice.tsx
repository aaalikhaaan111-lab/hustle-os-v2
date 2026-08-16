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
 * FOCUS IS NOT SELECTION. Nothing is chosen until the person chooses it, so no
 * card carries the selected treatment on first paint. An earlier version used
 * one index for both and made the first option look already-picked, which
 * misreports the state and biases the answer. Focus shows as a ring, selection
 * as the accent fill, and `aria-checked` follows selection alone.
 *
 * KEYBOARD: the row is a radiogroup. Arrow keys move focus without choosing,
 * Home/End jump to the ends, Enter/Space confirm, Escape skips, Backspace goes
 * back when a back handler exists. Roving tabindex keeps the group a single tab
 * stop, so someone tabbing to the composer passes the whole question in one
 * press rather than three.
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
  /** Omitted on the first step; renders a compact Back when present. */
  onBack?: () => void;
  backLabel?: string;
  labelledById?: string;
}

export function StructuredChoice({
  title,
  options,
  deferLabel,
  progress,
  disabled = false,
  onChoose,
  onBack,
  backLabel,
  labelledById,
}: StructuredChoiceProps) {
  // Where the keyboard cursor is — NOT what is chosen.
  const [focusIndex, setFocusIndex] = useState(0);
  // What the person actually picked. Null until they do.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function pick(optionId: string) {
    if (disabled) return;
    setSelectedId(optionId);
    onChoose(optionId);
  }

  function move(next: number) {
    const index = (next + options.length) % options.length;
    setFocusIndex(index);
    refs.current[index]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (disabled) return;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        move(focusIndex + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        move(focusIndex - 1);
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
      case "Backspace":
        if (onBack) {
          event.preventDefault();
          onBack();
        }
        break;
      default:
        break;
    }
  }

  return (
    <section
      aria-labelledby={labelledById}
      // No border or panel fill: this is the assistant asking, and a framed
      // card around the question made it read as a form docked to the page.
      className="@container"
      data-testid="structured-choice"
    >
      <header className="flex items-start justify-between gap-3 px-3 pb-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {onBack && (
            <button
              type="button"
              disabled={disabled}
              onClick={onBack}
              data-testid="structured-choice-back"
              aria-label={backLabel}
              className="-ml-1 shrink-0 rounded-full px-1.5 py-1 text-[12px] font-medium transition-colors disabled:opacity-50"
              style={{ color: "var(--color-ink-secondary)" }}
            >
              ← {backLabel}
            </button>
          )}
          {/* The question, at the size the assistant's other messages use.
              It was 13px, semibold and truncated — smaller than the
              conversation around it, and a question that cannot finish its own
              sentence. */}
          <h2 id={labelledById} className="text-[15px] font-normal leading-[1.65]" style={{ color: "var(--color-ink)" }}>
            {title}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {progress && (
            <span className="text-[11px] tabular-nums" style={{ color: "var(--color-ink-muted)" }}>
              {progress}
            </span>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChoose(null)}
            data-testid="structured-choice-defer"
            className="rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors disabled:opacity-50"
            style={{ color: "var(--color-ink-secondary)" }}
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

        The options stack, one row each. They used to scroll sideways, which
        hid the fourth and fifth behind an edge with nothing to say so.
      */}
      <div
        role="radiogroup"
        aria-labelledby={labelledById}
        onKeyDown={onKeyDown}
        /* Stacked, not a horizontal filmstrip. Options that scroll sideways
           hide themselves: the fourth style or audience was off-screen with
           nothing to say so, and on a phone even the second was. */
        className="flex flex-col gap-2 px-3 pb-3"
      >
        {options.map((option, index) => {
          const isSelected = option.id === selectedId;
          return (
            <button
              key={option.id}
              ref={(node) => { refs.current[index] = node; }}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={index === focusIndex ? 0 : -1}
              disabled={disabled}
              data-testid="structured-choice-option"
              data-option-id={option.id}
              onFocus={() => setFocusIndex(index)}
              onClick={() => pick(option.id)}
              className="group flex w-full items-center gap-2.5 rounded-[11px] border p-2 text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50"
              style={{
                borderColor: isSelected ? "var(--color-accent)" : "var(--color-border)",
                background: isSelected ? "var(--color-accent-soft)" : "var(--color-surface)",
                boxShadow: isSelected ? "0 0 0 1px var(--color-accent)" : "none",
                // Focus reads as a ring in the accent, selection as the fill —
                // two different signals rather than one doing both jobs.
                ["--tw-ring-color" as string]: "var(--color-accent-line)",
              }}
            >
              {option.preview && (
                <span className="block h-[38px] w-[56px] shrink-0 overflow-hidden rounded-[8px]">
                  <DesignPreview id={option.preview} />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-semibold leading-snug" style={{ color: "var(--color-ink)" }}>
                  {option.label}
                </span>
                {option.hint && (
                  <span className="mt-0.5 block truncate text-[11px] leading-snug" style={{ color: "var(--color-ink-muted)" }}>
                    {option.hint}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
