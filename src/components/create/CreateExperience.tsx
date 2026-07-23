"use client";

import { forwardRef, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  discardCreationDraftAction,
  ensureCreationDraftAction,
  generateCreationTurnAction,
  selectCreationDirectionAction,
} from "@/lib/actions/creation";
import { generateFirstVersionAction } from "@/lib/actions/stage3";
import {
  type CreationChoice,
  type CreationDirection,
  type CreationMessage,
  type PersistedCreationDraft,
  type CreationStartingPoint,
  type CreationTurn,
} from "@/lib/build/creationTypes";
import { cn } from "@/lib/utils";

const STARTING_POINTS: {
  id: CreationStartingPoint;
  labelKey: "spHobby" | "spSkill" | "spIdea" | "spProblem" | "spUnsure";
  detailKey: "spHobbyDetail" | "spSkillDetail" | "spIdeaDetail" | "spProblemDetail" | "spUnsureDetail";
  msgKey: "spHobbyMsg" | "spSkillMsg" | "spIdeaMsg" | "spProblemMsg" | "spUnsureMsg";
}[] = [
  { id: "hobby", labelKey: "spHobby", detailKey: "spHobbyDetail", msgKey: "spHobbyMsg" },
  { id: "skill", labelKey: "spSkill", detailKey: "spSkillDetail", msgKey: "spSkillMsg" },
  { id: "idea", labelKey: "spIdea", detailKey: "spIdeaDetail", msgKey: "spIdeaMsg" },
  { id: "problem", labelKey: "spProblem", detailKey: "spProblemDetail", msgKey: "spProblemMsg" },
  { id: "unsure", labelKey: "spUnsure", detailKey: "spUnsureDetail", msgKey: "spUnsureMsg" },
];

interface CreateExperienceProps {
  userId: string;
  initialDraft: PersistedCreationDraft | null;
}

type CreationPhase = "idle" | "resetting" | "persisting" | "generating" | "handoff";

