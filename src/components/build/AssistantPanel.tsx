"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  loadProjectAssistant,
  sendAssistantMessage,
  startNewConversation,
  type AssistantMessage,
} from "@/lib/actions/assistant";
import { STARTER_PROMPT_KEYS, type AssistantPhase } from "@/lib/build/assistantPrompts";

interface AssistantPanelProps {
  projectId: string;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function AssistantPanel({ projectId, onClose }: AssistantPanelProps) {
  const t = useTranslations("build");
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [phase, setPhase] = useState<AssistantPhase>("early");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [isSending, startSending] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const idCounter = useRef(0);
  const nextId = (prefix: string) => `${prefix}-${(idCounter.current += 1)}`;

  // Load existing conversation (lazily, only now that the panel is open).
  useEffect(() => {
    let cancelled = false;
    loadProjectAssistant(projectId).then((result) => {
      if (cancelled) return;
      setAvailable(result.available);
      setConversationId(result.conversationId);
      setPhase(result.phase);
      setMessages(
        (result.messages as AssistantMessage[]).map((m) => ({ id: m.id, role: m.role, content: m.content }))
      );
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isSending]);

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isSending) return; // request lock
    setNote(null);
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

  return (
    <div className="fixed inset-0 z-[90] flex justify-end" role="dialog" aria-label={t("assistantTitle")}>
      <button
        type="button"
        aria-label={t("assistantClose")}
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(15,15,23,0.4)]"
      />
      <div className="relative flex h-full w-full flex-col bg-white shadow-2xl sm:w-[420px]">
        {/* Header */}
        <div className="flex items-start gap-2 border-b border-border/60 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="text-sm font-extrabold tracking-tight text-ink">🤖 {t("assistantTitle")}</span>
            <span className="text-[11px] leading-tight text-ink-muted">{t("assistantScope")}</span>
          </div>
          <button
            type="button"
            onClick={handleNewConversation}
            disabled={isSending}
            className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-ink-secondary transition-colors hover:bg-surface-hover disabled:opacity-60"
          >
            {t("assistantNewChat")}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("assistantClose")}
            className="shrink-0 rounded-full px-2 py-1 text-ink-muted transition-colors hover:bg-surface-hover"
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <p className="text-sm text-ink-muted">…</p>
          ) : !available ? (
            <p className="text-sm tracking-tight text-ink-secondary">{t("assistantUnavailable")}</p>
          ) : messages.length === 0 ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm tracking-tight text-ink-secondary">{t("assistantEmpty")}</p>
              <div className="flex flex-col gap-2">
                {starters.map((key) => (
                  <button
                    key={key}
                    type="button"
                    disabled={isSending || !available}
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
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed tracking-tight",
                    m.role === "user"
                      ? "self-end bg-gradient-to-br from-indigo-600 to-purple-600 text-white"
                      : "self-start bg-surface-hover text-ink"
                  )}
                >
                  {m.content}
                </div>
              ))}
              {isSending && (
                <div className="self-start rounded-2xl bg-surface-hover px-3.5 py-2.5 text-sm text-ink-muted">
                  …
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-border/60 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {note && <p className="mb-2 px-1 text-xs text-danger">{note}</p>}
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
    </div>
  );
}
