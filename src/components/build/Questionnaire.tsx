"use client";

import { useState, type ReactNode } from "react";
import {
  Questionnaire as Q,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoiceDescription,
  QuestionnaireChoices,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireSkip,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from "@/components/ui/shadcn/questionnaire";

/**
 * Structured clarification, on shadcn's own Questionnaire.
 *
 * THIS IS THE REAL COMPONENT. `@shadcn/react/questionnaire` supplies the
 * behaviour — item state, radio/checkbox choice semantics, keyboard shortcuts,
 * validation, skip and submit — and `ui/questionnaire.tsx` is the registry
 * source, imports rewritten to this project's aliases and its multi-library
 * icon placeholder swapped for the lucide icon this project already uses.
 * Nothing about the interaction is reimplemented here.
 *
 * WHAT THIS FILE ADDS is only placement, and placement has been wrong twice.
 * First the question was drawn inside the SAME border as the composer, so the
 * text box appeared to grow upward to hold it — one tall surface in which the
 * transcript, the question and the input all looked like a single oversized
 * card. Then it became its own bordered panel, which fixed the composer but
 * introduced a third bordered box in a vertical stack of them: it read as a
 * widget that had floated in rather than as part of the conversation.
 *
 * It has no container at all now. The wrapper carries spacing and an entry
 * animation and nothing else — no border, no fill, no radius, no focus ring —
 * so the options themselves are the only bounded things, and the column reads
 * as message, options, composer. Nothing about the interaction moved: the `<Q>`
 * block below is the registry component with the same items, the same freeform
 * row, the same skip and the same submit.
 *
 * With no question it returns the composer untouched — which is what keeps it
 * from ever being permanent furniture.
 */
export interface QuestionnaireOption {
  id: string;
  label: string;
  hint?: string;
}

export function VentrioQuestionnaire({
  question,
  options,
  composer,
  name = "answer",
  multiple = false,
  disabled = false,
  freeformLabel,
  submitLabel,
  onAnswer,
  onSkip,
  skipLabel,
}: {
  question?: string;
  options: QuestionnaireOption[];
  /** The live composer, rendered as a sibling below the panel. */
  composer: ReactNode;
  name?: string;
  multiple?: boolean;
  disabled?: boolean;
  /** Placeholder for the freeform row, when a typed answer is allowed. */
  freeformLabel?: string;
  submitLabel: string;
  /** Receives the chosen ids, or the typed text. */
  onAnswer: (answer: { ids: string[]; text: string }) => void;
  onSkip?: () => void;
  skipLabel?: string;
}) {
  const [text, setText] = useState("");

  if (options.length === 0) return <>{composer}</>;

  return (
    <>
      <div className="s-ask-panel" data-testid="questionnaire">
        <Q
          items={[
            { name, choices: options.map((option) => ({ value: option.id })) },
          ]}
          className="s-ask-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (disabled) return;
            const data = new FormData(event.currentTarget);
            const ids = data.getAll(name).map(String).filter(Boolean);
            onAnswer({ ids, text: text.trim() });
            setText("");
          }}
        >
          <QuestionnaireItem name={name} multiple={multiple}>
            {question && <QuestionnaireTitle>{question}</QuestionnaireTitle>}

            <QuestionnaireChoices>
              {options.map((option) => (
                <QuestionnaireChoice
                  key={option.id}
                  value={option.id}
                  disabled={disabled}
                >
                  {option.label}
                  {option.hint && (
                    <QuestionnaireChoiceDescription>
                      {option.hint}
                    </QuestionnaireChoiceDescription>
                  )}
                </QuestionnaireChoice>
              ))}
            </QuestionnaireChoices>

            {/* The answer does not have to be one of the choices. */}
            {freeformLabel && (
              <QuestionnaireInput
                placeholder={freeformLabel}
                value={text}
                disabled={disabled}
                onChange={(event) => setText(event.target.value)}
              />
            )}

            <QuestionnaireActions>
              {onSkip && (
                <QuestionnaireSkip
                  type="button"
                  disabled={disabled}
                  onClick={onSkip}
                >
                  {skipLabel}
                </QuestionnaireSkip>
              )}
              <QuestionnaireSubmit disabled={disabled}>
                {submitLabel}
              </QuestionnaireSubmit>
            </QuestionnaireActions>
          </QuestionnaireItem>
        </Q>
      </div>
      {composer}
    </>
  );
}
