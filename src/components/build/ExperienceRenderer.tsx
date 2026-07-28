"use client";

import { useMemo, useState } from "react";
import { deepenQuizResultAction, type DeepenAnswer } from "@/lib/actions/stage3";
import type { Locale } from "@/i18n/locale";
import type {
  Stage3Experience,
  Stage3QuizExperience,
  Stage3QuizOutcome,
  Stage3QuizStep,
} from "@/lib/build/stage3Types";
import { OUTPUT_COPY } from "@/lib/publishing/copy";

interface ExperienceRendererProps {
  projectId: string;
  experience: Stage3Experience;
  locale: Locale;
  mode: "preview" | "public";
}

function computeOutcome(
  experience: Stage3QuizExperience,
  choiceAnswers: Record<string, string>,
  numberAnswers: Record<string, number>,
): { outcome: Stage3QuizOutcome; answers: DeepenAnswer[] } {
  const totals = experience.outcomes.map(() => 0);
  const answers: DeepenAnswer[] = [];

  for (const step of experience.steps) {
    if (step.kind === "choice") {
      const optionId = choiceAnswers[step.id];
      const option = step.options.find((entry) => entry.id === optionId);
      if (!option) continue;
      option.scores.forEach((score, index) => { totals[index] += score; });
      answers.push({ question: step.prompt, answer: option.label });
    } else {
      const value = numberAnswers[step.id];
      if (value === undefined) continue;
      const breakpoint = step.numberBreakpoints.find((entry) => value <= entry.max) ?? step.numberBreakpoints[step.numberBreakpoints.length - 1];
      breakpoint?.scores.forEach((score, index) => { totals[index] += score; });
      answers.push({ question: step.prompt, answer: `${value}${step.numberUnit ? ` ${step.numberUnit}` : ""}` });
    }
  }

  let bestIndex = 0;
  for (let index = 1; index < totals.length; index += 1) {
    if (totals[index] > totals[bestIndex]) bestIndex = index;
  }
  return { outcome: experience.outcomes[bestIndex], answers };
}

