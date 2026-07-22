"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  generateCreationTurnAction,
  createProjectFromDirectionAction,
} from "@/lib/actions/creation";
import {
  type CreationDirection,
  type CreationMessage,
  type CreationStartingPoint,
  type CreationTurn,
} from "@/lib/build/creationTypes";

// Optional first-screen shortcuts. Each seeds a natural first message; the AI
// takes it from there. Not a form — the user can also just type.
const STARTING_POINTS: {
  id: CreationStartingPoint;
  labelKey: "spHobby" | "spSkill" | "spIdea" | "spProblem" | "spUnsure";
  msgKey: "spHobbyMsg" | "spSkillMsg" | "spIdeaMsg" | "spProblemMsg" | "spUnsureMsg";
  emoji: string;
}[] = [
  { id: "hobby", labelKey: "spHobby", msgKey: "spHobbyMsg", emoji: "🎯" },
  { id: "skill", labelKey: "spSkill", msgKey: "spSkillMsg", emoji: "🛠️" },
  { id: "idea", labelKey: "spIdea", msgKey: "spIdeaMsg", emoji: "💡" },
  { id: "problem", labelKey: "spProblem", msgKey: "spProblemMsg", emoji: "🔍" },
  { id: "unsure", labelKey: "spUnsure", msgKey: "spUnsureMsg", emoji: "🤔" },
];

const CREATION_STEP_KEYS = ["step1", "step2", "step3"] as const;

interface CreateExperienceProps {
  /** Scopes the saved draft so a shared browser never mixes two users' drafts. */
  userId: string;
}

interface CreationDraft {
  v: 1;
  messages: CreationMessage[];
  turn: CreationTurn | null;
  startingPoint: CreationStartingPoint | null;
}

