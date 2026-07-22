"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { AssistantMessage } from "@/lib/actions/assistant";
import type { AssistantPhase } from "@/lib/build/assistantPrompts";
import type { SnapshotRow, StructuredField } from "@/lib/build/snapshot";
import { AssistantChat } from "@/components/build/AssistantChat";
import { cn } from "@/lib/utils";

interface PreOutputWorkspaceProps {
  projectId: string;
  projectName: string;
  projectConcept: string | null;
  projectAudience: string | null;
  snapshot: SnapshotRow[];
  assistant: {
    available: boolean;
    conversationId: string | null;
    messages: AssistantMessage[];
    phase: AssistantPhase;
  };
  openingMessage: string;
}

export function PreOutputWorkspace({
  projectId,
  projectName,
  projectConcept,
  projectAudience,
  snapshot: initialSnapshot,
  assistant,
  openingMessage,
}: PreOutputWorkspaceProps) {
  const t = useTranslations("build");
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [mobileMode, setMobileMode] = useState<"chat" | "project">("project");
  const [soonVisible, setSoonVisible] = useState(false);

  const existingValues = useMemo(() => {
    const values: Partial<Record<StructuredField, string>> = {};
    for (const row of snapshot) {
      if (row.field && row.value) values[row.field] = row.value;
    }
    return values;
  }, [snapshot]);

  function handleFieldSaved(field: StructuredField, value: string) {
    setSnapshot((current) =>
      current.map((row) => (row.field === field ? { ...row, value, source: "assistant" } : row))
    );
  }

  const concept = existingValues.solution ?? projectConcept ?? t("preOutputConceptFallback");
  const audience = existingValues.audience ?? projectAudience;

  return (
    <div className="pre-output-workspace relative flex h-full min-h-0 flex-col overflow-hidden">
      <div aria-hidden className="creation-focus-field opacity-70" />

      <header className="relative z-20 shrink-0 px-4 pt-[max(0.9rem,env(safe-area-inset-top))] sm:px-6 md:px-8 md:pt-5">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/projects"
            className="group inline-flex min-w-0 items-center gap-2 text-xs font-medium text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            <span className="transition-transform duration-200 group-hover:-translate-x-0.5" aria-hidden>←</span>
            <span className="truncate">{t("preOutputBack")}</span>
          </Link>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
            <span className="creation-signal-dot" />
            {t("preOutputReady")}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 rounded-full bg-white/[0.035] p-1 ring-1 ring-inset ring-white/[0.055] md:hidden">
          {(["chat", "project"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setMobileMode(mode)}
              className={cn(
                "rounded-full px-3 py-2 text-xs font-semibold transition-all focus-visible:outline-2 focus-visible:outline-accent",
                mobileMode === mode ? "bg-white/[0.08] text-ink shadow-sm" : "text-ink-muted"
              )}
            >
              {mode === "chat" ? t("preOutputChatTab") : t("preOutputProjectTab")}
            </button>
          ))}
        </div>
      </header>

      <main className="relative z-10 min-h-0 flex-1 md:grid md:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)] md:gap-px md:px-5 md:pb-5 md:pt-4 lg:px-8">
        <section className={cn("h-full min-h-0 overflow-hidden md:block", mobileMode !== "chat" && "hidden")} aria-label={t("preOutputChatTab")}>
          <div className="flex h-full min-h-0 flex-col md:rounded-l-[2rem] md:bg-black/[0.08] md:ring-1 md:ring-inset md:ring-white/[0.04]">
            <div className="hidden shrink-0 px-7 pt-6 md:block">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">{t("preOutputCreator")}</p>
            </div>
            <div className="min-h-0 flex-1">
              <AssistantChat
                projectId={projectId}
                available={assistant.available}
                initialConversationId={assistant.conversationId}
                initialMessages={assistant.messages}
                phase={assistant.phase}
                openingMessage={openingMessage}
                existingValues={existingValues}
                onFieldSaved={handleFieldSaved}
                variant="creator"
              />
            </div>
          </div>
        </section>

        <section className={cn("h-full min-h-0 overflow-x-hidden overflow-y-auto px-5 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-10 sm:px-8 md:block md:rounded-r-[2rem] md:px-9 md:pb-9 md:pt-8 md:ring-1 md:ring-inset md:ring-white/[0.055]", mobileMode !== "project" && "hidden")} aria-label={t("preOutputProjectTab")}>
          <div className="emergence mx-auto flex min-h-full max-w-xl flex-col justify-center md:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent/80">{t("preOutputIdentity")}</p>
              <h1 className="ventrio-display mt-4 break-words text-balance text-[clamp(2.65rem,6.5vw,4.6rem)] leading-[0.93] text-ink">{projectName}</h1>
              <p className="mt-6 max-w-lg text-pretty text-[16px] leading-7 text-ink-secondary">{concept}</p>
              {audience && (
                <div className="mt-8 border-l border-accent/35 pl-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-muted">{t("preOutputFor")}</p>
                  <p className="mt-1.5 text-sm leading-6 text-ink">{audience}</p>
                </div>
              )}
            </div>

            <div className="mt-14 border-t border-white/[0.06] pt-7 md:mt-16">
              <h2 className="ventrio-display text-2xl text-ink">{t("preOutputShapeTitle")}</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-ink-secondary">{t("preOutputShapeBody")}</p>
              <button
                type="button"
                onClick={() => setSoonVisible(true)}
                className="primary-action mt-6 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent"
              >
                {t("hdrCreateFirstVersion")} <span aria-hidden>→</span>
              </button>
              {soonVisible && (
                <p className="animate-message-in mt-3 text-xs leading-5 text-ink-muted" role="status">
                  {t("hdrFirstVersionSoon")}
                </p>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
