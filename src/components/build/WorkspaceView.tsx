"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { AssistantMessage } from "@/lib/actions/assistant";
import type { AssistantPhase } from "@/lib/build/assistantPrompts";
import type { StructuredField } from "@/lib/build/snapshot";
import { AssistantChat } from "@/components/build/AssistantChat";
import { PreOutputWorkspace } from "@/components/build/PreOutputWorkspace";
import { ProjectOutputRenderer } from "@/components/build/ProjectOutputRenderer";
import { CodegenPreview } from "@/components/workspace/CodegenPreview";
import { AppPreview } from "@/components/workspace/AppPreview";
import { BuildScreen, OpenPreviewButton } from "@/components/workspace/BuildScreen";
import { IconEye } from "@/components/workspace-ui/parts";
import { VentrioLinkButton } from "@/components/ui/VentrioButton";
import type { CreationDirection } from "@/lib/build/creationTypes";
import type { Stage3ProjectOutput, Stage3Status } from "@/lib/build/stage3Types";
import type { Locale } from "@/i18n/locale";
import type { ProjectPublicationState } from "@/lib/publishing/types";
import type { WorkspaceUsage } from "@/lib/workspace/usage";

export interface WorkspaceViewProps {
  /** Read once on the server and handed down; the chat shows what is left. */
  usage: WorkspaceUsage;
  projectId: string;
  projectName: string;
  projectConcept: string | null;
  projectAudience: string | null;
  projectLocale: Locale;
  /** True for current-flow projects — opens on the pre-output conversation. */
  awaitingFirstVersion: boolean;
  /** Answers already confirmed in conversation, so the assistant does not re-ask. */
  savedFields: Partial<Record<StructuredField, string>>;
  assistant: {
    available: boolean;
    conversationId: string | null;
    messages: AssistantMessage[];
    phase: AssistantPhase;
  };
  openingMessage: string;
  publication: ProjectPublicationState | null;
  publicBaseUrl: string;
  stage3: {
    status: Stage3Status | null;
    direction: CreationDirection | null;
    output: Stage3ProjectOutput | null;
  };
  /** The generated site, when this project was built by the codegen renderer. */
  codegen: WorkspaceCodegenView | null;
  /** The generated application, when this project was built by app-runtime. */
  app: WorkspaceAppView | null;
}

/** A recompiled generated application, ready for a scripted sandbox frame. */
export interface WorkspaceAppView {
  generatedAt: string;
  title: string;
  /** The complete sandbox document, rebuilt from stored source on read. */
  document: string;
}

/** A recompiled codegen bundle, ready to hand to a sandboxed frame. */
export interface WorkspaceCodegenView {
  generatedAt: string;
  routes: Array<{ path: string; title: string; srcDoc: string }>;
}

// The Build canvas: the AI conversation as the dominant surface, with the
// generated version's preview opening beside it once one exists.
export function WorkspaceView(props: WorkspaceViewProps) {
  // Kept in state so a field the assistant just saved is reflected immediately
  // rather than after a navigation; the server revalidate reconciles it on the
  // next load.
  const [existingValues, setExistingValues] =
    useState<Partial<Record<StructuredField, string>>>(props.savedFields);

  function handleFieldSaved(field: StructuredField, value: string) {
    setExistingValues((prev) => ({ ...prev, [field]: value }));
  }

  if (props.awaitingFirstVersion) {
    return (
      <PreOutputWorkspace
        projectId={props.projectId}
        projectName={props.projectName}
        projectConcept={props.projectConcept}
        projectAudience={props.projectAudience}
        projectLocale={props.projectLocale}
        stage3Status={props.stage3.status}
        direction={props.stage3.direction}
        initialOutput={props.stage3.output}
        app={props.app}
        assistant={props.assistant}
        openingMessage={props.openingMessage}
        publication={props.publication}
        publicBaseUrl={props.publicBaseUrl}
        usage={props.usage}
      />
    );
  }

  // Either renderer counts. A codegen project has a site even though the old
  // artifact-shaped output is what the rest of the workspace still reads.
  const hasOutput = Boolean(props.stage3.output) || Boolean(props.codegen) || Boolean(props.app);
  // A draft has a preview but no address. Only a published project can be
  // linked to, so that is the only case the copy control is offered.
  const shareUrl =
    props.publication?.isPublished && props.publication.slug
      ? `${props.publicBaseUrl}/p/${props.publication.slug}`
      : null;

  return (
    <BuildScreen
      published={Boolean(props.publication?.isPublished)}
      shareUrl={shareUrl}
      /**
       * Codegen wins when a project has one, and there is no falling back to
       * the fixed renderer for a project it built.
       *
       * A silent fallback would make the canary meaningless — a codegen page
       * that failed to recompile would be replaced by the old renderer's
       * output, and whoever was comparing them would be shown the old one while
       * believing they were looking at the new. `compileStoredCodegen` returns
       * null only when the gate now refuses the stored bundle, and in that case
       * the honest thing is the empty state, not a substitute page.
       */
      preview={
        props.app
          ? (device) => (
              <AppPreview document={props.app!.document} device={device} title={props.app!.title} />
            )
          : props.codegen && props.codegen.routes.length > 0
          ? (device) => (
              <CodegenPreview
                srcDoc={props.codegen!.routes[0].srcDoc}
                device={device}
                title={props.codegen!.routes[0].title}
              />
            )
          : props.stage3.output
            ? (
                <ProjectOutputRenderer
                  projectKey={props.projectId}
                  output={props.stage3.output}
                  locale={props.projectLocale}
                  mode="preview"
                />
              )
            : null
      }
      chat={({ previewOpen, canOpenPreview, openPreview }) => (
        <AssistantChat
          variant="workspace"
          measure={previewOpen ? 560 : 820}
          usage={props.usage}
          projectId={props.projectId}
          available={props.assistant.available}
          initialConversationId={props.assistant.conversationId}
          initialMessages={props.assistant.messages}
          phase={props.assistant.phase}
          openingMessage={props.openingMessage}
          existingValues={existingValues}
          onFieldSaved={handleFieldSaved}
          footer={
            hasOutput && canOpenPreview ? (
              <ReadyCard onOpenPreview={openPreview} projectId={props.projectId} />
            ) : null
          }
        />
      )}
    />
  );
}

/**
 * The approved "first version ready" card, shown in the conversation when real
 * output exists and the preview panel is closed. It states only what is true —
 * something has been generated — and offers the two real destinations.
 */
function ReadyCard({ onOpenPreview, projectId }: { onOpenPreview: () => void; projectId: string }) {
  const t = useTranslations("workspace");
  return (
    <div
      className="rise rounded-[var(--r-lg)] border p-4"
      style={{ borderColor: "var(--line-accent)", background: "var(--surface)" }}
    >
      <p className="text-[14px] font-medium">{t("buildVersionReady")}</p>
      <p className="mt-1 text-[14px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
        {t("buildVersionReadyBody")}
      </p>
      <div className="mt-3.5 flex flex-wrap gap-2">
        <OpenPreviewButton onOpen={onOpenPreview} label={t("openPreview")} icon={<IconEye className="h-4 w-4" />} />
        <VentrioLinkButton href={`/projects/${projectId}/versions`} variant="secondary" size="sm">
          {t("navVersions")}
        </VentrioLinkButton>
      </div>
    </div>
  );
}
