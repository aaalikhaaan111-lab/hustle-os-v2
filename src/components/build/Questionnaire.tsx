"use client";

import { useRef, useState, type ReactNode } from "react";
import { DesignPreview } from "./DesignPreview";
import type { DesignPreviewId } from "@/lib/build/intake";
import {
  FieldDescription,
  FieldGroup,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/shadcn/field";

/**
 * The questionnaire: the composer, temporarily expanded into a question.
 *
 * WHAT THIS REPLACES, and why both of its predecessors were wrong.
 *
 * First there was a stack of full-width bordered cards rendered inside the
 * message list. It scrolled away from the composer and read as navigation
 * parked near a message rather than as the question being asked.
 *
 * Then there were chips above the composer, with "Refine" and "Show another"
 * as separate links beside them. Smaller, but not one thing: a row of pills, a
 * scatter of text buttons and a hint line, floating above a composer they had
 * no visible relationship to.
 *
 * This is ONE SURFACE. The question, its answers and the composer share a
 * single border, a single radius and a single shadow, so what a person sees is
 * their text box growing upward to hold a question — and shrinking back when it
 * is answered. The composer is passed in rather than placed beside this
 * component, which is what makes the fusion structural instead of two elements
 * that have to be kept adjacent by hand.
 *
 * The typed answer is therefore free. The composer inside the surface is the
 * same live composer it always was, so "or answer in your own words" is not an
 * escape hatch bolted on: it is the box directly below the options.
 *
 * KEYBOARD. The options are a radiogroup with a roving tabindex: arrows move
 * without choosing, Home/End jump, Enter or Space confirms, Escape skips where
 * skipping is offered, Backspace goes back where there is a back. One tab stop,
 * so tabbing to the composer passes the whole question in a single press.
 *
 * FOCUS IS NOT SELECTION. Nothing is chosen until it is chosen: focus draws a
 * ring, selection fills. An option the keyboard is merely resting on must never
 * look already picked.
 */
export interface QuestionnaireOption {
  id: string;
  label: string;
  hint?: string;
  /** Only the visual-direction questions carry one. */
  preview?: DesignPreviewId;
}

export function Questionnaire({
  question,
  options,
  composer,
  selected = [],
  multiple = false,
  disabled = false,
  typeHint,
  progress,
  onChoose,
  onSkip,
  skipLabel,
  onBack,
  backLabel,
  actions,
  onSecondary,
  secondaryLabel,
}: {
  /**
   * The question, when the surface has to state it.
   *
   * Omitted where the assistant's own message sits directly above the surface
   * and IS the question — restating it there would print the same sentence
   * twice, forty pixels apart. The intake steps do pass one, because their
   * question exists nowhere else on screen.
   */
  question?: string;
  options: QuestionnaireOption[];
  /** The live composer, rendered inside the same surface. */
  composer: ReactNode;
  selected?: string[];
  multiple?: boolean;
  disabled?: boolean;
  /** "Or answer in your own words below." */
  typeHint: string;
  /** "1 / 2", when there is more than one step. */
  progress?: string;
  onChoose: (optionId: string) => void;
  onSkip?: () => void;
  skipLabel?: string;
  onBack?: () => void;
  backLabel?: string;
  /** Anything the question needs beyond its options — "show another", etc. */
  actions?: ReactNode;
  /**
   * A second thing you can do to an option rather than with it.
   *
   * The direction proposals need this: choosing one builds it, so "adjust this
   * one first" has nowhere else to live. It used to be a button welded to the
   * outside of every card; it is a quiet control at the end of the row now, so
   * the row still reads as one answer.
   */
  onSecondary?: (optionId: string) => void;
  secondaryLabel?: string;
}) {
  const labelId = `ask-${options.map((option) => option.id).join("-").slice(0, 40)}`;
  const [focusIndex, setFocusIndex] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

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
        if (onSkip) {
          event.preventDefault();
          onSkip();
        }
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

  // No question, no surface: the composer is returned exactly as it was, so
  // this component can wrap it unconditionally without ever being permanent UI.
  if (options.length === 0) return <>{composer}</>;

  return (
    <div className="s-ask-shell" data-testid="questionnaire">
      <FieldSet className="gap-0 px-3.5 pt-3 sm:px-4">
        <div className="flex items-start justify-between gap-3">
          {question ? (
            <FieldLegend id={labelId} className="text-[15px] font-normal leading-[1.55]">
              {question}
            </FieldLegend>
          ) : (
            <span />
          )}
          <div className="flex shrink-0 items-center gap-1">
            {progress && (
              <span className="text-[11px] tabular-nums" style={{ color: "var(--color-ink-muted)" }}>
                {progress}
              </span>
            )}
            {onBack && (
              <button type="button" disabled={disabled} onClick={onBack} className="s-ask-quiet">
                {backLabel}
              </button>
            )}
            {onSkip && (
              <button
                type="button"
                disabled={disabled}
                onClick={onSkip}
                data-testid="questionnaire-skip"
                className="s-ask-quiet"
              >
                {skipLabel}
              </button>
            )}
          </div>
        </div>

        {/* One option per line, full width of the surface: these are answers to
            read, not tags to scan. They stay compact because each is a single
            row rather than a card. */}
        <FieldGroup
          role={multiple ? "group" : "radiogroup"}
          aria-label={question}
          aria-labelledby={question ? labelId : undefined}
          onKeyDown={onKeyDown}
          className="mt-2.5 gap-1"
        >
          {options.map((option, index) => {
            const isSelected = selected.includes(option.id);
            return (
              <span key={option.id} className="s-ask-row">
              <button
                ref={(node) => { refs.current[index] = node; }}
                type="button"
                role={multiple ? "checkbox" : "radio"}
                aria-checked={isSelected}
                tabIndex={index === focusIndex ? 0 : -1}
                disabled={disabled}
                onFocus={() => setFocusIndex(index)}
                onClick={() => onChoose(option.id)}
                data-testid="questionnaire-option"
                data-option-id={option.id}
                data-selected={isSelected ? "true" : undefined}
                className="s-ask-option"
              >
                {option.preview && (
                  <span className="s-ask-thumb" aria-hidden>
                    <DesignPreview id={option.preview} />
                  </span>
                )}
                <span className="min-w-0 flex-1 text-left">
                  <FieldTitle className="block text-[14px] font-medium leading-snug">
                    {option.label}
                  </FieldTitle>
                  {option.hint && (
                    <FieldDescription className="mt-0.5 block text-[12.5px] leading-snug">
                      {option.hint}
                    </FieldDescription>
                  )}
                </span>
                <span className="s-ask-tick" aria-hidden>
                  {isSelected ? "✓" : ""}
                </span>
              </button>
              {onSecondary && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onSecondary(option.id)}
                  className="s-ask-quiet shrink-0"
                  data-testid="questionnaire-secondary"
                >
                  {secondaryLabel}
                </button>
              )}
              </span>
            );
          })}
        </FieldGroup>

        {actions && <div className="mt-2 flex flex-wrap items-center gap-2">{actions}</div>}

        <p className="mt-2.5 text-[12px]" style={{ color: "var(--color-ink-muted)" }}>
          {typeHint}
        </p>
      </FieldSet>

      {/* The seam. A hairline rather than a gap, because a gap would make these
          two boxes again. */}
      <div className="s-ask-seam" aria-hidden />

      {composer}
    </div>
  );
}