export function CreateExperience({ userId, initialDraft }: CreateExperienceProps) {
  const t = useTranslations("create");
  const locale = useLocale();
  const router = useRouter();
  // Local storage remembers only the opaque idempotency token. The real draft,
  // conversation, and AI turn live in Supabase and are loaded by the page.
  const storageKey = `ventrio:create-session:${userId}:${locale}`;

  const [messages, setMessages] = useState<CreationMessage[]>(initialDraft?.messages ?? []);
  const [turn, setTurn] = useState<CreationTurn | null>(initialDraft?.turn ?? null);
  const [startingPoint, setStartingPoint] = useState<CreationStartingPoint | null>(initialDraft?.startingPoint ?? null);
  const [sessionId, setSessionId] = useState<string | null>(initialDraft?.sessionId ?? null);
  const [projectId, setProjectId] = useState<string | null>(initialDraft?.projectId ?? null);
  const [conversationId, setConversationId] = useState<string | null>(initialDraft?.conversationId ?? null);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [selectedDirection, setSelectedDirection] = useState<number | null>(null);
  const [selectedChoices, setSelectedChoices] = useState<string[]>([]);
  const [refineTarget, setRefineTarget] = useState<string | null>(null);
  const [generationRetry, setGenerationRetry] = useState<{ direction: CreationDirection; index: number } | null>(null);
  const [creationPhase, setCreationPhase] = useState<CreationPhase>("idle");
  const [isSending, startSending] = useTransition();

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selectionLockRef = useRef(false);
  const started = messages.length > 0;
  const creating = creationPhase !== "idle";

  useEffect(() => {
    try {
      if (initialDraft?.sessionId) window.localStorage.setItem(storageKey, initialDraft.sessionId);
    } catch {
      // Server persistence remains authoritative when storage is unavailable.
    }
  }, [initialDraft?.sessionId, storageKey]);

  useEffect(() => {
    if (!started) {
      scrollRef.current?.scrollTo({ top: 0 });
      return;
    }
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }, [isSending, messages, started, turn]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }, [input]);

  function getOrCreateSessionId(): string {
    if (sessionId) return sessionId;
    let next: string | null = null;
    try {
      next = window.localStorage.getItem(storageKey);
    } catch {
      // Fall through to a new id.
    }
    if (!next) next = crypto.randomUUID();
    setSessionId(next);
    try {
      window.localStorage.setItem(storageKey, next);
    } catch {
      // The deterministic token still lives in component state.
    }
    return next;
  }

  function runTurn(content: string, point: CreationStartingPoint | null, requestId: string) {
    setNote(null);
    setGenerationRetry(null);
    setSelectedChoices([]);
    startSending(async () => {
      try {
        const activeSessionId = getOrCreateSessionId();
        let activeProjectId = projectId;
        let activeConversationId = conversationId;
        if (!activeProjectId || !activeConversationId) {
          const ensured = await ensureCreationDraftAction(activeSessionId, point);
          if (ensured.error || !ensured.projectId || !ensured.conversationId) {
            setNote(ensured.error ?? t("errorSaveFailed"));
            return;
          }
          activeProjectId = ensured.projectId;
          activeConversationId = ensured.conversationId;
          setProjectId(activeProjectId);
          setConversationId(activeConversationId);
        }
        const result = await generateCreationTurnAction(activeProjectId, activeConversationId, requestId, content);
        if (!result.ok) {
          setNote(t("unavailable"));
          return;
        }
        setTurn(result.turn);
        setMessages((previous) => [
          ...previous,
          { role: "assistant", content: result.turn.message },
        ]);
        setPendingRequestId(null);
      } catch {
        setNote(t("unavailable"));
      }
    });
  }

  function send(text: string, refinement: string | null = refineTarget) {
    const trimmed = text.trim();
    if (!trimmed || isSending || creating) return;
    const content = refinement
      ? t("refineAnswerMsg", { name: refinement, change: trimmed })
      : trimmed;
    const next: CreationMessage[] = [...messages, { role: "user", content }];
    const requestId = crypto.randomUUID();
    setMessages(next);
    setInput("");
    setTurn(null);
    setRefineTarget(null);
    setPendingRequestId(requestId);
    runTurn(content, startingPoint, requestId);
  }

  function retry() {
    if (isSending || creating || messages.length === 0) return;
    const latestUser = [...messages].reverse().find((message) => message.role === "user");
    if (!latestUser) return;
    const requestId = pendingRequestId ?? crypto.randomUUID();
    setPendingRequestId(requestId);
    runTurn(latestUser.content, startingPoint, requestId);
  }

  function pickStartingPoint(point: (typeof STARTING_POINTS)[number]) {
    if (isSending || creating) return;
    setStartingPoint(point.id);
    const message = t(point.msgKey);
    const requestId = crypto.randomUUID();
    setMessages([{ role: "user", content: message }]);
    setTurn(null);
    setPendingRequestId(requestId);
    runTurn(message, point.id, requestId);
  }

  function pickChoice(choice: CreationChoice) {
    if (!turn || isSending || creating) return;
    if (turn.choiceMode === "single") {
      send(choice.title, null);
      return;
    }
    setSelectedChoices((current) =>
      current.includes(choice.id)
        ? current.filter((id) => id !== choice.id)
        : [...current, choice.id]
    );
  }

  function submitMultipleChoices() {
    if (!turn || selectedChoices.length === 0) return;
    const answer = turn.choices
      .filter((choice) => selectedChoices.includes(choice.id))
      .map((choice) => choice.title)
      .join(", ");
    send(answer, null);
  }

  function chooseDirection(direction: CreationDirection, index: number) {
    if (creating || isSending || !projectId || selectionLockRef.current) return;
    selectionLockRef.current = true;
    setSelectedDirection(index);
    setGenerationRetry(null);
    setCreationPhase("persisting");
    setNote(null);

    void (async () => {
      let selectedProjectId: string | null = null;
      try {
        const result = await selectCreationDirectionAction(projectId, direction, startingPoint);
        if (result.error || !result.projectId) {
          selectionLockRef.current = false;
          setCreationPhase("idle");
          setSelectedDirection(null);
          setNote(result.error ?? t("errorSaveFailed"));
          return;
        }
        selectedProjectId = result.projectId;
        setCreationPhase("generating");
        const generation = await generateFirstVersionAction(result.projectId);
        if (generation.error || !generation.output) {
          selectionLockRef.current = false;
          setCreationPhase("idle");
          setSelectedDirection(null);
          setGenerationRetry({ direction, index });
          setNote(generation.error ?? t("errorSaveFailed"));
          return;
        }
        try {
          window.localStorage.removeItem(storageKey);
        } catch {
          // Non-fatal: the successful project is already persisted.
        }
        setCreationPhase("handoff");
        router.push(`/projects/${result.projectId}`);
      } catch {
        if (selectedProjectId) {
          try {
            window.localStorage.removeItem(storageKey);
          } catch {
            // The selected project is already canonical on the server.
          }
          setCreationPhase("handoff");
          router.push(`/projects/${selectedProjectId}`);
          return;
        }
        selectionLockRef.current = false;
        setCreationPhase("idle");
        setSelectedDirection(null);
        setNote(t("errorSaveFailed"));
      }
    })();
  }

  function beginRefine(name: string) {
    if (creating || isSending) return;
    setNote(null);
    setGenerationRetry(null);
    setRefineTarget(name);
    setInput("");
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }

  function startOver() {
    if (isSending || creating) return;
    setCreationPhase("resetting");
    setNote(null);
    void (async () => {
      try {
        if (projectId) {
          const result = await discardCreationDraftAction(projectId);
          if (result.error) {
            setNote(result.error);
            setCreationPhase("idle");
            return;
          }
        }
        try { window.localStorage.removeItem(storageKey); } catch { /* no-op */ }
        setMessages([]);
        setTurn(null);
        setStartingPoint(null);
        setSelectedChoices([]);
        setRefineTarget(null);
        setGenerationRetry(null);
        setSelectedDirection(null);
        setSessionId(null);
        setProjectId(null);
        setConversationId(null);
        setPendingRequestId(null);
        setCreationPhase("idle");
        router.refresh();
      } catch {
        setNote(t("errorSaveFailed"));
        setCreationPhase("idle");
      }
    })();
  }

  const showDirections = turn?.phase === "propose" && turn.directions.length > 0;
  const showChoices = turn?.phase === "ask" && turn.choices.length > 0;

  return (
    <div className={cn("creation-canvas relative flex h-full min-h-0 flex-col", started && "is-started", turn?.transition === "focus" && "is-focused")}>
      <div aria-hidden className="creation-focus-field" />
      <div aria-hidden className="creation-contour creation-contour-a" />
      <div aria-hidden className="creation-contour creation-contour-b" />

      <header className="relative z-10 flex shrink-0 items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 sm:pt-6">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-ink-muted">
          <span className="creation-signal-dot" />
          {t("eyebrow")}
        </div>
        {started && (
          <button
            type="button"
            onClick={startOver}
            disabled={isSending || creating}
            className="rounded-full px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-white/[0.04] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40"
          >
            {t("startOver")}
          </button>
        )}
      </header>

      <div ref={scrollRef} className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className={cn("mx-auto flex min-h-full w-full max-w-[860px] flex-col px-4 sm:px-7", started ? "py-8 sm:py-12" : "justify-center py-9 sm:py-14")}>
          {!started ? (
            <section className="emergence mx-auto flex w-full max-w-[760px] flex-col items-center text-center">
              <p className="mb-4 text-xs font-medium tracking-[0.18em] text-accent/80">
                {t("openingSignal")}
              </p>
              <h1 className="ventrio-display max-w-[720px] text-balance text-[clamp(2.35rem,8vw,5.2rem)] leading-[0.96] text-ink">
                {t("headline")}
              </h1>
              <p className="mt-5 max-w-xl text-pretty text-[15px] leading-7 text-ink-secondary sm:text-base">
                {t("subhead")}
              </p>

              <div className="mt-9 grid w-full grid-cols-2 gap-2.5 text-left sm:grid-cols-5">
                {STARTING_POINTS.map((point, index) => (
                  <button
                    key={point.id}
                    type="button"
                    disabled={isSending || creating}
                    onClick={() => pickStartingPoint(point)}
                    className={cn(
                      "starting-point group relative min-h-[108px] overflow-hidden rounded-[1.35rem] p-3.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50",
                      index === STARTING_POINTS.length - 1 && "col-span-2 sm:col-span-1"
                    )}
                  >
                    <span className="starting-point-mark" aria-hidden />
                    <span className="relative mt-7 block text-[13px] font-semibold leading-snug text-ink">
                      {t(point.labelKey)}
                    </span>
                    <span className="relative mt-1 block text-[11px] leading-4 text-ink-muted">
                      {t(point.detailKey)}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <section className={cn("flex flex-col", showDirections ? "gap-8" : "gap-7")}>
              <div className={cn("flex flex-col gap-7 transition-opacity duration-500", showDirections && "settled-state")}>
                {messages.map((message, index) => {
                  const isLatestAssistant = message.role === "assistant" && index === messages.length - 1;
                  return message.role === "user" ? (
                    <div key={index} className="animate-message-in flex justify-end">
                      <div className="max-w-[88%] whitespace-pre-wrap rounded-[1.4rem] rounded-br-md bg-white/[0.075] px-4 py-2.5 text-[15px] leading-6 text-ink ring-1 ring-inset ring-white/[0.055] sm:max-w-[76%]">
                        {message.content}
                      </div>
                    </div>
                  ) : (
                    <div
                      key={index}
                      className={cn(
                        "animate-message-in max-w-[720px] whitespace-pre-wrap text-[17px] leading-8 tracking-[-0.015em] text-ink",
                        isLatestAssistant && showDirections && "ventrio-display text-[clamp(1.75rem,5vw,3rem)] leading-[1.08]"
                      )}
                    >
                      {message.content}
                    </div>
                  );
                })}

                {isSending && (
                  <div className="flex items-center gap-3 text-sm text-ink-secondary" aria-live="polite">
                    <span className="thinking-signal" aria-hidden><span /></span>
                    {t("thinking")}
                  </div>
                )}
              </div>

              {showChoices && (
                <ChoiceGrid
                  choices={turn.choices}
                  multiple={turn.choiceMode === "multiple"}
                  selected={selectedChoices}
                  busy={isSending || creating}
                  onPick={pickChoice}
                  onContinue={submitMultipleChoices}
                />
              )}

              {showDirections && (
                <div className={cn("direction-grid", selectedDirection !== null && "has-selection")}>
                  {turn.directions.map((direction, index) => (
                    <DirectionCard
                      key={`${direction.name}-${index}`}
                      direction={direction}
                      index={index}
                      selected={selectedDirection === index}
                      busy={creating || isSending}
                      onChoose={() => chooseDirection(direction, index)}
                      onRefine={() => beginRefine(direction.name)}
                    />
                  ))}
                  <button
                    type="button"
                    disabled={creating || isSending}
                    onClick={() => send(t("anotherMsg"), null)}
                    className="direction-another focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40"
                  >
                    <span aria-hidden>↗</span>
                    {t("showAnother")}
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      <div className="relative z-20 shrink-0 px-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-3 md:pb-5 sm:px-7">
        <div className="mx-auto w-full max-w-[760px]">
          {showChoices && <p className="mb-2 px-1 text-xs text-ink-muted">{t("orType")}</p>}
          {refineTarget && (
            <p className="mb-2 px-1 text-xs leading-5 text-ink-secondary">
              {t("refineQuestion", { name: refineTarget })}
            </p>
          )}
          {note && (
            <div className="mb-2 flex items-center gap-3 px-1" role="status">
              <p className="text-xs text-danger">{note}</p>
              {started && (
                <button
                  type="button"
                  onClick={() => generationRetry
                    ? chooseDirection(generationRetry.direction, generationRetry.index)
                    : retry()}
                  disabled={isSending || creating}
                  className="text-xs font-semibold text-accent hover:underline disabled:opacity-50"
                >
                  {t("retry")}
                </button>
              )}
            </div>
          )}
          <Composer
            ref={textareaRef}
            value={input}
            placeholder={refineTarget ? t("refinePlaceholder") : t("placeholder")}
            sendLabel={t("send")}
            disabled={isSending || creating}
            onChange={setInput}
            onSend={() => send(input)}
          />
        </div>
      </div>

      {creating && selectedDirection !== null && turn?.phase === "propose" && (
        <CreationTransition
          direction={turn.directions[selectedDirection]}
          phase={creationPhase}
        />
      )}
    </div>
  );
}

interface ComposerProps {
  value: string;
  placeholder: string;
  sendLabel: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
}

const Composer = forwardRef<HTMLTextAreaElement, ComposerProps>(function Composer(
  { value, placeholder, sendLabel, disabled, onChange, onSend }: ComposerProps,
  ref: React.ForwardedRef<HTMLTextAreaElement>
) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSend();
      }}
      className="ventrio-composer"
    >
      <textarea
        ref={ref}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        rows={1}
        maxLength={2000}
        placeholder={placeholder}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onSend();
          }
        }}
        className="max-h-36 min-h-[34px] min-w-0 flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] leading-6 text-ink placeholder:text-ink-muted focus:outline-none disabled:opacity-50"
      />
      <button
        type="submit"
        aria-label={sendLabel}
        disabled={disabled || value.trim().length === 0}
        className="composer-send press-scale focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-25"
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
          <path d="M10 15.5v-11m0 0L5.5 9M10 4.5 14.5 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </form>
  );
});

