"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { VentrioQuestionnaire } from "@/components/build/Questionnaire";
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
import { AssistantTurn, UserTurn } from "@/components/build/ConversationTurn";
import { HowItWorks } from "@/components/workspace-ui/HowItWorks";
import { Alert, AlertDescription } from "@/components/ui/shadcn/alert";

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
  /** Arrived via "New project": start clean, whatever is remembered. */
  fresh?: boolean;
}

type CreationPhase = "idle" | "resetting" | "persisting" | "generating" | "handoff";

export function CreateExperience({ userId, initialDraft, fresh = false }: CreateExperienceProps) {
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
  const [refineTarget, setRefineTarget] = useState<string | null>(null);
  const [generationRetry, setGenerationRetry] = useState<{ direction: CreationDirection } | null>(null);
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
      if (fresh) {
        // The server draft was already skipped; the remembered session id is
        // the other half of the same resume and has to go with it, or the next
        // send would attach to the conversation this screen just left behind.
        window.localStorage.removeItem(storageKey);
        // Drop the marker from the address bar so a refresh resumes what is
        // being written now instead of wiping it and starting over again.
        window.history.replaceState(null, "", "/create");
        return;
      }
      if (initialDraft?.sessionId) window.localStorage.setItem(storageKey, initialDraft.sessionId);
    } catch {
      // Server persistence remains authoritative when storage is unavailable.
    }
  }, [fresh, initialDraft?.sessionId, storageKey]);


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

  function chooseDirection(direction: CreationDirection) {
    if (creating || isSending || !projectId || selectionLockRef.current) return;
    selectionLockRef.current = true;
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

  /* The questionnaire collects the selection and submits it, so a choice
     arriving here is already the final answer. */
  function pickChoice(choice: CreationChoice) {
    if (!turn || isSending || creating) return;
    send(choice.title, null);
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

  /**
   * ONE QUESTION AT A TIME, whichever kind it is.
   *
   * Clarifications and direction proposals were two separate presentations
   * with two separate sets of controls. They are the same interaction — "here
   * is what I need to know, here are some answers, or say your own" — so they
   * are assembled into one shape here and rendered by one component.
   */
  // No legend here: the assistant's message is rendered directly above this
  // surface and already asks the question.
  const askQuestion = undefined;
  const askOptions = showDirections
    ? (turn?.directions ?? []).map((direction, index) => ({
        id: String(index),
        label: direction.name,
        hint: direction.concept,
      }))
    : (turn?.choices ?? []).map((choice) => ({
        id: choice.id,
        label: choice.title,
        hint: choice.description ?? undefined,
      }));

  /**
   * One answer, whichever kind of question asked it.
   *
   * A typed answer wins over a chosen one: if someone wrote something, that is
   * the more specific reply and the choices were only suggestions. For a
   * direction proposal a typed answer is a refinement of the direction they
   * had selected, which is what the old "Refine" link used to set up.
   */
  function onAskAnswer({ ids, text }: { ids: string[]; text: string }) {
    if (text) {
      const named = showDirections ? turn?.directions[Number(ids[0])]?.name ?? null : null;
      send(text, named);
      return;
    }
    if (showDirections) {
      const index = Number(ids[0]);
      const direction = turn?.directions[index];
      if (direction) chooseDirection(direction);
      return;
    }
    if (multipleMode) {
      const answer = (turn?.choices ?? [])
        .filter((choice) => ids.includes(choice.id))
        .map((choice) => choice.title)
        .join(", ");
      if (answer) send(answer, null);
      return;
    }
    const choice = turn?.choices.find((candidate) => candidate.id === ids[0]);
    if (choice) pickChoice(choice);
  }

  const multipleMode = showChoices && turn?.choiceMode === "multiple";


  return (
    /* THE FRONT DOOR OPENS ON THE SKY.
       Nothing has been made yet, so this is the one screen allowed to be purely
       inviting: the colour field, a question in the display face, one generous
       place to answer it. The moment the conversation starts the field is
       dropped and the screen becomes calm paper, because from then on the words
       are the subject. */
    <div
      className={cn(
        "creation-canvas relative flex h-full min-h-0 flex-col",
        !started && "s-sky",
        started && "is-started",
        turn?.transition === "focus" && "is-focused",
      )}
    >

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
            /* THE FIRST SCREEN OF THE PRODUCT.
               It has to answer a question nobody was answering: what IS this?
               Someone who has never written code arrived at a text field and an
               instruction to describe something, with no way to tell whether
               that produced a document, a design, an app, or an invoice.

               So: the question, in the size of somebody asking it; one line
               saying what happens next in words with no jargon in them; the
               five steps, once, because this is the one screen where the person
               may not yet know the shape of the product; and the openings as
               plain lines rather than capsules, because a row of pills reads as
               a filter bar and these are ways to begin. */
            <section className="flex min-h-[58vh] w-full flex-col justify-center gap-8 py-4">
              <div className="s-enter flex flex-col gap-4">
                <p className="s-greet max-w-[16ch]">{t("emptyPrompt")}</p>
                <p className="s-body max-w-md text-[1rem]">{t("emptyHint")}</p>
              </div>

              {/* The openings, as quiet pills on the field. This is the one
                  place a capsule is right: they ARE ways of narrowing an open
                  question, and they read as things you may pick up. */}
              <div className="s-enter flex flex-wrap gap-2">
                {STARTING_POINTS.map((point) => (
                  <button
                    key={point.id}
                    type="button"
                    disabled={isSending || creating}
                    onClick={() => pickStartingPoint(point)}
                    className="s-btn s-btn--secondary text-[14.5px] disabled:opacity-50"
                  >
                    {t(point.labelKey)}
                  </button>
                ))}
              </div>

              <HowItWorks className="s-enter mt-1" />
            </section>
          ) : (
            <section className="flex flex-col gap-6">
              {/* No `settled-state`: it dimmed the entire conversation to 24%
                  the moment options appeared, so the message explaining them
                  faded out exactly when it was needed. */}
              <div className="flex flex-col gap-5">
                {messages.map((message, index) => {
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
                      {/* The same turn component the workspace uses. This
                          block set its own type, so the assistant spoke with a
                          speaker mark in one place and without one here — the
                          drift this component exists to prevent. */}
                      <AssistantTurn>{message.content}</AssistantTurn>

                      {/* The options this message offered are NOT rendered
                          here any more. In the transcript they scrolled away
                          from the composer and read as navigation sitting near
                          a message; they are a strip docked above the composer
                          now, which is where the answer is going to be typed.
                          See Questionnaire, which the composer expands into. */}

                      {/* Directions are likewise docked to the composer. */}
                    </div>
                  );
                })}

                {isSending && (
                  <div className="flex items-center gap-2.5 text-sm text-ink-secondary" aria-live="polite">
                    {/* The same three dots the conversation and the preview use. Work in
                        progress looks identical wherever it happens. */}
                    <span className="s-thinking flex items-center gap-1" aria-hidden>
                      <span />
                      <span />
                      <span />
                    </span>
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
                    {/* The same three dots the conversation and the preview use. Work in
                        progress looks identical wherever it happens. */}
                    <span className="s-thinking flex items-center gap-1" aria-hidden>
                      <span />
                      <span />
                      <span />
                    </span>
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
          {/* QUOTA AND PROVIDER FAILURES ARE AN ALERT, not 12px of red text.
              A used-up monthly allowance and a provider that would not answer
              are the two things that stop the product working, and they were
              being reported in the smallest type on the screen, inline, beside
              the retry. An Alert gives them a surface and keeps the recovery
              actions attached to it. */}
          {note && (
            <Alert variant={noteIsLimitReached ? "default" : "destructive"} className="mb-2">
              <AlertDescription className="flex flex-wrap items-center gap-3">
                <span className="min-w-0 flex-1">{note}</span>
                {started && !noteIsLimitReached && (
                  <VentrioButton
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      generationRetry ? chooseDirection(generationRetry.direction) : retry()
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
                    onClick={() => chooseDirection(fallbackDirection)}
                    disabled={isSending || creating}
                    weight="medium" className="text-[13px]"
                  >
                    {t("fallbackOffer")}
                  </VentrioButton>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* THE OPTIONS SIT IN THE CONVERSATION, ABOVE THE COMPOSER.
              Questionnaire takes the composer as a sibling and renders no
              container of its own, so the order a person reads is the order
              that exists: the assistant's message, then these options, then the
              text box. With no question it returns the composer untouched,
              which is what stops this ever becoming permanent furniture. */}
          <VentrioQuestionnaire
            question={askQuestion}
            options={askOptions}
            multiple={showChoices && turn?.choiceMode === "multiple"}
            disabled={isSending || creating}
            freeformLabel={t("orType")}
            submitLabel={t("continueChoices")}
            onAnswer={onAskAnswer}
            composer={
          <WorkspaceComposer
            hero={!started}
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
            }
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