function QuizStepView({ step, isLast, actionLabel, continueLabel, onAnswer }: {
  step: Stage3QuizStep;
  isLast: boolean;
  actionLabel: string;
  continueLabel: string;
  onAnswer: (choiceOptionId: string | null, numberValue: number | null) => void;
}) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [numberValue, setNumberValue] = useState<number | null>(step.numberMin);
  const buttonLabel = isLast ? actionLabel : continueLabel;

  if (step.kind === "choice") {
    return (
      <div key={step.id} className="stage3-reveal-block project-output-quiz-step">
        <p className="project-output-kicker">{step.helper}</p>
        <h2>{step.prompt}</h2>
        <div className="project-output-quiz-options">
          {step.options.map((option) => (
            <button
              key={option.id}
              type="button"
              className="project-output-quiz-option"
              data-selected={selectedOptionId === option.id}
              onClick={() => setSelectedOptionId(option.id)}
            >
              <span>{option.label}</span>
              {option.hint && <small>{option.hint}</small>}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="project-output-quiz-continue"
          disabled={!selectedOptionId}
          onClick={() => onAnswer(selectedOptionId, null)}
        >
          {buttonLabel}
        </button>
      </div>
    );
  }

  return (
    <div key={step.id} className="stage3-reveal-block project-output-quiz-step">
      <p className="project-output-kicker">{step.helper}</p>
      <h2>{step.prompt}</h2>
      <input
        type="number"
        className="project-output-quiz-number"
        min={step.numberMin}
        max={step.numberMax}
        step={step.numberStep}
        placeholder={step.numberPlaceholder}
        value={numberValue ?? ""}
        onChange={(event) => setNumberValue(event.target.value === "" ? null : Number(event.target.value))}
      />
      {step.numberUnit && <span className="project-output-quiz-unit">{step.numberUnit}</span>}
      <button
        type="button"
        className="project-output-quiz-continue"
        disabled={numberValue === null || Number.isNaN(numberValue)}
        onClick={() => onAnswer(null, numberValue)}
      >
        {buttonLabel}
      </button>
    </div>
  );
}

function QuizExperienceView({ experience, projectId, locale, mode }: {
  experience: Stage3QuizExperience;
  projectId: string;
  locale: Locale;
  mode: "preview" | "public";
}) {
  const copy = OUTPUT_COPY[locale];
  const [stepIndex, setStepIndex] = useState(0);
  const [choiceAnswers, setChoiceAnswers] = useState<Record<string, string>>({});
  const [numberAnswers, setNumberAnswers] = useState<Record<string, number>>({});
  const [revealed, setRevealed] = useState(false);
  const [deepenState, setDeepenState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [deepenText, setDeepenText] = useState<string | null>(null);

  const step = experience.steps[stepIndex];
  const isLastStep = stepIndex === experience.steps.length - 1;

  function handleAnswer(choiceOptionId: string | null, numberValue: number | null) {
    const nextChoiceAnswers = choiceOptionId ? { ...choiceAnswers, [step.id]: choiceOptionId } : choiceAnswers;
    const nextNumberAnswers = numberValue !== null ? { ...numberAnswers, [step.id]: numberValue } : numberAnswers;
    setChoiceAnswers(nextChoiceAnswers);
    setNumberAnswers(nextNumberAnswers);
    if (isLastStep) {
      setRevealed(true);
    } else {
      setStepIndex((current) => current + 1);
    }
  }

  const result = useMemo(
    () => (revealed ? computeOutcome(experience, choiceAnswers, numberAnswers) : null),
    [revealed, experience, choiceAnswers, numberAnswers],
  );

  function reset() {
    setStepIndex(0);
    setChoiceAnswers({});
    setNumberAnswers({});
    setRevealed(false);
    setDeepenState("idle");
    setDeepenText(null);
  }

  async function handleDeepen() {
    if (!result) return;
    setDeepenState("loading");
    const response = await deepenQuizResultAction(projectId, result.answers, result.outcome.title);
    if (response.error || !response.text) {
      setDeepenState("error");
      return;
    }
    setDeepenText(response.text);
    setDeepenState("done");
  }

  if (!revealed) {
    return (
      <div className="project-output-quiz">
        <div className="project-output-quiz-progress">
          {experience.steps.map((entry, index) => (
            <span key={entry.id} data-done={index < stepIndex} data-active={index === stepIndex} />
          ))}
        </div>
        <QuizStepView
          key={step.id}
          step={step}
          isLast={isLastStep}
          actionLabel={experience.actionLabel}
          continueLabel={copy.continueLabel}
          onAnswer={handleAnswer}
        />
      </div>
    );
  }

  const outcome = result!.outcome;
  return (
    <div className="stage3-reveal-block project-output-quiz-result">
      <p className="project-output-kicker">{copy.resultLabel}</p>
      <span className="project-output-quiz-result-emoji" aria-hidden>{outcome.emoji}</span>
      <h2>{outcome.title}</h2>
      <p className="project-output-quiz-result-summary">{outcome.summary}</p>
      <p className="project-output-section-body">{outcome.detail}</p>
      <ul className="project-output-quiz-actions">
        {outcome.actionItems.map((item) => <li key={item}>{item}</li>)}
      </ul>
      {mode === "preview" && (
        <div className="project-output-quiz-deepen">
          {deepenState !== "done" && (
            <button type="button" onClick={handleDeepen} disabled={deepenState === "loading"}>
              {deepenState === "loading" ? copy.deepenLoadingLabel : copy.deepenButtonLabel}
            </button>
          )}
          {deepenState === "error" && <p className="project-output-form-error">{copy.deepenErrorLabel}</p>}
          {deepenState === "done" && deepenText && <p className="project-output-quiz-deepen-text">{deepenText}</p>}
        </div>
      )}
      <button type="button" className="project-output-quiz-reset" onClick={reset}>{copy.resetLabel}</button>
    </div>
  );
}

function ExplorerExperienceView({ experience }: { experience: Extract<Stage3Experience, { kind: "explorer" }> }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedCard = experience.cards.find((card) => card.id === selectedId) ?? null;

  return (
    <div className="project-output-explorer">
      <div className="project-output-explorer-grid">
        {experience.cards.map((card) => (
          <button
            key={card.id}
            type="button"
            className="project-output-explorer-card"
            data-selected={card.id === selectedId}
            onClick={() => setSelectedId(card.id === selectedId ? null : card.id)}
          >
            <span aria-hidden>{card.emoji}</span>
            <span>{card.label}</span>
          </button>
        ))}
      </div>
      {selectedCard && (
        <div className="stage3-reveal-block project-output-explorer-reveal" key={selectedCard.id}>
          <h3>{selectedCard.revealTitle}</h3>
          <p>{selectedCard.revealBody}</p>
          {selectedCard.beforeText && selectedCard.afterText && (
            <div className="project-output-explorer-before-after">
              <div>
                <span className="project-output-kicker">{selectedCard.beforeLabel}</span>
                <p>{selectedCard.beforeText}</p>
              </div>
              <div>
                <span className="project-output-kicker">{selectedCard.afterLabel}</span>
                <p>{selectedCard.afterText}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ExperienceRenderer({ projectId, experience, locale, mode }: ExperienceRendererProps) {
  if (experience.kind === "explorer") return <ExplorerExperienceView experience={experience} />;
  return <QuizExperienceView experience={experience} projectId={projectId} locale={locale} mode={mode} />;
}