export function CreateExperience({ userId }: CreateExperienceProps) {
  const t = useTranslations("create");
  const locale = useLocale();
  const router = useRouter();

  const storageKey = `ventrio:create:${userId}`;

  const [messages, setMessages] = useState<CreationMessage[]>([]);
  const [turn, setTurn] = useState<CreationTurn | null>(null);
  const [startingPoint, setStartingPoint] = useState<CreationStartingPoint | null>(null);
  const [input, setInput] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [isSending, startSending] = useTransition();

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const started = messages.length > 0;

  // ── Draft persistence (survives refresh / accidental navigation) ──
  // Loaded after mount, not via a lazy initializer: localStorage isn't readable
  // during SSR, and reading it in the initializer would hydrate-mismatch the
  // server's empty render. Syncing React state from an external store on mount
  // is exactly this effect's job, so the set-state-in-effect rule is disabled.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const draft = JSON.parse(raw) as CreationDraft;
        if (draft?.v === 1 && Array.isArray(draft.messages)) {
          setMessages(draft.messages);
          setTurn(draft.turn ?? null);
          setStartingPoint(draft.startingPoint ?? null);
        }
      }
    } catch {
      // Corrupt draft — ignore and start fresh.
    }
    setHydrated(true);
  }, [storageKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (messages.length === 0) {
        window.localStorage.removeItem(storageKey);
      } else {
        const draft: CreationDraft = { v: 1, messages, turn, startingPoint };
        window.localStorage.setItem(storageKey, JSON.stringify(draft));
      }
    } catch {
      // Storage unavailable (private mode / quota) — non-fatal.
    }
  }, [hydrated, messages, turn, startingPoint, storageKey]);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }
  useEffect(scrollToBottom, [messages, turn, isSending]);

  function autosize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }
  useEffect(autosize, [input]);

  // Cycle the creation status lines while the single create action runs.
  useEffect(() => {
    if (!creating) return;
    const id = setInterval(() => setStepIdx((i) => (i + 1) % CREATION_STEP_KEYS.length), 1100);
    return () => clearInterval(id);
  }, [creating]);

  // Runs one AI turn over the given history (already includes any new user msg).
  function runTurn(history: CreationMessage[]) {
    setNote(null);
    setSelected(null);
    startSending(async () => {
      const result = await generateCreationTurnAction(history, locale);
      if (!result.ok) {
        setNote(t("unavailable"));
        return;
      }
      setTurn(result.turn);
      setMessages((prev) => [...prev, { role: "assistant", content: result.turn.message }]);
    });
  }

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isSending || creating) return;
    const next: CreationMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setTurn(null);
    runTurn(next);
  }

  function retry() {
    if (isSending || creating || messages.length === 0) return;
    runTurn(messages);
  }

  function pickStartingPoint(sp: (typeof STARTING_POINTS)[number]) {
    if (isSending || creating) return;
    setStartingPoint(sp.id);
    send(t(sp.msgKey));
  }

  function chooseDirection(direction: CreationDirection, index: number) {
    if (creating || isSending) return;
    setSelected(index);
    setCreating(true);
    setStepIdx(0);
    setNote(null);
    (async () => {
      const result = await createProjectFromDirectionAction(direction, { startingPoint });
      if (result.error || !result.projectId) {
        setCreating(false);
        setSelected(null);
        setNote(result.error ?? t("errorSaveFailed"));
        return;
      }
      // Clear the draft so a new /create visit starts fresh, then hand off.
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        /* non-fatal */
      }
      router.push(`/projects/${result.projectId}`);
    })();
  }

  const showDirections = turn?.phase === "propose" && turn.directions.length > 0;
  const showChips = turn?.phase === "ask" && turn.chips.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Scroll surface */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-6 sm:pt-10">
          {!started ? (
            <div className="animate-rise-in flex flex-col gap-3">
              <span className="inline-flex w-fit items-center rounded-full bg-accent-soft px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-accent ring-1 ring-inset ring-accent/20">
                {t("eyebrow")}
              </span>
              <h1 className="text-[1.7rem] font-black leading-[1.1] tracking-[-0.02em] text-ink sm:text-4xl">
                {t("headline")}
              </h1>
              <p className="max-w-lg text-sm leading-relaxed tracking-tight text-ink-secondary sm:text-base">
                {t("subhead")}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="animate-message-in flex justify-end">
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-[15px] leading-relaxed text-accent-foreground shadow-[0_8px_24px_-10px_rgba(93,107,255,0.6)]">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div
                    key={i}
                    className="animate-message-in whitespace-pre-wrap text-[16px] leading-7 tracking-tight text-ink"
                  >
                    {m.content}
                  </div>
                )
              )}

              {isSending && (
                <div className="flex items-center gap-2.5 text-ink-secondary" aria-live="polite">
                  <span className="relative flex h-4 w-4 items-center justify-center">
                    <span className="absolute h-4 w-4 animate-pulse-soft rounded-full bg-accent/30 blur-[3px]" />
                    <span className="h-2 w-2 rounded-full bg-accent" />
                  </span>
                  <span className="text-[14px] tracking-tight">{t("thinking")}</span>
                </div>
              )}

              {showDirections && (
                <div className="flex flex-col gap-3">
                  {turn!.directions.map((direction, index) => (
                    <DirectionCard
                      key={index}
                      direction={direction}
                      index={index}
                      selected={selected === index}
                      busy={creating || isSending}
                      onChoose={() => chooseDirection(direction, index)}
                      onRefine={() => send(t("refineMsg", { name: direction.name }))}
                      onAnother={() => send(t("anotherMsg"))}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Composer + chips */}
      <div className="shrink-0 bg-gradient-to-t from-canvas via-canvas/95 to-transparent">
        <div className="mx-auto w-full max-w-2xl px-4 pt-2 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-4">
          {!started && (
            <div className="mb-2.5 flex flex-wrap gap-2">
              {STARTING_POINTS.map((sp) => (
                <button
                  key={sp.id}
                  type="button"
                  disabled={isSending || creating}
                  onClick={() => pickStartingPoint(sp)}
                  className="press-scale flex items-center gap-1.5 rounded-full border border-border bg-surface/70 px-3 py-1.5 text-[13px] font-medium text-ink-secondary transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
                >
                  <span aria-hidden>{sp.emoji}</span>
                  {t(sp.labelKey)}
                </button>
              ))}
            </div>
          )}

          {showChips && (
            <div className="mb-2.5 flex flex-wrap gap-2">
              {turn!.chips.map((chip, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={isSending || creating}
                  onClick={() => send(chip)}
                  className="press-scale rounded-full border border-border bg-surface/70 px-3 py-1.5 text-[13px] font-medium text-ink-secondary transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {note && (
            <div className="mb-1.5 flex items-center gap-3 px-1">
              <p className="text-xs text-danger">{note}</p>
              {started && (
                <button
                  type="button"
                  onClick={retry}
                  disabled={isSending || creating}
                  className="text-xs font-semibold text-accent underline-offset-2 hover:underline disabled:opacity-60"
                >
                  {t("retry")}
                </button>
              )}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-end gap-2 rounded-2xl border border-border bg-surface/95 px-2.5 py-2 shadow-sm transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isSending || creating}
              rows={1}
              placeholder={t("placeholder")}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              className="max-h-40 min-h-[28px] flex-1 resize-none bg-transparent px-1.5 py-1 text-[15px] text-ink placeholder:text-ink-muted focus:outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              aria-label={t("send")}
              disabled={isSending || creating || input.trim().length === 0}
              className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition-opacity hover:bg-accent-hover disabled:opacity-30"
            >
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
                <path d="M10 16V4M10 4l-5 5M10 4l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>
        </div>
      </div>

      {/* Creation transition — a real step sequence tied to project persistence. */}
      {creating && (
        <div className="animate-overlay-in fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(4,5,10,0.72)] px-6 backdrop-blur-md">
          <div className="animate-rise-in flex w-full max-w-sm flex-col items-center gap-5 text-center">
            <span className="relative flex h-12 w-12 items-center justify-center">
              <span className="absolute h-12 w-12 animate-pulse-soft rounded-full bg-accent/30 blur-md" />
              <span className="h-3.5 w-3.5 rounded-full bg-accent" />
            </span>
            <div key={stepIdx} className="animate-rise-in text-[17px] font-semibold tracking-tight text-ink">
              {t(CREATION_STEP_KEYS[stepIdx])}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface DirectionCardProps {
  direction: CreationDirection;
  index: number;
  selected: boolean;
  busy: boolean;
  onChoose: () => void;
  onRefine: () => void;
  onAnother: () => void;
}

// A premium, visually distinct direction card — deliberately not styled like an
// ordinary assistant message. Reveals with a short staggered pop.
function DirectionCard({ direction, index, selected, busy, onChoose, onRefine, onAnother }: DirectionCardProps) {
  const t = useTranslations("create");
  return (
    <div
      className="animate-pop-in rounded-2xl border p-4 transition-all duration-200 ease-out"
      style={{
        animationDelay: `${index * 90}ms`,
        borderColor: selected ? "rgba(93,107,255,0.55)" : "rgba(255,255,255,0.09)",
        background: selected ? "rgba(93,107,255,0.10)" : "rgba(255,255,255,0.02)",
        boxShadow: selected ? "0 0 30px -8px rgba(93,107,255,0.5)" : undefined,
      }}
    >
      <h3 className="text-lg font-black tracking-tight text-ink">{direction.name}</h3>
      <p className="mt-1 text-sm leading-relaxed text-ink-secondary">{direction.concept}</p>

      <dl className="mt-3 flex flex-col gap-2 border-t border-white/[0.06] pt-3">
        <Row label={t("cardFor")} value={direction.forWho} />
        <Row label={t("cardCreates")} value={direction.creates} />
        <Row label={t("cardWhyFits")} value={direction.whyFits} />
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onChoose}
          className="press-scale rounded-full bg-accent px-4 py-1.5 text-[13px] font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
        >
          {t("chooseThis")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onRefine}
          className="press-scale rounded-full border border-border bg-surface px-3.5 py-1.5 text-[13px] font-semibold text-ink-secondary transition-colors hover:bg-surface-hover disabled:opacity-60"
        >
          {t("refine")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onAnother}
          className="press-scale rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-ink-muted transition-colors hover:bg-surface-hover disabled:opacity-60"
        >
          {t("showAnother")}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted">{label}</dt>
      <dd className="text-sm text-ink">{value}</dd>
    </div>
  );
}
