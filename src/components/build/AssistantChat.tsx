"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  sendAssistantMessage,
  startNewConversation,
  type AssistantMessage,
} from "@/lib/actions/assistant";
import { saveStructuredFieldAction } from "@/lib/actions/build";
import type { AssistantProposal } from "@/lib/actions/buildAi";
import { FIELD_TO_LABELKEY, type StructuredField } from "@/lib/build/snapshot";
import { STARTER_PROMPT_KEYS, type AssistantPhase } from "@/lib/build/assistantPrompts";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface AssistantChatProps {
  projectId: string;
  /** Whether the assistant tables are reachable (false → degraded notice). */
  available: boolean;
  /** Preloaded on the server so the chat renders without a second round-trip. */
  initialConversationId: string | null;
  initialMessages: AssistantMessage[];
  phase: AssistantPhase;
  /**
   * Deterministic, project-specific greeting shown while the conversation is
   * still empty. Display-only — never sent to the model or persisted.
   */
  openingMessage: string;
  /** Current saved/displayed value per structured field (for replace warnings). */
  existingValues: Partial<Record<StructuredField, string>>;
  /** Called after a structured field is confirmed and persisted. */
  onFieldSaved: (field: StructuredField, value: string) => void;
}

// The project assistant as an immersive conversation canvas: a wide, readable
// column of editorial messages that scrolls internally, with a persistent
// composer pinned to the bottom. No bordered card, no support-widget chrome.
export function AssistantChat({
  projectId,
  available,
  initialConversationId,
  initialMessages,
  phase,
  openingMessage,
  existingValues,
  onFieldSaved,
}: AssistantChatProps) {
  const t = useTranslations("build");
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialMessages.map((m) => ({ id: m.id, role: m.role, content: m.content }))
  );
  const [input, setInput] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [proposal, setProposal] = useState<AssistantProposal | null>(null);
  const [isSending, startSending] = useTransition();
  const [isSaving, startSaving] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const idCounter = useRef(0);
  const nextId = (prefix: string) => `${prefix}-${(idCounter.current += 1)}`;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isSending, proposal]);

  // Grow the composer with its content (up to a cap) without any layout jump.
  function autosize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }
  useEffect(autosize, [input]);

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isSending || !available) return; // request lock
    setNote(null);
    setFlash(null);
    setProposal(null);
    const optimistic: ChatMessage = { id: nextId("local"), role: "user", content: trimmed };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    startSending(async () => {
      const result = await sendAssistantMessage(projectId, conversationId, trimmed);
      if (result.error) {
        setNote(result.error);
        setInput(trimmed);
        return;
      }
      if (result.conversationId) setConversationId(result.conversationId);
      if (result.unavailableNote) {
        setNote(result.unavailableNote);
        return;
      }
      if (result.reply) {
        setMessages((prev) => [
          ...prev,
          { id: nextId("a"), role: "assistant", content: result.reply as string },
        ]);
      }
      if (result.proposal) setProposal(result.proposal);
    });
  }

  function saveField(field: StructuredField, value: string) {
    if (isSaving) return;
    setNote(null);
    setFlash(null);
    startSaving(async () => {
      const res = await saveStructuredFieldAction(projectId, field, value);
      if (res.error) {
        setNote(res.error);
        return;
      }
      if (res.saved) {
        onFieldSaved(res.saved.field, res.saved.value);
        setProposal(null);
        setFlash(t("proposalSaved"));
      }
    });
  }

  function handleNewConversation() {
    if (isSending) return;
    startSending(async () => {
      const result = await startNewConversation(projectId);
      if (result.error) {
        setNote(result.error);
        return;
      }
      setConversationId(result.conversationId);
      setMessages([]);
      setProposal(null);
      setNote(null);
      setFlash(null);
    });
  }

  // 3 stage-relevant prompts, offered only while the conversation is empty so
  // they never become permanent generic chrome.
  const starters = STARTER_PROMPT_KEYS[phase].slice(0, 3);
  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Conversation */}
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto">
        {!isEmpty && available && (
          <button
            type="button"
            onClick={handleNewConversation}
            disabled={isSending}
            className="sticky top-2 z-10 ml-auto mr-3 flex w-fit items-center gap-1 rounded-full border border-border bg-surface/80 px-2.5 py-1 text-[11px] font-semibold text-ink-secondary backdrop-blur transition-colors hover:bg-surface disabled:opacity-60"
          >
            {t("assistantNewChat")}
          </button>
        )}

        <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-8">
          {!available ? (
            <p className="text-sm tracking-tight text-ink-secondary">{t("assistantUnavailable")}</p>
          ) : isEmpty ? (
            <p className="animate-rise-in whitespace-pre-wrap text-[17px] font-medium leading-8 tracking-tight text-ink">
              {openingMessage}
            </p>
          ) : (
            <div className="flex flex-col gap-6">
              {messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="animate-message-in flex justify-end">
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-[15px] leading-relaxed text-accent-foreground shadow-[0_8px_24px_-10px_rgba(93,107,255,0.6)]">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div
                    key={m.id}
                    className="animate-message-in whitespace-pre-wrap text-[15px] leading-7 tracking-tight text-ink"
                  >
                    {m.content}
                  </div>
                )
              )}
              {isSending && (
                <div className="flex items-center gap-1 text-ink-muted" aria-label="…">
                  <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-ink-muted" />
                  <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-ink-muted [animation-delay:0.2s]" />
                  <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-ink-muted [animation-delay:0.4s]" />
                </div>
              )}
            </div>
          )}

          {proposal && (
            <div className="mt-6">
              <ProposalCard
                proposal={proposal}
                existing={existingValues[proposal.field] ?? null}
                disabled={isSaving}
                onSave={(value) => saveField(proposal.field, value)}
                onImprove={() => {
                  const label = proposal.label;
                  setProposal(null);
                  submit(t("proposalImproveMsg", { label }));
                }}
                onDismiss={() => setProposal(null)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0 bg-gradient-to-t from-canvas via-canvas/95 to-transparent">
        <div className="mx-auto w-full max-w-2xl px-4 pt-2 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-4">
          {isEmpty && available && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {starters.map((key) => (
                <button
                  key={key}
                  type="button"
                  disabled={isSending}
                  onClick={() => submit(t(key as Parameters<typeof t>[0]))}
                  className="rounded-full border border-border bg-surface/70 px-3 py-1.5 text-[13px] font-medium text-ink-secondary transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
                >
                  {t(key as Parameters<typeof t>[0])}
                </button>
              ))}
            </div>
          )}
          {note && <p className="mb-1.5 px-1 text-xs text-danger">{note}</p>}
          {flash && <p className="mb-1.5 px-1 text-xs font-semibold text-success">{flash}</p>}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(input);
            }}
            className="flex items-end gap-2 rounded-2xl border border-border bg-surface/95 px-2.5 py-2 shadow-sm transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isSending || !available}
              rows={1}
              placeholder={t("assistantPlaceholder")}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit(input);
                }
              }}
              className="max-h-40 min-h-[28px] flex-1 resize-none bg-transparent px-1.5 py-1 text-[15px] text-ink placeholder:text-ink-muted focus:outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              aria-label={t("assistantSend")}
              disabled={isSending || !available || input.trim().length === 0}
              className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition-opacity hover:bg-accent-hover disabled:opacity-30"
            >
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
                <path
                  d="M10 16V4M10 4l-5 5M10 4l5 5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

