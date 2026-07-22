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
  output: Stage3ProjectOutput;
  initialPublication: ProjectPublicationState | null;
  publicBaseUrl: string;
  onDraftChanged: (output: Stage3ProjectOutput) => void;
}

export function PublicationControls({
  projectId,
  projectLocale,
  output,
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
  const hasUnpublishedChanges = useMemo(
    () => !!publication?.isPublished && !publicationMatchesDraft(publication.output, output),
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
          title: output.identity.name,
          text: output.launchCopy.shortPost,
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
