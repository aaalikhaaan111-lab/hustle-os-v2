"use client";

import { useState, type ReactNode } from "react";
import { DesignPreview } from "./DesignPreview";
import type { DesignPreviewId } from "@/lib/build/intake";
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
 * as message, then options. Nothing about the interaction moved: the `<Q>`
 * block below is the registry component with the same items, the same freeform
 * row, the same skip and the same submit.
 *
 * The composer is still a prop rather than a sibling the caller renders itself,
 * because this component owns the decision of when it appears: while a question
 * is open it is deliberately absent, and it comes back the moment there is no
 * question left. Handing that choice back to four call sites would be four
 * places to get it wrong.
 *
 * With no question it returns the composer untouched — which is what keeps it
 * from ever being permanent furniture.
 */
export interface QuestionnaireOption {
  id: string;
  label: string;
  hint?: string;
  /**
   * A deterministic thumbnail for a visual-direction choice.
   *
   * THIS FIELD WENT MISSING AND TOOK THE FEATURE WITH IT. The pre-shadcn
   * questionnaire rendered `<DesignPreview>` beside each option; the rewrite
   * onto the registry component dropped it. `PreOutputWorkspace` never stopped
   * passing `preview:` — but without this field the value is not part of the
   * option type, so it was silently discarded on the way in and
   * `DesignPreview.tsx` became dead code nothing imported.
   *
   * Nothing told anyone: no type error, because the value arrives through a
   * `.map()` whose result is widened rather than excess-property checked, and
   * no visual error, because a missing thumbnail just looks like a list. The
   * result was six visual directions described only by two words each —
   * "Brutalist / Hard edges, heavy type" — which is the complaint that a person
   * cannot tell what they are choosing between.
   */
  preview?: DesignPreviewId;
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

  /**
   * WHILE A QUESTION IS ON SCREEN, THE COMPOSER IS NOT.
   *
   * Both were rendered at once, so the screen offered two ways forward and said
   * nothing about which one it wanted: a set of options above, and below them an
   * open text box that would send whatever was typed into it as a new message —
   * stepping over the question rather than answering it.
   *
   * Nothing is taken away. The questionnaire carries its own freeform row for an
   * answer that is not one of the choices, and a skip for "you decide", so every
   * way out of the question is still inside the question. The composer returns
   * the moment `options` is empty, which is what happens as soon as this is
   * answered or skipped.
   */
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
                  {/* The thumbnail leads, because it is the thing being
                      chosen — the words are the caption for it, not the other
                      way round. Small on purpose: it promises a treatment
                      (contrast, density, rhythm), not a specific page. */}
                  {option.preview && (
                    <span className="s-ask-thumb" aria-hidden>
                      <DesignPreview id={option.preview} />
                    </span>
                  )}
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
    </>
  );
}