interface ProposalCardProps {
  proposal: AssistantProposal;
  /** The field's current saved value, or null when it isn't set yet. */
  existing: string | null;
  disabled: boolean;
  onSave: (value: string) => void;
  onImprove: () => void;
  onDismiss: () => void;
}

// A refined proposal, rendered natively inside the conversation (not a modal).
// Nothing is written until the user confirms; when a value already exists the
// card asks whether to replace it.
function ProposalCard({ proposal, existing, disabled, onSave, onImprove, onDismiss }: ProposalCardProps) {
  const t = useTranslations("build");
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(proposal.value);
  const fieldName = t(FIELD_TO_LABELKEY[proposal.field] as Parameters<typeof t>[0]);
  const canSave = value.trim().length > 0 && !disabled;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-accent/20 bg-accent-soft/50 p-4">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-accent">
        {t("proposalEyebrow", { field: proposal.label || fieldName })}
      </span>

      {editing ? (
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={3}
          maxLength={800}
          className="w-full resize-none rounded-xl border border-border bg-surface px-3 py-2 text-[15px] text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
      ) : (
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{value}</p>
      )}

      {existing && !editing && (
        <p className="text-xs font-medium text-warning">{t("proposalReplaceWarning", { field: fieldName })}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canSave}
          onClick={() => onSave(value)}
          className="rounded-full bg-accent px-4 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
        >
          {existing ? t("proposalReplace") : t("proposalSave")}
        </button>
        {!editing && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setEditing(true)}
            className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-[13px] font-semibold text-ink-secondary transition-colors hover:bg-surface-hover disabled:opacity-60"
          >
            {t("proposalEdit")}
          </button>
        )}
        <button
          type="button"
          disabled={disabled}
          onClick={onImprove}
          className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-[13px] font-semibold text-ink-secondary transition-colors hover:bg-surface-hover disabled:opacity-60"
        >
          {t("proposalImprove")}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onDismiss}
          className="rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-ink-muted transition-colors hover:bg-surface-hover disabled:opacity-60"
        >
          {existing ? t("proposalKeep") : t("proposalDismiss")}
        </button>
      </div>
    </div>
  );
}
