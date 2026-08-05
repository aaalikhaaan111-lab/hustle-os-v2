"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
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
import { takeSeed } from "@/lib/create/seed";
import { WorkspaceComposer } from "@/components/workspace-ui/Composer";
import { VentrioButton } from "@/components/ui/VentrioButton";
import { useVoiceInput, voiceErrorKey } from "@/lib/workspace/useVoiceInput";
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

// Short, calm phrases cycled while waiting on the AI — never a percentage or
// a busy loader, just a sense that something specific is happening.
const THINKING_STEP_KEYS = ["thinkingStep1", "thinkingStep2", "thinkingStep3"] as const;

interface CreateExperienceProps {
  userId: string;
  initialDraft: PersistedCreationDraft | null;
}

type CreationPhase = "idle" | "resetting" | "persisting" | "generating" | "handoff";

export function CreateExperience({ userId, initialDraft }: CreateExperienceProps) {
  const t = useTranslations("create");
  const tb = useTranslations("build");
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
  // A limit-reached note is permanent for this account, not a transient
  // failure — hides the "Retry" button so it doesn't offer a retry that can
  // only fail again the same way.
  const [noteIsLimitReached, setNoteIsLimitReached] = useState(false);
  const [selectedDirection, setSelectedDirection] = useState<number | null>(null);
  const [selectedChoices, setSelectedChoices] = useState<string[]>([]);
  const [refineTarget, setRefineTarget] = useState<string | null>(null);
  const [generationRetry, setGenerationRetry] = useState<{ direction: CreationDirection; index: number } | null>(null);
  const [creationPhase, setCreationPhase] = useState<CreationPhase>("idle");
  const [isSending, startSending] = useTransition();
  const [thinkingStep, setThinkingStep] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selectionLockRef = useRef(false);
  const started = messages.length > 0;
  const creating = creationPhase !== "idle";

  useEffect(() => {
    if (!isSending) {
      queueMicrotask(() => setThinkingStep(0));
      return;
    }
    const id = setInterval(() => {
      setThinkingStep((step) => (step + 1) % THINKING_STEP_KEYS.length);
    }, 2200);
    return () => clearInterval(id);
  }, [isSending]);

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

  /**
   * `sessionOverride` starts this turn in a brand-new creation session.
   *
   * It is passed rather than read from state because the caller has only just
   * called setSessionId: the state update has not committed, so this closure
   * would still see the previous session and quietly continue the old project.
   * When it is given, the captured project and conversation ids are ignored for
   * the same reason.
   */
  function runTurn(
    content: string,
    point: CreationStartingPoint | null,
    requestId: string,
    sessionOverride?: string
  ) {
    setNote(null);
    setNoteIsLimitReached(false);
    setGenerationRetry(null);
    setSelectedChoices([]);
    startSending(async () => {
      try {
        const activeSessionId = sessionOverride ?? getOrCreateSessionId();
        let activeProjectId = sessionOverride ? null : projectId;
        let activeConversationId = sessionOverride ? null : conversationId;
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
          if (result.limitReached) {
            setNote(t("discoveryLimitReached", { limit: result.limitReached.limit }));
            setNoteIsLimitReached(true);
            return;
          }
          setNote(t("unavailable"));
          return;
        }
        setTurn(result.turn);
        setMessages((previous) => [
          ...previous,
          { role: "assistant", content: result.turn.message },
        ]);
        setPendingRequestId(null);
        // The conversation's language is settled by the message, not by the
        // account cookie, so the surrounding chrome may now be in the wrong
        // one. Re-rendering the server component picks up the project's locale
        // — this is what stops Russian answers appearing between English
        // buttons. It runs only on an actual mismatch, so the common case
        // costs nothing.
        if (result.locale !== locale) router.refresh();
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

  // Begin the conversation from a homepage seed — the visitor's first message,
  // carried here through sessionStorage. Idempotent: the draft and message
  // actions are already deduplicated server-side by session and request id.
  //
  // A seed always opens its OWN session, so it becomes its own project and its
  // own conversation. Everything derived from the session id follows: the
  // project id is a hash of it, so a fresh id means a fresh project and any
  // draft already in progress is left exactly as it was.
  function startFromSeed(message: string, point: CreationStartingPoint | null) {
    if (isSending || creating) return;
    const freshSession = crypto.randomUUID();
    setSessionId(freshSession);
    setProjectId(null);
    setConversationId(null);
    try {
      window.localStorage.setItem(storageKey, freshSession);
    } catch {
      // Component state still carries it for this session.
    }
    const requestId = crypto.randomUUID();
    setStartingPoint(point);
    setMessages([{ role: "user", content: message }]);
    setTurn(null);
    setPendingRequestId(requestId);
    runTurn(message, point, requestId, freshSession);
  }

  // Consume a homepage seed exactly once on mount, and always start it.
  //
  // This used to defer to an unfinished draft: with any draft in progress the
  // seed was only dropped into the composer. The effect was that someone who
  // typed an idea on the homepage and signed in landed inside an unrelated
  // older conversation with their sentence sitting unsent in the input — the
  // landing promise silently broken, and the more so the longer the account had
  // been used. Starting a new session instead leaves the old draft untouched
  // and reachable; it is not overwritten, only no longer in the way.
  const seedConsumedRef = useRef(false);
  useEffect(() => {
    if (seedConsumedRef.current) return;
    seedConsumedRef.current = true;
    const seed = takeSeed();
    if (!seed) return;
    queueMicrotask(() => startFromSeed(seed.message, seed.startingPoint));
    // Runs once on mount; startFromSeed and initialDraft are stable for this instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setNoteIsLimitReached(false);

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
          if (generation.limitReached) {
            setNote(t("firstVersionLimitReached"));
            setNoteIsLimitReached(true);
            return;
          }
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
    setNoteIsLimitReached(false);
    setGenerationRetry(null);
    setRefineTarget(name);
    setInput("");
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }

  // The same dictation hook the workspace composers use — one implementation,
  // and the permission request happens inside the click it starts from.
  const voice = useVoiceInput({
    lang: locale === "ru" ? "ru-RU" : "en-US",
    disabled: isSending || creating,
    onTranscript: (text) => setInput((prev) => (prev ? `${prev.trimEnd()} ${text}` : text)),
  });

  const showDirections = turn?.phase === "propose" && turn.directions.length > 0;
  const showChoices = turn?.phase === "ask" && turn.choices.length > 0;

  return (
    <div className={cn("creation-canvas relative flex h-full min-h-0 flex-col", started && "is-started", turn?.transition === "focus" && "is-focused")}>
      <div aria-hidden className="creation-focus-field" />

      <div ref={scrollRef} className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className={cn("mx-auto flex min-h-full w-full max-w-[760px] flex-col px-4 sm:px-7", started ? "py-8 sm:py-12" : "justify-center py-9 sm:py-14")}>
          {!started ? (
            <section className="emergence mx-auto flex w-full flex-col items-center text-center">
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
                      <div
                        className="max-w-[86%] whitespace-pre-wrap rounded-[var(--r-lg)] px-3.5 py-2.5 text-[15px] leading-[1.6]"
                        style={{ background: "var(--sunken)" }}
                      >
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
                  <div className="flex items-center gap-2.5 text-sm text-ink-secondary" aria-live="polite">
                    <span className="creation-signal-dot" aria-hidden />
                    <span key={thinkingStep} className="animate-field-in">{t(THINKING_STEP_KEYS[thinkingStep])}</span>
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

      {/* The fade is drawn in the workspace background, not the app canvas —
          the two are different neutrals and the seam shows. */}
      <div
        className="relative z-20 shrink-0 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-6 sm:px-7 md:pb-5"
        style={{ background: "linear-gradient(to top, var(--canvas) 68%, transparent)" }}
      >
        <div className="mx-auto w-full max-w-[704px]">
          {showChoices && <p className="mb-2 px-1 text-xs text-ink-muted">{t("orType")}</p>}
          {refineTarget && (
            <p className="mb-2 px-1 text-xs leading-5 text-ink-secondary">
              {t("refineQuestion", { name: refineTarget })}
            </p>
          )}
          {note && (
            <div className="mb-2 flex items-center gap-3 px-1" role="status">
              <p className="text-xs text-danger">{note}</p>
              {started && !noteIsLimitReached && (
                <VentrioButton
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    generationRetry ? chooseDirection(generationRetry.direction, generationRetry.index) : retry()
                  }
                  disabled={isSending || creating}
                  weight="medium" className="text-[13px]"
                >
                  {t("retry")}
                </VentrioButton>
              )}
            </div>
          )}
          <WorkspaceComposer
            value={input}
            placeholder={refineTarget ? t("refinePlaceholder") : t("placeholder")}
            sendLabel={t("send")}
            disabled={isSending || creating}
            sending={isSending}
            onChange={setInput}
            onSend={() => send(input)}
            textareaRef={textareaRef}
            listeningLabel={tb("voiceListening")}
            keyboardHint={tb("composerKeys")}
            voice={{
              supported: voice.supported,
              listening: voice.listening,
              state: voice.state,
              onToggle: () => (voice.listening ? voice.stop() : voice.start()),
              label: tb("voiceStart"),
              unsupportedLabel:
                      voice.availability === "insecure"
                        ? tb("voiceInsecure")
                        : tb("voiceUnsupported"),
              requestingLabel: tb("voiceRequesting"),
              listeningLabel: tb("voiceListening"),
            }}
          />
          <p role="status" aria-live="polite" className="sr-only">
            {voice.listening ? tb("voiceListening") : ""}
          </p>
          {voice.error && (
            <p role="alert" className="mt-1.5 px-1 text-[13px]" style={{ color: "var(--warn)" }}>
              {tb(voiceErrorKey(voice.error) as never)}
            </p>
          )}
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
        <VentrioButton
          variant="primary"
          size="sm"
          shape="pill"
          disabled={busy || selected.length === 0}
          onClick={onContinue}
          className="w-fit"
        >
          {t("continueChoices")} <span aria-hidden>→</span>
        </VentrioButton>
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
        <VentrioButton variant="generative" size="sm" shape="pill" disabled={busy} onClick={onChoose}>
          {t("buildThis")} <span aria-hidden>→</span>
        </VentrioButton>
        <VentrioButton variant="ghost" size="sm" shape="pill" disabled={busy} onClick={onRefine}>
          {t("refine")}
        </VentrioButton>
      </div>
    </article>
  );
}

function DirectionDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-t border-border pt-3">
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
