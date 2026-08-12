"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  publishProjectAction,
  unpublishProjectAction,
  updatePublishedVersionAction,
} from "@/lib/actions/publishing";
import type { Locale } from "@/i18n/locale";
import type { Stage3ProjectOutput } from "@/lib/build/stage3Types";
import type { ProjectPublicationState, PublicationActionResult } from "@/lib/publishing/types";
import { publicationMatchesDraft } from "@/lib/publishing/snapshot";
import { cn } from "@/lib/utils";
import { FeedbackPanel } from "@/components/publishing/FeedbackPanel";

interface PublicationControlsProps {
  projectId: string;
  projectLocale: Locale;
  /**
   * The page artifact, when this project has one.
   *
   * Null for a project the app runtime built: it publishes an application, and
   * the two things this component needs from an artifact — a name to share and
   * a draft to compare — come from `shareTitle` and the publication itself
   * instead. Publishing is otherwise identical for both.
   */
  output: Stage3ProjectOutput | null;
  /** What to call this project when the share sheet opens. */
  shareTitle: string;
  /** One line for the share sheet, when the project has one to offer. */
  shareText?: string;
  initialPublication: ProjectPublicationState | null;
  publicBaseUrl: string;
  /**
   * Toolbar form: the publish actions alone.
   *
   * The dock used to sit in the conversation carrying the status, the URL, copy
   * and share, and the feedback panel. Publishing belongs over the preview, so
   * the actions moved there — but the toolbar already shows live/draft, already
   * copies the link and already opens the page, and repeating them beside
   * themselves is how a toolbar stops being readable. The feedback panel is a
   * conversation about responses and stays in the conversation.
   */
  compact?: boolean;
  onDraftChanged: (output: Stage3ProjectOutput) => void;
}

export function PublicationControls({
  compact = false,
  projectId,
  projectLocale,
  output,
  shareTitle,
  shareText,
  initialPublication,
  publicBaseUrl,
  onDraftChanged,
}: PublicationControlsProps) {
  const t = useTranslations("publishing");
  const [publication, setPublication] = useState(initialPublication);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const publicUrl = publication ? `${publicBaseUrl}/p/${publication.slug}` : null;
  /**
   * Only meaningful for a page artifact, which is a value we can compare.
   *
   * An application is republished on demand rather than diffed: comparing two
   * compiled projects would answer a question nobody asked, and the owner
   * already knows whether they have edited since publishing.
   */
  const hasUnpublishedChanges = useMemo(
    () =>
      !!publication?.isPublished
      && !!publication.output
      && !!output
      && !publicationMatchesDraft(publication.output, output),
    [output, publication],
  );

  function run(action: () => Promise<PublicationActionResult>) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.publication) setPublication(result.publication);
      if (result.message) setNotice(result.message);
    });
  }

  async function copyLink() {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setNotice(t("linkCopied"));
      setError(null);
    } catch {
      setError(t("copyFailed"));
    }
  }

  async function share() {
    if (!publicUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText ?? shareTitle,
          url: publicUrl,
        });
        return;
      } catch (shareError) {
        if (shareError instanceof DOMException && shareError.name === "AbortError") return;
      }
    }
    await copyLink();
  }

  function unpublish() {
    if (!window.confirm(t("unpublishConfirm"))) return;
    run(() => unpublishProjectAction(projectId));
  }

  const publishActions = (
    <>
      {!publication?.isPublished && (
        <button type="button" disabled={isPending} onClick={() => run(() => publishProjectAction(projectId))} className="publication-primary">
          {isPending ? t("publishing") : publication ? t("republish") : t("publish")}
        </button>
      )}
      {publication?.isPublished && hasUnpublishedChanges && (
        <button type="button" disabled={isPending} onClick={() => run(() => updatePublishedVersionAction(projectId))} className="publication-primary">
          {isPending ? t("updating") : t("updateLive")}
        </button>
      )}
    </>
  );

  if (compact) {
    return (
      <div className="flex shrink-0 items-center gap-1.5" aria-label={t("controlsLabel")}>
        {hasUnpublishedChanges && !publication?.isPublished && (
          <span className="publication-change-badge">{t("unpublishedChanges")}</span>
        )}
        {publishActions}
        {publication?.isPublished && (
          <button type="button" disabled={isPending} onClick={unpublish} className="publication-secondary publication-danger">
            {t("unpublish")}
          </button>
        )}
        {/* Errors are announced here rather than swallowed: the toolbar is
            where the action was taken, so it is where the answer belongs. */}
        {(notice || error) && (
          <span role={error ? "alert" : "status"} className={cn("publication-message", error && "is-error")}>
            {error ?? notice}
          </span>
        )}
      </div>
    );
  }

  return (
    <aside className="publication-dock" aria-label={t("controlsLabel")}>
      <div className="publication-dock-main">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("publication-status-dot", publication?.isPublished && "is-live")} aria-hidden />
            <p className="truncate text-xs font-semibold text-ink">
              {publication?.isPublished ? t("live") : publication ? t("draft") : t("privateDraft")}
            </p>
            {hasUnpublishedChanges && <span className="publication-change-badge">{t("unpublishedChanges")}</span>}
          </div>
          {publicUrl && (
            <p className="mt-1 truncate font-mono text-[10px] text-ink-muted">{publicUrl}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {!publication?.isPublished && (
            <button type="button" disabled={isPending} onClick={() => run(() => publishProjectAction(projectId))} className="publication-primary">
              {isPending ? t("publishing") : publication ? t("republish") : t("publish")}
            </button>
          )}
          {publication?.isPublished && hasUnpublishedChanges && (
            <button type="button" disabled={isPending} onClick={() => run(() => updatePublishedVersionAction(projectId))} className="publication-primary">
              {isPending ? t("updating") : t("updateLive")}
            </button>
          )}
          {publication?.isPublished && publicUrl && (
            <>
              <a href={publicUrl} target="_blank" rel="noreferrer" className="publication-secondary">{t("open")}</a>
              <button type="button" onClick={copyLink} className="publication-secondary">{t("copyLink")}</button>
              <button type="button" onClick={share} className="publication-secondary">{t("share")}</button>
              <button type="button" disabled={isPending} onClick={unpublish} className="publication-secondary publication-danger">{t("unpublish")}</button>
            </>
          )}
        </div>
      </div>

      {(notice || error) && (
        <p role={error ? "alert" : "status"} className={cn("publication-message", error && "is-error")}>
          {error ?? notice}
        </p>
      )}

      {publication && (
        <FeedbackPanel
          projectId={projectId}
          projectLocale={projectLocale}
          publication={publication}
          onDraftChanged={onDraftChanged}
        />
      )}
    </aside>
  );
}
