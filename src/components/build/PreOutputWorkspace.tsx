"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { AssistantMessage } from "@/lib/actions/assistant";
import { sendAssistantMessage } from "@/lib/actions/assistant";
import { editProjectOutputAction, generateFirstVersionAction } from "@/lib/actions/stage3";
import type { CreationDirection } from "@/lib/build/creationTypes";
import type { Stage3ProjectOutput, Stage3Status } from "@/lib/build/stage3Types";
import { ProjectOutputRenderer } from "@/components/build/ProjectOutputRenderer";
import { cn } from "@/lib/utils";

interface PreOutputWorkspaceProps {
  projectId: string;
  projectName: string;
  projectConcept: string | null;
  projectAudience: string | null;
  stage3Status: Stage3Status | null;
  direction: CreationDirection | null;
  initialOutput: Stage3ProjectOutput | null;
  assistant: {
    available: boolean;
    conversationId: string | null;
    messages: AssistantMessage[];
  };
  openingMessage: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function PreOutputWorkspace({
  projectId,
  projectName,
  projectConcept,
  projectAudience,
  stage3Status,
  direction,
  initialOutput,
  assistant,
  openingMessage,
}: PreOutputWorkspaceProps) {
  const t = useTranslations("stage3");
  const [output, setOutput] = useState(initialOutput);
  const [messages, setMessages] = useState<ChatMessage[]>(
    assistant.messages.map((message) => ({ id: message.id, role: message.role, content: message.content }))
  );
  const [conversationId, setConversationId] = useState(assistant.conversationId);
  const [mobileMode, setMobileMode] = useState<"chat" | "project">(initialOutput ? "project" : "chat");
  const [input, setInput] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [revealKey, setRevealKey] = useState(initialOutput ? 1 : 0);
  const [isGenerating, startGenerating] = useTransition();
  const [isSending, startSending] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isSending]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
  }, [input]);

  const busy = isGenerating || isSending;
  const suggestions = output
    ? [t("editPremium"), t("editAudience"), t("editCta")]
    : [t("sharpenDirection"), t("whoFirst"), t("firstVersionCouldBe")];

  function append(role: ChatMessage["role"], content: string) {
    setMessages((current) => [...current, { id: `${role}-${crypto.randomUUID()}`, role, content }]);
  }

  function createFirstVersion() {
    if (busy || !direction) return;
    setNote(null);
    setMobileMode("project");
    startGenerating(async () => {
      const result = await generateFirstVersionAction(projectId);
      if (result.error || !result.output) {
        setNote(result.error ?? t("unavailable"));
        return;
      }
      setOutput(result.output);
      setRevealKey((value) => value + 1);
      if (result.reply) append("assistant", result.reply);
    });
  }

  function submit(raw: string) {
    const content = raw.trim();
    if (!content || busy || !assistant.available) return;
    setInput("");
    setNote(null);
    append("user", content);
    startSending(async () => {
      if (output) {
        if (!conversationId) {
          setNote(t("unavailable"));
          setInput(content);
          return;
        }
        const result = await editProjectOutputAction(projectId, conversationId, crypto.randomUUID(), content);
        if (result.error || !result.output) {
          setNote(result.error ?? t("unavailable"));
          setInput(content);
          return;
        }
        setOutput(result.output);
        setRevealKey((value) => value + 1);
        if (result.reply) append("assistant", result.reply);
        setMobileMode("project");
        return;
      }

      const result = await sendAssistantMessage(projectId, conversationId, content);
      if (result.error) {
        setNote(result.error);
        setInput(content);
        return;
      }
      if (result.conversationId) setConversationId(result.conversationId);
      if (result.reply) append("assistant", result.reply);
      if (result.unavailableNote) setNote(result.unavailableNote);
    });
  }

  return (
    <div className="pre-output-workspace relative flex h-full min-h-0 flex-col overflow-hidden">
      <div aria-hidden className="creation-focus-field opacity-70" />
      <header className="relative z-20 shrink-0 px-4 pt-[max(0.9rem,env(safe-area-inset-top))] sm:px-6 md:px-8 md:pt-5">
        <div className="flex items-center justify-between gap-4">
          <Link href="/projects" className="group inline-flex min-w-0 items-center gap-2 text-xs font-medium text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
            <span className="transition-transform duration-200 group-hover:-translate-x-0.5" aria-hidden>←</span>
            <span className="truncate">{t("back")}</span>
          </Link>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
            <span className="creation-signal-dot" />
            {output ? t("statusFirstVersion") : stage3Status === "ready" ? t("statusReady") : t("statusShaping")}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 rounded-full bg-white/[0.035] p-1 ring-1 ring-inset ring-white/[0.055] md:hidden">
          {(["chat", "project"] as const).map((mode) => (
            <button key={mode} type="button" onClick={() => setMobileMode(mode)} className={cn("rounded-full px-3 py-2 text-xs font-semibold transition-all focus-visible:outline-2 focus-visible:outline-accent", mobileMode === mode ? "bg-white/[0.08] text-ink shadow-sm" : "text-ink-muted")}>
              {mode === "chat" ? t("chatTab") : t("projectTab")}
            </button>
          ))}
        </div>
      </header>

      <main className="relative z-10 min-h-0 flex-1 md:grid md:grid-cols-[minmax(330px,0.78fr)_minmax(0,1.22fr)] md:gap-px md:px-5 md:pb-5 md:pt-4 lg:px-8">
        <section className={cn("h-full min-h-0 overflow-hidden md:block", mobileMode !== "chat" && "hidden")} aria-label={t("chatTab")}>
          <div className="flex h-full min-h-0 flex-col md:rounded-l-[2rem] md:bg-black/[0.08] md:ring-1 md:ring-inset md:ring-white/[0.04]">
            <div className="hidden shrink-0 px-7 pt-6 md:block">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">{t("creator")}</p>
            </div>
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-8 sm:px-8 md:px-7">
              <div className="mx-auto flex max-w-[680px] flex-col gap-6">
                {messages.length === 0 && <p className="text-[16px] leading-7 text-ink">{openingMessage}</p>}
                {messages.map((message) => message.role === "user" ? (
                  <div key={message.id} className="flex justify-end"><p className="max-w-[88%] whitespace-pre-wrap rounded-[1.3rem] rounded-br-md bg-white/[0.075] px-4 py-2.5 text-sm leading-6 text-ink">{message.content}</p></div>
                ) : (
                  <p key={message.id} className="whitespace-pre-wrap text-[16px] leading-7 text-ink">{message.content}</p>
                ))}
                {isSending && <div className="flex items-center gap-3 text-sm text-ink-secondary" role="status"><span className="thinking-signal" aria-hidden><span /></span>{output ? t("editing") : t("thinking")}</div>}
              </div>
            </div>
            <div className="shrink-0 bg-gradient-to-t from-canvas via-canvas/95 to-transparent px-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-3 sm:px-7 md:pb-5">
              <div className="mx-auto max-w-[680px]">
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {suggestions.map((suggestion) => <button key={suggestion} type="button" disabled={busy} onClick={() => submit(suggestion)} className="quiet-action text-left disabled:opacity-40">{suggestion}</button>)}
                </div>
                {note && <p className="mb-2 px-1 text-xs text-danger" role="status">{note}</p>}
                <form onSubmit={(event) => { event.preventDefault(); submit(input); }} className="ventrio-composer">
                  <textarea ref={textareaRef} value={input} onChange={(event) => setInput(event.target.value)} disabled={busy || !assistant.available} rows={1} maxLength={2000} placeholder={output ? t("editPlaceholder") : t("chatPlaceholder")} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(input); } }} className="max-h-36 min-h-[34px] min-w-0 flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] leading-6 text-ink placeholder:text-ink-muted focus:outline-none disabled:opacity-50" />
                  <button type="submit" aria-label={t("send")} disabled={busy || !assistant.available || input.trim().length === 0} className="composer-send press-scale focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-25">
                    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden><path d="M10 15.5v-11m0 0L5.5 9M10 4.5 14.5 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>

        <section className={cn("h-full min-h-0 overflow-x-hidden overflow-y-auto pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:block md:rounded-r-[2rem] md:pb-0 md:ring-1 md:ring-inset md:ring-white/[0.055]", mobileMode !== "project" && "hidden")} aria-label={t("projectTab")}>
          {isGenerating ? (
            <div className="generation-canvas flex min-h-full flex-col items-center justify-center px-6 text-center" role="status" aria-live="polite">
              <span className="creation-orbit" aria-hidden><span /></span>
              <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-accent/80">{projectName}</p>
              <h1 className="ventrio-display mt-3 max-w-xl text-[clamp(2.5rem,8vw,5rem)] leading-[0.96] text-ink">{t("buildingTitle")}</h1>
              <p className="mt-4 max-w-md text-sm leading-6 text-ink-secondary">{t("buildingBody")}</p>
              <div className="generation-progress mt-9"><span /></div>
            </div>
          ) : output ? (
            <ProjectOutputRenderer projectId={projectId} output={output} revealKey={revealKey} />
          ) : (
            <div className="emergence mx-auto flex min-h-full max-w-xl flex-col justify-center px-5 py-12 sm:px-9 md:justify-between md:py-10">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent/80">{t("projectDirection")}</p>
                <h1 className="ventrio-display mt-4 break-words text-balance text-[clamp(2.65rem,6.5vw,4.6rem)] leading-[0.93] text-ink">{projectName}</h1>
                <p className="mt-6 max-w-lg text-pretty text-[16px] leading-7 text-ink-secondary">{projectConcept ?? direction?.concept ?? t("conceptFallback")}</p>
                {(projectAudience || direction?.audience) && <div className="mt-8 border-l border-accent/35 pl-4"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-muted">{t("forLabel")}</p><p className="mt-1.5 text-sm leading-6 text-ink">{projectAudience ?? direction?.audience}</p></div>}
              </div>
              <div className="mt-14 border-t border-white/[0.06] pt-7 md:mt-16">
                <h2 className="ventrio-display text-2xl text-ink">{t("readyTitle")}</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-ink-secondary">{t("readyBody")}</p>
                <button type="button" onClick={createFirstVersion} disabled={!direction || busy} className="primary-action mt-6 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent disabled:opacity-35">{t("createFirstVersion")} <span aria-hidden>→</span></button>
                {!direction && <p className="mt-3 text-xs leading-5 text-ink-muted">{t("directionNeeded")}</p>}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
