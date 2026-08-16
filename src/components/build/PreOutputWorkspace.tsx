"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markGenerationArrived } from "@/lib/workspace/generationHandoff";
import { useLocale, useTranslations } from "next-intl";
import type { AssistantMessage } from "@/lib/actions/assistant";
import { sendAssistantMessage } from "@/lib/actions/assistant";
import { editProjectOutputAction, generateFirstVersionAction } from "@/lib/actions/stage3";
import type { CreationDirection } from "@/lib/build/creationTypes";
import { isProjectOutputEditRequest } from "@/lib/build/editIntent";
import { classifyBuildIntent } from "@/lib/build/buildIntent";
import { StructuredChoice } from "./StructuredChoice";
import { useBuildIntake } from "@/lib/build/useBuildIntake";
import type { DesignPreviewId } from "@/lib/build/intake";
import { intakeGenerationBrief, type IntakeAnswers } from "@/lib/build/intake";
import type { Stage3ProjectOutput, Stage3Status } from "@/lib/build/stage3Types";
import { ProjectOutputRenderer } from "@/components/build/ProjectOutputRenderer";
import { AppPreview } from "@/components/workspace/AppPreview";
import type { WorkspaceAppView } from "@/components/build/WorkspaceView";
import { PublicationControls } from "@/components/publishing/PublicationControls";
import { FeedbackPanel } from "@/components/publishing/FeedbackPanel";
import { BuildScreen, OpenPreviewButton } from "@/components/workspace/BuildScreen";
import { WorkspaceComposer } from "@/components/workspace-ui/Composer";
import { UsageMenu } from "@/components/workspace-ui/UsageMenu";
import { usageLabels } from "@/components/build/AssistantChat";
import { GenerationSteps, type GenerationStep } from "@/components/workspace-ui/GenerationSteps";
import { generationProgress } from "@/lib/workspace/generationProgress";
import { GenerativeButton, IconBuild, IconEye } from "@/components/workspace-ui/parts";
import { VentrioButton } from "@/components/ui/VentrioButton";
import { useVoiceInput, voiceErrorKey } from "@/lib/workspace/useVoiceInput";
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
  /**
   * The generated application, when the app runtime built this project.
   *
   * A project it built has no `initialOutput` — it has an application — so
   * every "do we have a version yet" test below has to consider both, or a
   * finished project keeps being offered the button that builds it.
   */
  app: WorkspaceAppView | null;
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
/**
 * How many times to re-ask the server for a finished generation's result.
 *
 * The application and the job row are written by the worker in separate
 * statements, so a refresh can land in the gap and come back with nothing.
 * Three attempts across a few seconds covers that without becoming a loop on
 * the failure path.
 */
const MAX_ARRIVAL_REFRESHES = 3;
const ARRIVAL_RETRY_MS = 1500;