function ChoiceGrid({
  choices,
  multiple,
  selected,
  busy,
  onPick,
  onContinue,
}: {
  choices: CreationChoice[];
  multiple: boolean;
  selected: string[];
  busy: boolean;
  onPick: (choice: CreationChoice) => void;
  onContinue: () => void;
}) {
  const t = useTranslations("create");
  return (
    <div className="emergence flex flex-col gap-3" aria-label={t("choicesLabel")}>
      {multiple && <p className="text-xs font-medium text-ink-muted">{t("chooseSeveral")}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        {choices.map((choice, index) => {
          const active = selected.includes(choice.id);
          return (
            <button
              key={choice.id}
              type="button"
              disabled={busy}
              aria-pressed={multiple ? active : undefined}
              onClick={() => onPick(choice)}
              className={cn("context-choice", active && "is-selected")}
              style={{ animationDelay: `${index * 55}ms` }}
            >
              <span className="choice-indicator" aria-hidden>{active ? "✓" : String(index + 1).padStart(2, "0")}</span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">{choice.title}</span>
                {choice.description && <span className="mt-0.5 block text-xs leading-5 text-ink-muted">{choice.description}</span>}
              </span>
            </button>
          );
        })}
      </div>
      {multiple && (
        <button type="button" disabled={busy || selected.length === 0} onClick={onContinue} className="primary-action w-fit disabled:opacity-35">
          {t("continueChoices")} <span aria-hidden>→</span>
        </button>
      )}
    </div>
  );
}

function DirectionCard({
  direction,
  index,
  selected,
  busy,
  onChoose,
  onRefine,
}: {
  direction: CreationDirection;
  index: number;
  selected: boolean;
  busy: boolean;
  onChoose: () => void;
  onRefine: () => void;
}) {
  const t = useTranslations("create");
  return (
    <article
      className={cn("direction-card", selected && "is-selected")}
      style={{ animationDelay: `${index * 110}ms` }}
    >
      <div className="direction-index" aria-hidden>{String(index + 1).padStart(2, "0")}</div>
      <h2 className="ventrio-display mt-8 text-[1.65rem] leading-none text-ink">{direction.name}</h2>
      <p className="mt-3 text-sm leading-6 text-ink-secondary">{direction.concept}</p>
      <dl className="mt-6 grid gap-4">
        <DirectionDetail label={t("cardFor")} value={direction.forWho} />
        <DirectionDetail label={t("cardCreates")} value={direction.creates} />
        <DirectionDetail label={t("cardWhyFits")} value={direction.whyFits} />
      </dl>
      <div className="mt-7 flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy} onClick={onChoose} className="primary-action disabled:opacity-35">
          {t("buildThis")} <span aria-hidden>→</span>
        </button>
        <button type="button" disabled={busy} onClick={onRefine} className="quiet-action disabled:opacity-40">
          {t("refine")}
        </button>
      </div>
    </article>
  );
}

function DirectionDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-t border-white/[0.055] pt-3">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">{label}</dt>
      <dd className="text-[13px] leading-5 text-ink">{value}</dd>
    </div>
  );
}

