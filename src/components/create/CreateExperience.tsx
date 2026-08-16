"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  ensureCreationDraftAction,
  generateCreationTurnAction,
  selectCreationDirectionAction,
} from "@/lib/actions/creation";
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
import { UserTurn } from "@/components/build/ConversationTurn";

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
  /**
   * The person's own idea, offered as a direction after discovery failed.
   *
   * Offered rather than taken. Retry is still the first thing next to the note,
   * because a transient provider failure usually clears — but nobody has to sit
   * through an outage to start a project, and everything this produces is
   * editable in the workspace afterwards.
   */
  const [fallbackDirection, setFallbackDirection] = useState<CreationDirection | null>(null);
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

  function chooseDirection(direction: CreationDirection, index: number) {
    if (creating || isSending || !projectId || selectionLockRef.current) return;
    selectionLockRef.current = true;
    setSelectedDirection(index);
    setGenerationRetry(null);
    setFallbackDirection(null);
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

        /**
         * Choosing a direction chooses a direction. It does not build.
         *
         * This used to call `generateFirstVersionAction` here, so a click on one
         * of the proposal rows claimed a job and reserved a unit before anybody
         * had been asked what to build. The workspace then opened on top of a
         * generation already in flight and asked "Что Ventrio создаст?" over it
         * — a question whose answer could no longer change anything — and asked
         * it a second time when the job finished, in the gap before the fresh
         * props arrived. That is the parallel path: two flows starting the same
         * project, one of them without being asked.
         *
         * The direction is persisted and the person is handed to the workspace,
         * which asks the remaining question and starts the generation when it is
         * answered. Every transition from here on follows a click.
         */
        try {
          window.localStorage.removeItem(storageKey);
        } catch {
          // Non-fatal: the selected project is already persisted.
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
    setFallbackDirection(null);
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
          // Discovery failed. If the server could make a direction out of what
          // they wrote, say so and offer it beside Retry.
          if (result.fallbackDirection) {
            setFallbackDirection(result.fallbackDirection);
            setNote(t("fallbackNote"));
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

        /**
         * A proposal ends the turn. It never starts a generation.
         *
         * This used to read the message for build intent — "просто сделай",
         * "just build it" — and, when it found one, take `directions[0]` and
         * generate in the same tick. The reasoning was that someone who has
         * handed over the decision should not be asked to choose again.
         *
         * In practice it meant three options appeared, were readable for about
         * a second, and then vanished into a generation of the first one. The
         * person saw a choice being offered and taken away from them, and the
         * thing being built was whichever direction the model happened to rank
         * first — a decision nobody made.
         *
         * Build intent is still honoured where it belongs: the guide reads it
         * and answers with a proposal instead of another question. Choosing
         * between what it proposed is the one step that stays with the person.
         */
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


  function beginRefine(name: string) {
    if (creating || isSending) return;
    setNote(null);
    setNoteIsLimitReached(false);
    setGenerationRetry(null);
    setFallbackDirection(null);
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

      <div ref={scrollRef} className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className={cn("mx-auto flex min-h-full w-full max-w-[720px] flex-col px-3.5 sm:px-7", started ? "py-5 sm:py-10" : "py-5 sm:py-9")}>
          {!started ? (
            /* The empty state, as software rather than marketing.
               This was a landing page inside the product: an "IDEA →
               POSSIBILITY" eyebrow, a headline at clamp(2.35rem, 8vw, 5.2rem)
               — up to 83px, in the display face — a subhead, and five full-width
               rows. On a phone that is a hero to scroll past before the one
               thing you came to do, and it reads as an advertisement for a
               product you have already opened.
               What remains is the question, the composer, and the five starting
               points as chips: the same guidance for a first-time user, at the
               weight of a suggestion rather than a billboard. */
            /* The empty state IS the conversation's first turn.
               It was a hero, then a heading over a hint over a row of chips —
               which real-device QA still called empty, generic and visually
               weak, because it was a form waiting to be filled rather than
               something that had said anything.
               It now renders in exactly the language every assistant turn uses:
               same measure, same size, same rhythm. Ventrio opens by asking,
               the chips are that turn's own suggestions, and the person answers
               in the composer below. From the first pixel there is one
               conversation rather than a screen that becomes one. */
            /* THE OPENING OF THE PRODUCT, and now it is sized like one.
               The question was 17px semibold with a 15px hint under it, which
               is the size of a form label — on the screen a person reaches
               first, after deciding to make something. It is display type now,
               centred in the empty conversation, and it is the only thing on
               the screen until they answer.

               The starting points are lines, not capsules. A row of pills reads
               as a filter bar — a set of ways to narrow something that is
               already there — and these are openings. */
            <section className="flex w-full flex-col gap-8 pt-4">
              <div className="s-enter flex flex-col gap-4">
                <p className="s-opening max-w-[20ch]">{t("emptyPrompt")}</p>
                <p className="s-body max-w-md">{t("emptyHint")}</p>
              </div>

              {/* This turn's suggestions, and the only ones on the screen.
                  They belong to the opening question, so they disappear the
                  moment the conversation starts — unlike the three standing
                  buttons that used to sit above the composer forever. */}
              <div className="s-enter flex flex-col items-start gap-0.5">
                {STARTING_POINTS.map((point) => (
                  <button
                    key={point.id}
                    type="button"
                    disabled={isSending || creating}
                    onClick={() => pickStartingPoint(point)}
                    className="group -mx-2 flex min-h-[44px] w-full items-center gap-3 rounded-[var(--r-md)] px-2 text-left text-[15px] transition-colors disabled:opacity-50"
                    style={{ color: "var(--color-ink-secondary)", transitionDuration: "var(--t-fast)" }}
                  >
                    <span
                      aria-hidden
                      className="text-[13px] transition-transform group-hover:translate-x-0.5"
                      style={{ color: "var(--color-accent)" }}
                    >
                      →
                    </span>
                    {t(point.labelKey)}
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <section className="flex flex-col gap-6">
              {/* No `settled-state`: it dimmed the entire conversation to 24%
                  the moment options appeared, so the message explaining them
                  faded out exactly when it was needed. */}
              <div className="flex flex-col gap-5">
                {messages.map((message, index) => {
                  const isLatestAssistant = message.role === "assistant" && index === messages.length - 1;
                  return message.role === "user" ? (
                    <UserTurn key={index}>{message.content}</UserTurn>
                  ) : (
                    <div key={index} className="animate-message-in flex max-w-[720px] flex-col gap-2.5">
                      {/* A message, at message size.
                          The latest assistant turn used to be promoted to
                          display type — clamp(1.75rem, 5vw, 3rem) in the
                          display face — whenever it carried a proposal. It read
                          as a landing-page headline announcing the options
                          rather than as the assistant saying something, and on
                          a phone one sentence filled the screen. Every turn now
                          uses the same size and weight, which is what makes the
                          conversation read as a conversation. */}
                      <div className="whitespace-pre-wrap text-[15px] leading-[1.65] text-ink">
                        {message.content}
                      </div>

                      {/* The options this message offered, under this message.
                          They used to render as a separate block after the whole
                          conversation, which made them read as navigation that
                          happened to be nearby rather than as part of what the
                          assistant just said. Nothing times them out: they stay
                          until they are used, until the conversation moves on,
                          or until a newer assistant message replaces them. */}
                      {isLatestAssistant && showChoices && (
                        <ChoiceGrid
                          choices={turn.choices}
                          multiple={turn.choiceMode === "multiple"}
                          selected={selectedChoices}
                          busy={isSending || creating}
                          onPick={pickChoice}
                          onContinue={submitMultipleChoices}
                        />
                      )}

                      {isLatestAssistant && showDirections && (
                        <div className="choice-stack">
                          {turn.directions.map((direction, directionIndex) => (
                            <DirectionRow
                              key={`${direction.name}-${directionIndex}`}
                              direction={direction}
                              index={directionIndex}
                              selected={selectedDirection === directionIndex}
                              busy={creating || isSending}
                              onChoose={() => chooseDirection(direction, directionIndex)}
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
                    </div>
                  );
                })}

                {isSending && (
                  <div className="flex items-center gap-2.5 text-sm text-ink-secondary" aria-live="polite">
                    <span className="creation-signal-dot" aria-hidden />
                    <span key={thinkingStep} className="animate-field-in">{t(THINKING_STEP_KEYS[thinkingStep])}</span>
                  </div>
                )}

                {/* Starting a build reads as one more turn in the conversation.
                    This replaced a full-screen overlay that covered the chat and
                    counted three invented steps — the person lost the thread of
                    what they had been talking about, and the steps described
                    nothing the system had actually reported. Each line below is
                    a state this component is genuinely in: the direction is
                    being saved, the job has been claimed, or we are on the way
                    to the workspace. The workspace picks the story up from the
                    job row itself. */}
                {creating && (
                  <div className="flex items-center gap-2.5 text-sm text-ink-secondary" aria-live="polite" role="status">
                    <span className="creation-signal-dot" aria-hidden />
                    <span className="animate-field-in">
                      {creationPhase === "persisting"
                        ? t("progressPreparing")
                        : creationPhase === "generating"
                          ? t("progressBuilding")
                          : t("progressOpening")}
                    </span>
                  </div>
                )}
              </div>

            </section>
          )}
        </div>
      </div>

      {/* The fade is drawn in the workspace background, not the app canvas —
          the two are different neutrals and the seam shows. */}
      <div
        className="relative z-20 shrink-0 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-6 sm:px-7 md:pb-5"
        style={{ background: "linear-gradient(to top, var(--color-canvas) 68%, transparent)" }}
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
              {/* Second, deliberately. Retrying costs a moment and keeps the
                  conversation; this skips it. The person picks which. */}
              {fallbackDirection && !noteIsLimitReached && (
                <VentrioButton
                  variant="ghost"
                  size="sm"
                  onClick={() => chooseDirection(fallbackDirection, 0)}
                  disabled={isSending || creating}
                  weight="medium" className="text-[13px]"
                >
                  {t("fallbackOffer")}
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
            <p role="alert" className="mt-1.5 px-1 text-[13px]" style={{ color: "var(--color-warning)" }}>
              {tb(voiceErrorKey(voice.error) as never)}
            </p>
          )}
        </div>
      </div>


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
      <div className="choice-stack">
        {choices.map((choice, index) => {
          const active = selected.includes(choice.id);
          return (
            <div key={choice.id} className="choice-row-wrap" style={{ animationDelay: `${index * 45}ms` }}>
              <button
                type="button"
                disabled={busy}
                aria-pressed={multiple ? active : undefined}
                onClick={() => onPick(choice)}
                className={cn("choice-row", active && "is-selected")}
              >
                <span className="choice-row-text">
                  <span className="choice-row-title">{choice.title}</span>
                  {choice.description && <span className="choice-row-hint">{choice.description}</span>}
                </span>
                {active && <span aria-hidden style={{ color: "var(--color-accent)" }}>✓</span>}
              </button>
            </div>
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

/**
 * One proposed direction, as a row.
 *
 * This replaced a card carrying a display-size heading, three labelled detail
 * rows and two buttons. Everything it dropped — who it is for, what Ventrio
 * will create, why it fits — the assistant has already said in the message
 * directly above; repeating it in a card turned an answer into a form. What is
 * left is the name and one line, which is what a person needs to choose.
 *
 * Refine sits beside the row rather than inside it: a button cannot contain a
 * button, and dropping Refine to make the whole row clickable would cost a real
 * action for a rule about clicking.
 */
function DirectionRow({
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
    <div className="choice-row-wrap" style={{ animationDelay: `${index * 45}ms` }}>
      <button
        type="button"
        disabled={busy}
        onClick={onChoose}
        className={cn("choice-row", selected && "is-selected")}
      >
        <span className="choice-row-text">
          <span className="choice-row-title">{direction.name}</span>
          <span className="choice-row-hint">{direction.concept}</span>
        </span>
        {selected && (
          <span className="shrink-0 text-[13px]" style={{ color: "var(--color-accent)" }}>
            {t("buildThis")}
          </span>
        )}
      </button>
      <button type="button" disabled={busy} onClick={onRefine} className="choice-row-aside">
        {t("refine")}
      </button>
    </div>
  );
}