export function PreOutputWorkspace({
  projectId,
  projectName,
  projectConcept,
  projectAudience,
  projectLocale,
  stage3Status,
  direction,
  initialOutput,
  app,
  assistant,
  openingMessage,
  publication,
  publicBaseUrl,
  usage,
}: PreOutputWorkspaceProps) {
  const t = useTranslations("stage3");
  const tb = useTranslations("build");
  const tw = useTranslations("workspace");
  // Labels come from the provider, which the workspace page scopes to the
  // project's locale — so `useTranslations` here is already the project's
  // language. This value exists only for the speech-recognition language tag,
  // which is not a message lookup and cannot come from the provider.
  const uiLocale = useLocale();
  const speechLocale = projectLocale || uiLocale;

  const [output, setOutput] = useState(initialOutput);
  const router = useRouter();
  // Either shape counts as "this project has been built".
  const hasVersion = Boolean(output) || Boolean(app);
  /**
   * What the generated app said when it ran. Held here because the preview
   * panel is what shows it, and the panel is this screen's to configure.
   */
  const [runtimeErrors, setRuntimeErrors] = useState<string[]>([]);
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

  const job = useFirstVersionJob(projectId, hasVersion);
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

  /**
   * The generation finished somewhere else, so go and fetch what it made.
   *
   * App-runtime generation is a durable run now: the action returns in
   * milliseconds and the application is written to the project minutes later,
   * by something this tab has no handle on. The poll is what notices — but the
   * poll only reads the job row, and the built application arrives through the
   * server render. Without this the row would say "succeeded" beside an empty
   * workspace until someone reloaded by hand.
   *
   * Guarded by a ref rather than by `hasVersion`, because the refresh and the
   * new props are two renders apart: keying off state alone would fire a second
   * refresh in the gap and, on the failure path, forever.
   */
  /**
   * BOUNDED RETRIES, NOT ONE SHOT. This used to fire exactly once per mount,
   * guarded by the project id. That is terminal if the single refresh lands
   * before the new props are readable — the worker writes the application and
   * finishes the job row separately, and a refresh arriving in that gap comes
   * back still saying `awaitingFirstVersion`, after which nothing ever tried
   * again. The person was left on a finished generation with an empty
   * workspace, which is the reported bug: they had to reopen the project by
   * hand to see their own result.
   *
   * Still bounded, because the original concern was right — an unguarded effect
   * would refresh forever on the failure path. A few spaced attempts cover the
   * write gap without becoming a loop.
   */
  const refreshAttempts = useRef(0);
  useEffect(() => {
    if (hasVersion || job.phase !== "succeeded") return;
    if (refreshAttempts.current >= MAX_ARRIVAL_REFRESHES) return;

    // Recorded before the refresh, because this component is unmounted by it.
    // `BuildScreen` reads the marker on the other side and opens the preview.
    markGenerationArrived(projectId);

    const attempt = refreshAttempts.current;
    refreshAttempts.current = attempt + 1;
    const timer = window.setTimeout(() => router.refresh(), attempt === 0 ? 0 : ARRIVAL_RETRY_MS);
    return () => window.clearTimeout(timer);
  }, [hasVersion, job.phase, projectId, router]);

  // A job in flight counts as busy even when this tab did not start it — after
  // a refresh the transition is gone but the generation is not.
  const busy = isGenerating || isSending || job.active;

  const voice = useVoiceInput({
    lang: speechLocale === "ru" ? "ru-RU" : "en-US",
    disabled: busy || !assistant.available,
    onTranscript: (text) => setInput((prev) => (prev ? `${prev.trimEnd()} ${text}` : text)),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isSending, isGenerating, output]);

  const suggestions = output
    ? [t("editPremium"), t("editAudience"), t("editCta")]
    : [t("sharpenDirection"), t("whoFirst"), t("firstVersionCouldBe")];

  // The words the intake reasons about. The saved concept is the user's own
  // description; `direction` is what the create flow already distilled from it.
  const ideaText =
    projectConcept?.trim() ||
    [direction?.concept, direction?.niche, direction?.problem].filter(Boolean).join(" ").trim() ||
    projectName;

  const intake = useBuildIntake({
    projectId,
    idea: ideaText,
    /**
     * The gap between "has an idea" and "has anything at all".
     *
     * `!job.active` was not enough. It is false before the first poll returns
     * and false again the moment a job finishes, so the question rendered twice
     * over a generation it could no longer affect — once as the workspace
     * opened on a job started elsewhere, and once when that job succeeded, in
     * the frames before the rebuilt project arrived. `phase === "idle"` is true
     * only when no job row exists at all, and `loaded` says the row has
     * actually been read rather than merely not fetched yet.
     */
    enabled: !hasVersion && !!direction && job.loaded && job.phase === "idle" && assistant.available,
    onComplete: (answers: IntakeAnswers) => createFirstVersion(false, answers),
  });

  function append(role: ChatMessage["role"], content: string) {
    setMessages((current) => [...current, { id: `${role}-${crypto.randomUUID()}`, role, content }]);
  }

  function createFirstVersion(retry = false, answers?: IntakeAnswers) {
    // No `!direction` here either: the server infers one when nobody picked a
    // card, so refusing on the client would only reinstate the gate one layer
    // up and leave the button silently dead.
    if (busy || hasVersion) return;
    setNote(null);
    // Before the round trip, so the button answers on the first frame rather
    // than after the job row exists.
    job.markStarting(retry);
    startGenerating(async () => {
      try {
        const result = await generateFirstVersionAction(projectId, answers ? intakeGenerationBrief(answers) : null);
        if (result.error || !result.output) {
          if (result.limitReached) {
            // The number comes from the server's own reservation result, so the
            // sentence can never disagree with the limit actually applied.
            setNote(t("firstVersionLimitReached", { limit: result.limitReached.limit }));
            return;
          }
          /**
           * A successful app-runtime generation returns no `output`.
           *
           * It produced an application, which is persisted on the project
           * rather than returned inline, so the only way to show it is to let
           * the server re-read the row. The reply distinguishes this from the
           * other no-output case below — a click that lost the race carries no
           * reply, and refreshing on that would be harmless but pointless.
           */
          if (!result.error && result.reply) {
            append("assistant", result.reply);
            router.refresh();
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
    // Typing is an answer of its own: the person has decided the question is
    // not what they want to do next, so it should not still be sitting there.
    intake.dismiss();
    setInput("");
    setNote(null);
    append("user", content);
    // An explicit "build the site" before any output exists is a request for
    // generation, not for conversation. Routing it to the chat is what let the
    // assistant answer a build request with a refusal.
    //
    // The `direction &&` that used to be here was half the reported bug: with
    // no direction chosen, a build request fell through to the assistant, which
    // had no way to build and so asked for the problem to be confirmed instead.
    // Generation now infers a direction rather than requiring one, so intent is
    // the only thing this needs to check.
    // `job.loaded` is part of the condition, not an optimisation. Until the job
    // row has been read this tab cannot tell "nothing has ever been built" from
    // "a generation is already running", and it cannot tell whether a question
    // is still waiting — so a build instruction typed in the first second used
    // to start a second path past both.
    if (!output && job.loaded && !job.active && classifyBuildIntent(content, { hasOutput: false }) === "BUILD_NOW") {
      /**
       * An open question is answered, never stepped over.
       *
       * "just build it" while a build question is on screen used to call
       * `createFirstVersion` directly, which left the question rendered behind
       * a generation it had no part in — the same shape as the proposal that
       * used to pick its own first option. Deferring routes the instruction
       * through the intake instead: the person said "you decide", which is
       * exactly what the defer answer means, and the intake dispatches when it
       * has what it needs.
       */
      if (intake.step) {
        intake.choose(null);
        return;
      }
      createFirstVersion();
      return;
    }
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

  /**
   * The run, as the pipeline reports it.
   *
   * Every row is a stage `generation_jobs.progress_stage` actually carries, in
   * the order they happen. The list this replaced ticked three rows from what
   * the project already held — a saved concept, a saved audience, a chosen
   * direction — which were green before generation started and described none
   * of it.
   */
  const generationSteps: GenerationStep[] = generationProgress(job.stage, job.phase).map((row) => ({
    label: t(row.labelKey as never),
    state: row.state,
  }));



  return (
    <BuildScreen
      projectId={projectId}
      /**
       * The panel says what this screen knows, and no more.
       *
       * `idle` used to mean "empty" — but `useFirstVersionJob` reports `idle`
       * before the first poll returns too, so the panel asserted "nothing has
       * been built yet" for a project that might already have an application.
       * `succeeded` was also mapped to "empty", which claimed emptiness for the
       * whole window between a job finishing and the rebuilt project arriving.
       *
       * Only a job row that has been read, with nothing in it, is empty.
       * Anything else this screen cannot name yet is loading.
       */
      previewStatus={
        !job.loaded
          ? "loading"
          : job.phase === "failed" || job.phase === "stale"
            ? "failed"
            : job.active
              ? "generating"
              : job.phase === "idle"
                ? "empty"
                : "loading"
      }
      onPreviewRetry={job.canRetry ? () => createFirstVersion(true) : null}
      runtimeErrors={runtimeErrors}
      published={Boolean(publication?.isPublished)}
      publishControl={
        hasVersion ? (
          <PublicationControls
            key={publication?.updatedAt ?? "private-draft"}
            projectId={projectId}
            projectLocale={projectLocale}
            output={output}
            shareTitle={output?.identity.name ?? app?.title ?? projectName}
            shareText={output?.launchCopy.shortPost}
            initialPublication={publication}
            publicBaseUrl={publicBaseUrl}
            compact
            onDraftChanged={(nextOutput) => {
              setOutput(nextOutput);
              setRevealKey((value) => value + 1);
            }}
          />
        ) : null
      }
      shareUrl={
        // Draft previews are real but unaddressable; only a publication has a URL.
        publication?.isPublished && publication.slug ? `${publicBaseUrl}/p/${publication.slug}` : null
      }
      preview={
        // The old artifact wins where one exists; an app-runtime project has
        // an application instead, rendered in its own scripted sandbox.
        output ? (
          <ProjectOutputRenderer
            projectKey={projectId}
            output={output}
            locale={projectLocale}
            revealKey={revealKey}
            mode="preview"
          />
        ) : app ? (
          (device) => (
            <AppPreview document={app.document} device={device} title={app.title} onRuntimeErrors={setRuntimeErrors} />
          )
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
                {/* `hasVersion`, not `output`: an app-runtime project has no
                    page artifact, and gating on that alone kept offering
                    "Create first version" for a project that already had one. */}
                {/* `!intake.step`: while the build question is still on screen,
                    this card offered the same next action a second time, in
                    different words, with no answer to the question attached. Two
                    controls for one step is a choice about which one matters,
                    and neither said. The question owns the step until it is
                    answered or deferred; the card comes back for everything
                    after — retrying a failure, or building once there is
                    nothing left to ask. */}
                {/* `job.loaded` for the same reason the question waits for it.
                    Before the first read, `job.active` is false and there is no
                    question yet, so this card matched — and appeared for a
                    frame before being replaced by the question it duplicates.
                    Until the row has been read this screen does not know which
                    of the two states it is in, and the honest thing to show for
                    a state you cannot name is nothing. */}
                {/* `job.phase !== "succeeded"` as well as `!hasVersion`, because
                    the two are not simultaneous. A job goes succeeded the
                    moment the row says so; `hasVersion` waits for the rebuilt
                    project to come back from the server a second or more later.
                    In that window every other term here held, and the card
                    returned to offer creating an application that had just been
                    created. The job row is the earlier and truer signal. */}
                {job.loaded && !hasVersion && job.phase !== "succeeded" && !job.active && !intake.step && (
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
                          ? t("firstVersionLimitReached", { limit: usage.projectBuilds.limit })
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

                {/* Either shape counts. A project the app runtime built has an
                    application rather than a page artifact, and it is just as
                    publishable — gating on `output` alone left those projects
                    with a finished app and no way to share it. */}
                {/* Only the invitation to look, which is a thing to say in a
                    conversation. The publish controls used to sit here too —
                    product controls inside the chat — and now live in the
                    preview toolbar, above the thing they publish. */}
                {hasVersion && canOpenPreview && (
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

                {/* The build question, as a turn in the conversation.
                    It used to sit in the footer above the composer — a form
                    docked to the bottom of the screen rather than something
                    the assistant asked — so it read as chrome, and answering
                    it felt like filling in a field rather than replying. It is
                    the last thing in the thread because it is the last thing
                    said, and it stays there until it is answered: nothing
                    dismisses it and nothing chooses for the person. */}
                {intake.step && (
                  <div className="ws-turn flex flex-col gap-2.5">
                    <StructuredChoice
                      key={intake.step.id}
                      labelledById="build-intake-title"
                      title={tb(intake.step.titleKey as never)}
                      deferLabel={tb(intake.step.deferKey as never)}
                      progress={intake.progress ?? undefined}
                      disabled={busy}
                      options={intake.step.options.map((option) => ({
                        id: option.id,
                        label: tb(option.labelKey as never),
                        hint: option.hintKey ? tb(option.hintKey as never) : undefined,
                        preview: "preview" in option ? (option as { preview: DesignPreviewId }).preview : undefined,
                      }))}
                      onChoose={intake.choose}
                      onBack={intake.back ?? undefined}
                      backLabel={tb("intakeBack")}
                    />
                  </div>
                )}

                {/* Feedback on real responses is a conversation about the
                    product, not a control over it, so it stays here while the
                    publish actions move to the toolbar. */}
                {hasVersion && publication && (
                  <FeedbackPanel
                    projectId={projectId}
                    projectLocale={projectLocale}
                    publication={publication}
                    onDraftChanged={(nextOutput) => {
                      setOutput(nextOutput);
                      setRevealKey((value) => value + 1);
                    }}
                  />
                )}
              </div>
            </div>

            <div className="shrink-0 px-5 pb-5 pt-2 sm:px-8 sm:pb-7">
              <div className="mx-auto w-full" style={{ maxWidth: measure }}>
                <div className="mb-2 flex flex-wrap gap-2" hidden={!!intake.step}>
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
                    unsupportedLabel:
                      voice.availability === "insecure"
                        ? tb("voiceInsecure")
                        : tb("voiceUnsupported"),
                    requestingLabel: tb("voiceRequesting"),
                    listeningLabel: tb("voiceListening"),
                  }}
                />
                {voice.error && (
                  <p role="alert" className="mt-1.5 text-[13px]" style={{ color: "var(--warn)" }}>
                    {tb(voiceErrorKey(voice.error) as never)}
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
