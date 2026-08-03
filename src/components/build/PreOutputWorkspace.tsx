"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AssistantMessage } from "@/lib/actions/assistant";
import { sendAssistantMessage } from "@/lib/actions/assistant";
import { editProjectOutputAction, generateFirstVersionAction } from "@/lib/actions/stage3";
import type { CreationDirection } from "@/lib/build/creationTypes";
import { isProjectOutputEditRequest } from "@/lib/build/editIntent";
import type { Stage3ProjectOutput, Stage3Status } from "@/lib/build/stage3Types";
import { ProjectOutputRenderer } from "@/components/build/ProjectOutputRenderer";
import { PublicationControls } from "@/components/publishing/PublicationControls";
import { BuildScreen, OpenPreviewButton } from "@/components/workspace/BuildScreen";
import { WorkspaceComposer } from "@/components/workspace-ui/Composer";
import { UsageMenu } from "@/components/workspace-ui/UsageMenu";
import { usageLabels } from "@/components/build/AssistantChat";
import { GenerationSteps, type GenerationStep } from "@/components/workspace-ui/GenerationSteps";
import { GenerativeButton, IconBuild, IconEye } from "@/components/workspace-ui/parts";
import { VentrioButton } from "@/components/ui/VentrioButton";
import { useVoiceInput } from "@/lib/workspace/useVoiceInput";
import { useFirstVersionJob } from "@/lib/workspace/useFirstVersionJob";
import type { Locale } from "@/i18n/locale";
import type { ProjectPublicationState } from "@/lib/publishing/types";
import type { WorkspaceUsage } from "@/lib/workspace/usage";