function CreationTransition({ direction, phase }: { direction: CreationDirection; phase: CreationPhase }) {
  const t = useTranslations("create");
  return (
    <div className="creation-transition fixed inset-0 z-[90] flex items-center justify-center px-5" role="status" aria-live="polite">
      <div className="creation-transition-field" aria-hidden />
      <div className="relative flex w-full max-w-lg flex-col items-center text-center">
        <span className="creation-orbit" aria-hidden><span /></span>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-accent/80">{direction.name}</p>
        <h2 className="ventrio-display mt-3 text-[clamp(2.4rem,10vw,4.6rem)] leading-[0.98] text-ink">{t("makeReal")}</h2>
        <div className="mt-9 grid w-full max-w-sm gap-3 text-left">
          <TransitionStep label={t("step1")} state="done" />
          <TransitionStep label={t("step2")} state={phase === "persisting" || phase === "generating" ? "active" : "done"} />
          <TransitionStep label={t("step3")} state={phase === "handoff" ? "active" : "waiting"} />
        </div>
      </div>
    </div>
  );
}

function TransitionStep({ label, state }: { label: string; state: "done" | "active" | "waiting" }) {
  return (
    <div className={cn("transition-step", `is-${state}`)}>
      <span className="transition-step-mark" aria-hidden>{state === "done" ? "✓" : ""}</span>
      <span>{label}</span>
    </div>
  );
}
