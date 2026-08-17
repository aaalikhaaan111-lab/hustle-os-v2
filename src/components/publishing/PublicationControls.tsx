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
import { toast } from "sonner";
import { Spinner } from "@/components/ui/shadcn/spinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/shadcn/alert-dialog";

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
  const tCommon = useTranslations("common");
  const [publication, setPublication] = useState(initialPublication);
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

  /**
   * PUBLISH FEEDBACK IS A TOAST NOW.
   *
   * It used to be a string held in local state and rendered inline in the
   * toolbar, which had two costs. It disrupted the row it appeared in — that
   * is why the message ended up absolutely positioned under the controls — and
   * because it lived next to the button, it was invisible the moment the
   * preview was closed or the person had scrolled. A toast is read wherever
   * they happen to be looking and does not move anything.
   */
  function run(action: () => Promise<PublicationActionResult>) {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.publication) setPublication(result.publication);
      if (result.message) toast.success(result.message);
    });
  }

  async function copyLink() {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success(t("linkCopied"));
    } catch {
      /* A refused clipboard is not rare — an unfocused document rejects the
         API outright — and silence leaves the button looking broken with
         nothing to paste. */
      toast.error(t("copyFailed"));
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

  /**
   * Taking a live page offline is the one destructive action here, so it is
   * confirmed. It was `window.confirm` — a browser modal that cannot be styled,
   * cannot be translated beyond its two fixed buttons, and on iOS blocks the
   * page until dismissed. `AlertDialog` is the same guard, in the product's own
   * language and typography.
   */
  const unpublishConfirm = (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button type="button" disabled={isPending} className="publication-secondary publication-danger">
          {t("unpublish")}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("unpublish")}</AlertDialogTitle>
          <AlertDialogDescription>{t("unpublishConfirm")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={() => run(() => unpublishProjectAction(projectId))}>
            {t("unpublish")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const publishActions = (
    <>
      {!publication?.isPublished && (
        <button type="button" disabled={isPending} onClick={() => run(() => publishProjectAction(projectId))} className="publication-primary">
          {isPending && <Spinner className="size-4" />}
          {isPending ? t("publishing") : publication ? t("republish") : t("publish")}
        </button>
      )}
      {publication?.isPublished && hasUnpublishedChanges && (
        <button type="button" disabled={isPending} onClick={() => run(() => updatePublishedVersionAction(projectId))} className="publication-primary">
          {isPending && <Spinner className="size-4" />}
          {isPending ? t("updating") : t("updateLive")}
        </button>
      )}
    </>
  );

  if (compact) {
    return (
      <div className="relative flex shrink-0 items-center gap-1.5" aria-label={t("controlsLabel")}>
        {hasUnpublishedChanges && !publication?.isPublished && (
          <span className="publication-change-badge">{t("unpublishedChanges")}</span>
        )}
        {publishActions}
        {publication?.isPublished && unpublishConfirm}
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
              {isPending && <Spinner className="size-4" />}
          {isPending ? t("publishing") : publication ? t("republish") : t("publish")}
            </button>
          )}
          {publication?.isPublished && hasUnpublishedChanges && (
            <button type="button" disabled={isPending} onClick={() => run(() => updatePublishedVersionAction(projectId))} className="publication-primary">
              {isPending && <Spinner className="size-4" />}
          {isPending ? t("updating") : t("updateLive")}
            </button>
          )}
          {publication?.isPublished && publicUrl && (
            <>
              <a href={publicUrl} target="_blank" rel="noreferrer" className="publication-secondary">{t("open")}</a>
              <button type="button" onClick={copyLink} className="publication-secondary">{t("copyLink")}</button>
              <button type="button" onClick={share} className="publication-secondary">{t("share")}</button>
              {unpublishConfirm}
            </>
          )}
        </div>
      </div>

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