interface PreOutputWorkspaceProps {
  projectId: string;
  projectName: string;
  projectConcept: string | null;
  projectAudience: string | null;
  projectLocale: Locale;
  stage3Status: Stage3Status | null;
  direction: CreationDirection | null;
  initialOutput: Stage3ProjectOutput | null;
  assistant: {
    available: boolean;
    conversationId: string | null;
    messages: AssistantMessage[];
  };
  openingMessage: string;
  publication: ProjectPublicationState | null;
  publicBaseUrl: string;
  usage: WorkspaceUsage;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

/**
 * Build before a first version exists — the approved chat-first state.
 *
 * Nothing has been generated, so nothing is reserved for it: the conversation
 * takes the whole frame at a reading measure, and the one thing the person can
 * do next sits inside the conversation as a card rather than as a second column
 * standing empty. The preview panel appears only once real output exists.
 */
export function PreOutputWorkspace({
  projectId,
  projectName,
  projectConcept,
  projectAudience,
  projectLocale,
  stage3Status,
  direction,
  initialOutput,
  assistant,
  openingMessage,
  publication,
  publicBaseUrl,
  usage,
}: PreOutputWorkspaceProps) {
  const t = useTranslations("stage3");
  const tb = useTranslations("build");
  const tw = useTranslations("workspace");
  const locale = useLocale();

  const [output, setOutput] = useState(initialOutput);
  const [messages, setMessages] = useState<ChatMessage[]>(
    assistant.messages.map((message) => ({ id: message.id, role: message.role, content: message.content }))
  );
  const [conversationId, setConversationId] = useState(assistant.conversationId);
  const [input, setInput] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [revealKey, setRevealKey] = useState(initialOutput ? 1 : 0);
  const [isGenerating, startGenerating] = useTransition();
  const [isSending, startSending] = useTransition();
  const [isEditingOutput, setIsEditingOutput] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const job = useFirstVersionJob(projectId, Boolean(output));
  const hasFailed = job.phase === "failed" || job.phase === "stale";
  // A quota wall, not a failure — so it never borrows failure's wording, and it
  // offers no retry, because retrying would fail the same way every time.
  //
  // Read from the live counter rather than from the last job's error code: a
  // job that once hit the limit is history, and if the account has room again
  // the action must come back on its own rather than staying walled off by a
  // stale row.
  const outOfQuota =
    usage.projectBuilds.available && usage.projectBuilds.used >= usage.projectBuilds.limit;
  const elapsed = useElapsedSeconds(job.active);

  // A job in flight counts as busy even when this tab did not start it — after
  // a refresh the transition is gone but the generation is not.
  const busy = isGenerating || isSending || job.active;

  const voice = useVoiceInput({
    lang: locale === "ru" ? "ru-RU" : "en-US",
    disabled: busy || !assistant.available,
    onTranscript: (text) => setInput((prev) => (prev ? `${prev.trimEnd()} ${text}` : text)),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isSending, isGenerating, output]);

  const suggestions = output
    ? [t("editPremium"), t("editAudience"), t("editCta")]
    : [t("sharpenDirection"), t("whoFirst"), t("firstVersionCouldBe")];

  function append(role: ChatMessage["role"], content: string) {
    setMessages((current) => [...current, { id: `${role}-${crypto.randomUUID()}`, role, content }]);
  }

  function createFirstVersion(retry = false) {
    if (busy || !direction || output) return;
    setNote(null);
    // Before the round trip, so the button answers on the first frame rather
    // than after the job row exists.
    job.markStarting(retry);
    startGenerating(async () => {
      try {
        const result = await generateFirstVersionAction(projectId);
        if (result.error || !result.output) {
          if (result.limitReached) {
            setNote(t("firstVersionLimitReached"));
            return;
          }
          // A job came back with no output and no error: this click lost the
          // race to one already in flight. The progress card speaks for it, so
          // saying anything here would only contradict what is on screen.
          if (result.jobId && !result.error) return;
          setNote(result.error ?? t("unavailable"));
          return;
        }
        setOutput(result.output);
        setRevealKey((value) => value + 1);
        if (result.reply) append("assistant", result.reply);
      } finally {
        job.settle();
      }
    });
  }

  function submit(raw: string) {
    const content = raw.trim();
    if (!content || busy || !assistant.available) return;
    setInput("");
    setNote(null);
    append("user", content);
    const shouldEditOutput = !!output && isProjectOutputEditRequest(content);
    startSending(async () => {
      setIsEditingOutput(shouldEditOutput);
      try {
        if (shouldEditOutput) {
          if (!conversationId) {
            setNote(t("unavailable"));
            setInput(content);
            return;
          }
          const result = await editProjectOutputAction(projectId, conversationId, crypto.randomUUID(), content);
          if (result.error || !result.output) {
            if (result.limitReached) {
              setNote(t("editLimitReached", { limit: result.limitReached.limit }));
              setInput(content);
              return;
            }
            setNote(result.error ?? t("unavailable"));
            setInput(content);
            return;
          }
          setOutput(result.output);
          setRevealKey((value) => value + 1);
          if (result.reply) append("assistant", result.reply);
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
      } finally {
        setIsEditingOutput(false);
      }
    });
  }

  // Each completed row is something the project genuinely already contains —
  // a saved concept, a saved audience, a chosen direction. Only the last row is
  // the request actually in flight, so nothing here is a staged performance.
  const generationSteps: GenerationStep[] = [
    { label: t("genUnderstanding"), state: projectConcept || direction?.concept ? "done" : "waiting" },
    { label: t("genAudience"), state: projectAudience || direction?.audience ? "done" : "waiting" },
    { label: t("genDirection"), state: direction ? "done" : "waiting" },
    { label: activeStageLabel(), state: "active" },
  ];

  /**
   * For the first few seconds the last row says what the click did, because
   * that is all anyone knows yet. Once the job has been running long enough for
   * a stage to have been written and read back, it says what is actually
   * happening — never a guess, and never a stage the row has not reported.
   */
  function activeStageLabel(): string {
    if (job.phase === "retrying") return t("genRetryingLabel");
    if (elapsed < 3 || !job.stage) return t("genBuilding");
    if (job.stage === "queued") return t("genQueued");
    if (job.stage === "preparing") return t("genPreparing");
    if (job.stage === "saving") return t("genSaving");
    return t("genGenerating");
  }

  return (
    <BuildScreen
      published={Boolean(publication?.isPublished)}
      shareUrl={
        // Draft previews are real but unaddressable; only a publication has a URL.
        publication?.isPublished && publication.slug ? `${publicBaseUrl}/p/${publication.slug}` : null
      }
      preview={
        output ? (
          <ProjectOutputRenderer
            projectKey={projectId}
            output={output}
            locale={projectLocale}
            revealKey={revealKey}
            mode="preview"
          />
        ) : null
      }
      chat={({ previewOpen, canOpenPreview, openPreview }) => {
        const measure = previewOpen ? 560 : 820;
        return (
          <>
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto flex w-full flex-col gap-7 px-5 py-8 sm:px-8" style={{ maxWidth: measure }}>
                {messages.length === 0 ? (
                  <p className="whitespace-pre-wrap text-[19px] font-semibold leading-snug tracking-[-0.01em]">
                    {openingMessage}
                  </p>
                ) : (
                  messages.map((message) =>
                    message.role === "user" ? (
                      <div key={message.id} className="ws-turn flex justify-end">
                        <p
                          className="max-w-[80%] whitespace-pre-wrap rounded-[var(--r-lg)] px-3.5 py-2.5 text-[15px] leading-[1.6]"
                          style={{ background: "var(--sunken)" }}
                        >
                          {message.content}
                        </p>
                      </div>
                    ) : (
                      <div key={message.id} className="ws-turn whitespace-pre-wrap text-[15px] leading-[1.65]">
                        {message.content}
                      </div>
                    )
                  )
                )}

                {isSending && (
                  <div className="flex items-center gap-2 text-[14px]" role="status" style={{ color: "var(--ink-2)" }}>
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "var(--accent)" }} />
                    {isEditingOutput ? t("editing") : t("thinking")}
                  </div>
                )}

                {/* The first second is the button's own pressed state; a card
                    appearing under the click would read as a jump. */}
                {job.active && elapsed >= 1 && (
                  <div className="flex flex-col gap-2">
                    <GenerationSteps title={t("genTitle")} steps={generationSteps} />
                    {elapsed >= 20 && (
                      <p className="text-[13px] leading-relaxed" style={{ color: "var(--ink-3)" }}>
                        {t("genStillWorking")}
                      </p>
                    )}
                  </div>
                )}

                {/* Before anything is generated: the direction, and the one
                    action that turns it into a first version. A failed attempt
                    changes what this card offers, never whether it is here —
                    losing sight of the direction is the last thing someone
                    needs when generation has just gone wrong. */}
                {!output && !job.active && (
                  <div
                    className="rise rounded-[var(--r-lg)] border p-5"
                    style={{ borderColor: "var(--line-2)", background: "var(--surface)" }}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.09em]" style={{ color: "var(--ink-3)" }}>
                      {t("projectDirection")}
                    </p>
                    <p className="mt-2 text-[17px] font-semibold leading-snug tracking-[-0.01em]">{projectName}</p>
                    <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
                      {projectConcept ?? direction?.concept ?? t("conceptFallback")}
                    </p>
                    {(projectAudience || direction?.audience) && (
                      <p className="mt-2.5 text-[13px]" style={{ color: "var(--ink-3)" }}>
                        {t("forLabel")}: {projectAudience ?? direction?.audience}
                      </p>
                    )}

                    <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--line)" }}>
                      {(() => {
                        // The heading states what happened; the body says what
                        // to do about it. Neither ever carries a provider
                        // message, a database error or a stack trace — the
                        // error code chooses the wording, and that is all.
                        //
                        // Running out of free generations is not a failure of
                        // generation, so it never borrows failure's wording. It
                        // says what is actually true and offers no retry,
                        // because retrying would fail the same way every time.
                        const heading = outOfQuota
                          ? t("firstVersionLimitReached")
                          : !hasFailed
                            ? t("readyTitle")
                            : job.phase === "stale"
                              ? t("genStale")
                              : t("genFailed");
                        const body = outOfQuota
                          ? null
                          : !hasFailed || job.canRetry
                            ? t("readyBody")
                            : t("errorRetriesExhausted");
                        return (
                          <>
                            <p className="text-[14px] font-medium" role={hasFailed ? "status" : undefined}>
                              {heading}
                            </p>
                            {body && (
                              <p className="mt-1 text-[14px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
                                {body}
                              </p>
                            )}
                          </>
                        );
                      })()}
                      <div className={outOfQuota ? "" : "mt-3.5"}>
                        {outOfQuota ? null : hasFailed ? (
                          job.canRetry && (
                            <VentrioButton
                              variant="primary"
                              size="sm"
                              disabled={!direction || busy}
                              onClick={() => createFirstVersion(true)}
                            >
                              {t("genRetry")}
                            </VentrioButton>
                          )
                        ) : (
                          <GenerativeButton onClick={() => createFirstVersion()} disabled={!direction || busy} size="sm">
                            <IconBuild className="h-4 w-4" />
                            {t("createFirstVersion")}
                          </GenerativeButton>
                        )}
                      </div>
                      {!direction && (
                        <p className="mt-2.5 text-[13px] leading-relaxed" style={{ color: "var(--ink-3)" }}>
                          {t("directionNeeded")}
                        </p>
                      )}
                      {stage3Status === "ready" && direction && !hasFailed && (
                        <p className="mt-2.5 text-[13px]" style={{ color: "var(--ink-3)" }}>
                          {t("statusReady")}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {output && (
                  <div className="flex flex-col gap-4">
                    {canOpenPreview && (
                      <div
                        className="rise rounded-[var(--r-lg)] border p-4"
                        style={{ borderColor: "var(--line-accent)", background: "var(--surface)" }}
                      >
                        <p className="text-[14px] font-medium">{tw("buildVersionReady")}</p>
                        <p className="mt-1 text-[14px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
                          {tw("buildVersionReadyBody")}
                        </p>
                        <div className="mt-3.5">
                          <OpenPreviewButton
                            onOpen={openPreview}
                            label={tw("openPreview")}
                            icon={<IconEye className="h-4 w-4" />}
                          />
                        </div>
                      </div>
                    )}

                    <PublicationControls
                      key={publication?.updatedAt ?? "private-draft"}
                      projectId={projectId}
                      projectLocale={projectLocale}
                      output={output}
                      initialPublication={publication}
                      publicBaseUrl={publicBaseUrl}
                      onDraftChanged={(nextOutput) => {
                        setOutput(nextOutput);
                        setRevealKey((value) => value + 1);
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 px-5 pb-5 pt-2 sm:px-8 sm:pb-7">
              <div className="mx-auto w-full" style={{ maxWidth: measure }}>
                <div className="mb-2 flex flex-wrap gap-2">
                  {suggestions.map((suggestion) => (
                    <VentrioButton
                      key={suggestion}
                      variant="secondary"
                      size="sm"
                      shape="pill"
                      disabled={busy}
                      onClick={() => submit(suggestion)}
                      weight="medium"
                    >
                      {suggestion}
                    </VentrioButton>
                  ))}
                </div>
                {note && (
                  <p className="mb-1.5 text-[13px]" role="status" style={{ color: "var(--warn)" }}>
                    {note}
                  </p>
                )}
                <WorkspaceComposer
                  value={input}
                  onChange={setInput}
                  onSend={() => submit(input)}
                  disabled={busy || !assistant.available}
                  sending={isSending}
                  placeholder={output ? t("editPlaceholder") : t("chatPlaceholder")}
                  sendLabel={t("send")}
                  settings={<UsageMenu usage={usage} labels={usageLabels(tw)} />}
                  listeningLabel={tb("voiceListening")}
                  keyboardHint={tb("composerKeys")}
                  voice={{
                    supported: voice.supported,
                    listening: voice.listening,
                    state: voice.state,
                    onToggle: () => (voice.listening ? voice.stop() : voice.start()),
                    label: tb("voiceStart"),
                    unsupportedLabel: tb("voiceUnsupported"),
                    requestingLabel: tb("voiceRequesting"),
                    listeningLabel: tb("voiceListening"),
                  }}
                />
                {voice.error && (
                  <p role="alert" className="mt-1.5 text-[13px]" style={{ color: "var(--warn)" }}>
                    {voice.error === "permission"
                      ? tb("voiceBlocked")
                      : voice.error === "no-speech"
                        ? tb("voiceNoSpeech")
                        : tb("voiceFailed")}
                  </p>
                )}
              </div>
            </div>
          </>
        );
      }}
    />
  );
}

/**
 * Seconds since the current generation began, resetting to zero each time one
 * starts. The interface reveals progress detail in stages rather than all at
 * once, so a fast generation never flashes a card that is gone before it can be
 * read, and a slow one is never silent.
 */
function useElapsedSeconds(active: boolean): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!active) return;
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      setSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);
    return () => {
      window.clearInterval(id);
      setSeconds(0);
    };
  }, [active]);

  return active ? seconds : 0;
}
