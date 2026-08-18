"use client";

import type { ReactNode } from "react";

/**
 * The one place Ventrio asks something with options, docked to the composer.
 *
 * WHAT THIS REPLACES. Two separate presentations, both rendered up inside the
 * message list: a stack of full-width `.choice-row` cards for clarifications,
 * and the same cards with a "Refine" button bolted to the side for direction
 * proposals. Because they lived in the transcript they scrolled away from the
 * composer, and because they were full-width rows they read as navigation that
 * happened to be nearby rather than as the question that had just been asked.
 *
 * It is a strip above the composer now, visually attached to it: the options
 * are chips the width of their own words, the whole thing is about the height
 * of one message, and it sits where the answer is going to be typed. Answering
 * removes it, because the caller stops passing options.
 *
 * The composer underneath stays live throughout — a row of chips reads as a
 * closed set of permitted answers unless something says otherwise, so the hint
 * line says otherwise.
 */
export interface AskOption {
  id: string;
  label: string;
  hint?: string;
}

export function AskStrip({
  options,
  selected,
  disabled,
  hint,
  onPick,
  footer,
  multiple,
}: {
  options: AskOption[];
  /** Ids currently chosen — one for single-select, many for multi. */
  selected: string[];
  disabled?: boolean;
  /** "Or just type your answer" — the caller owns the wording. */
  hint: string;
  onPick: (option: AskOption) => void;
  /** Actions the strip needs when a choice is not immediately final. */
  footer?: ReactNode;
  multiple?: boolean;
}) {
  if (options.length === 0) return null;

  return (
    <section
      className="s-ask mb-2"
      aria-label={hint}
      data-testid="ask-strip"
    >
      <div
        role={multiple ? "group" : "radiogroup"}
        className="flex flex-wrap items-center gap-1.5 px-1"
      >
        {options.map((option) => {
          const isSelected = selected.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              role={multiple ? "checkbox" : "radio"}
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => onPick(option)}
              title={option.hint}
              className="s-chip"
              data-selected={isSelected ? "true" : undefined}
              data-testid="ask-option"
            >
              <span className="truncate">{option.label}</span>
            </button>
          );
        })}
      </div>

      {footer && <div className="mt-2 flex flex-wrap items-center gap-2 px-1">{footer}</div>}

      <p className="mt-2 px-1 text-[12px]" style={{ color: "var(--color-ink-muted)" }}>
        {hint}
      </p>
    </section>
  );
}
