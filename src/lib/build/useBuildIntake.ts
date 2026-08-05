"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  INTAKE_STORAGE_VERSION,
  hashIdea,
  intakeStorageKey,
  isIntakeComplete,
  nextStep,
  planIntake,
  type IntakeAnswers,
  type IntakePlan,
  type IntakeStep,
  type PersistedIntake,
} from "./intake";

/**
 * Owns intake state, its persistence, and the guarantee that the transition
 * into generation happens exactly once.
 *
 * The idempotency problem is the whole reason this is a hook rather than three
 * `useState` calls in the workspace. Generation is expensive and quota-bearing,
 * and there are four independent ways to ask for it twice:
 *
 *   1. double-click on the final option;
 *   2. answering, then refreshing before the job row exists;
 *   3. back-navigating into the workspace after generation started;
 *   4. React re-running an effect.
 *
 * A single boolean in state stops (1) and (4) only. The latch is therefore
 * written to storage *before* the callback fires, so a reload during the round
 * trip finds intake already dispatched and shows the workspace rather than
 * offering the last question again.
 */

export interface BuildIntakeState {
  /** The question to show, or null when intake is done or inactive. */
  step: IntakeStep | null;
  /** "1 / 2" — omitted when the plan has a single step. */
  progress: string | null;
  plan: IntakePlan;
  answers: IntakeAnswers;
  /** True once generation has been dispatched for this project. */
  dispatched: boolean;
  choose: (optionId: string | null) => void;
  /** Abandons intake without generating — used when the user types instead. */
  dismiss: () => void;
}

interface Options {
  projectId: string;
  idea: string;
  /** Intake is pointless once output exists or a job is already running. */
  enabled: boolean;
  onComplete: (answers: IntakeAnswers) => void;
}

function readStored(projectId: string): PersistedIntake | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(intakeStorageKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedIntake;
    if (parsed.v !== INTAKE_STORAGE_VERSION) return null;
    return parsed;
  } catch {
    // Storage can be unavailable (private mode, quota, disabled). Intake then
    // works for the session and simply cannot resume — better than throwing.
    return null;
  }
}

function writeStored(projectId: string, value: PersistedIntake): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(intakeStorageKey(projectId), JSON.stringify(value));
  } catch {
    /* see readStored */
  }
}

export function useBuildIntake({ projectId, idea, enabled, onComplete }: Options): BuildIntakeState {
  const plan = useMemo(() => planIntake(idea), [idea]);
  const ideaHash = useMemo(() => hashIdea(idea), [idea]);

  // Initialised from storage synchronously so the first paint already reflects
  // a resumed session — a flash of the first question before restore would be
  // indistinguishable from being asked twice.
  const [stored, setStored] = useState<{ hash: string; answers: IntakeAnswers; dispatched: boolean }>(() => {
    const found = readStored(projectId);
    if (!found) return { hash: ideaHash, answers: {}, dispatched: false };
    return { hash: found.ideaHash, answers: found.answers ?? {}, dispatched: found.dispatched === true };
  });

  // Freshness is DERIVED, not repaired in an effect. If the saved answers
  // belong to a different idea they are simply ignored this render, which
  // avoids a frame where a previous idea's choices are briefly live.
  const state = stored.hash === ideaHash
    ? { answers: stored.answers, dispatched: stored.dispatched }
    : { answers: {} as IntakeAnswers, dispatched: false };

  const [dismissed, setDismissed] = useState(false);

  // Guards a second dispatch from two clicks landing in the same tick, before
  // React has re-rendered with the latch set. Written only in the handler —
  // reading or writing a ref during render is what the rule forbids.
  const dispatchedRef = useRef(false);

  const persist = useCallback(
    (answers: IntakeAnswers, dispatched: boolean) => {
      writeStored(projectId, { v: INTAKE_STORAGE_VERSION, ideaHash, answers, dispatched });
    },
    [projectId, ideaHash]
  );

  const choose = useCallback(
    (optionId: string | null) => {
      if (dispatchedRef.current || state.dispatched) return;
      const step = nextStep(plan, state.answers);
      if (!step) return;

      const answers: IntakeAnswers = { ...state.answers, [step.id]: optionId };

      if (isIntakeComplete(plan, answers)) {
        // Latch BEFORE dispatching. If the tab reloads mid-request the stored
        // flag already says generation was asked for, so intake does not come
        // back and ask again.
        dispatchedRef.current = true;
        setStored({ hash: ideaHash, answers, dispatched: true });
        persist(answers, true);
        onComplete(answers);
        return;
      }

      setStored({ hash: ideaHash, answers, dispatched: false });
      persist(answers, false);
    },
    [plan, state.answers, state.dispatched, ideaHash, persist, onComplete]
  );

  const dismiss = useCallback(() => setDismissed(true), []);

  const step = enabled && !dismissed && !state.dispatched ? nextStep(plan, state.answers) : null;
  const stepIndex = step ? plan.steps.findIndex((s) => s.id === step.id) : -1;

  return {
    step,
    progress: step && plan.steps.length > 1 ? `${stepIndex + 1} / ${plan.steps.length}` : null,
    plan,
    answers: state.answers,
    dispatched: state.dispatched,
    choose,
    dismiss,
  };
}
