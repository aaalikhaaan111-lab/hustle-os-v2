"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
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
   * Deterministic, project-specific greeting shown as the first assistant
   * bubble while the conversation is still empty. Display-only — never sent to
   * the model or persisted.
   */
  openingMessage: string;
  /** Current saved/displayed value per structured field (for replace warnings). */
  existingValues: Partial<Record<StructuredField, string>>;
  /** Called after a structured field is confirmed and persisted. */
  onFieldSaved: (field: StructuredField, value: string) => void;
  className?: string;
}

// The project assistant conversation, rendered inline as the main workspace
// surface (previously a floating drawer). All send/new-chat logic is unchanged
// — only the chrome differs.
export function AssistantChat({
  projectId,
  available,
  initialConversationId,
  initialMessages,
  phase,
  openingMessage,
  existingValues,
  onFieldSaved,
  className,
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
  const idCounter = useRef(0);
  const nextId = (prefix: string) => `${prefix}-${(idCounter.current += 1)}`;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isSending]);

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
        // Keep the user's message visible and restore their text so nothing is lost.
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
      setNote(null);
    });
  }

  const starters = STARTER_PROMPT_KEYS[phase];
  const isEmpty = messages.length === 0;

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {/* Header row */}
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-xs" aria-hidden>
          🤖
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[13px] font-bold tracking-tight text-ink">{t("assistantTitle")}</span>
          <span className="truncate text-[11px] leading-tight text-ink-muted">{t("assistantScope")}</span>
        </div>
        {!isEmpty && available && (
          <button
            type="button"
            onClick={handleNewConversation}
            disabled={isSending}
            className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-ink-secondary transition-colors hover:bg-surface-hover disabled:opacity-60"
          >
            {t("assistantNewChat")}
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {!available ? (
          <p className="text-sm tracking-tight text-ink-secondary">{t("assistantUnavailable")}</p>
        ) : isEmpty ? (
          <div className="flex flex-col gap-4">
            <div className="max-w-[90%] self-start rounded-2xl bg-surface-hover px-3.5 py-2.5 text-sm leading-relaxed tracking-tight text-ink">
              {openingMessage}
            </div>
            <div className="flex flex-col gap-2">
              {starters.map((key) => (
                <button
                  key={key}
                  type="button"
                  disabled={isSending}
                  onClick={() => submit(t(key as Parameters<typeof t>[0]))}
                  className="rounded-2xl border border-zinc-100/70 bg-white/70 px-3.5 py-2.5 text-left text-sm font-medium text-ink-secondary shadow-sm transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
                >
                  {t(key as Parameters<typeof t>[0])}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed tracking-tight",
                  m.role === "user"
                    ? "self-end bg-gradient-to-br from-indigo-600 to-purple-600 text-white"
                    : "self-start bg-surface-hover text-ink"
                )}
              >
                {m.content}
              </div>
            ))}
            {isSending && (
              <div className="self-start rounded-2xl bg-surface-hover px-3.5 py-2.5 text-sm text-ink-muted">…</div>
            )}
          </div>
        )}
      </div>

      {/* Structured-output confirmation card */}
      {proposal && (
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
      )}

      {/* Input */}
      <div className="border-t border-border/60 px-3 py-3">
        {note && <p className="mb-2 px-1 text-xs text-danger">{note}</p>}
        {flash && <p className="mb-2 px-1 text-xs font-semibold text-emerald-600">{flash}</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
          className="flex items-end gap-2"
        >
          <textarea
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
            className="max-h-32 min-h-[42px] flex-1 resize-none rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={isSending || !available || input.trim().length === 0}
            className="shrink-0 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-opacity disabled:opacity-40"
          >
            {t("assistantSend")}
          </button>
        </form>
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

// The confirmation card the assistant shows when it has extracted a saveable
// structured field. Nothing is written until the user explicitly confirms;
// when a value already exists the card asks whether to replace it.
function ProposalCard({ proposal, existing, disabled, onSave, onImprove, onDismiss }: ProposalCardProps) {
  const t = useTranslations("build");
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(proposal.value);
  const fieldName = t(FIELD_TO_LABELKEY[proposal.field] as Parameters<typeof t>[0]);
  const canSave = value.trim().length > 0 && !disabled;

  return (
    <div className="mx-3 mb-1 mt-2 flex flex-col gap-2.5 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-pink-50/60 px-3.5 py-3 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-600">
          {t("proposalEyebrow", { field: proposal.label || fieldName })}
        </span>
      </div>

      {editing ? (
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={3}
          maxLength={800}
          className="w-full resize-none rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{value}</p>
      )}

      {existing && !editing && (
        <p className="text-[11px] font-medium text-amber-700">
          {t("proposalReplaceWarning", { field: fieldName })}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canSave}
          onClick={() => onSave(value)}
          className="rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-40"
        >
          {existing ? t("proposalReplace") : t("proposalSave")}
        </button>
        {!editing && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setEditing(true)}
            className="rounded-full border border-border bg-white/70 px-3 py-1.5 text-xs font-semibold text-ink-secondary transition-colors hover:bg-white disabled:opacity-60"
          >
            {t("proposalEdit")}
          </button>
        )}
        <button
          type="button"
          disabled={disabled}
          onClick={onImprove}
          className="rounded-full border border-border bg-white/70 px-3 py-1.5 text-xs font-semibold text-ink-secondary transition-colors hover:bg-white disabled:opacity-60"
        >
          {t("proposalImprove")}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onDismiss}
          className="rounded-full px-3 py-1.5 text-xs font-semibold text-ink-muted transition-colors hover:bg-white/60 disabled:opacity-60"
        >
          {existing ? t("proposalKeep") : t("proposalDismiss")}
        </button>
      </div>
    </div>
  );
}
