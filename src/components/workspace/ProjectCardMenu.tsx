"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/shadcn/dropdown-menu";
import { publicProjectUrl } from "@/lib/publishing/publicUrl";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/shadcn/context-menu";

/**
 * Secondary actions on a project card.
 *
 * Every action here already existed — opening the live page, copying its link —
 * but only from inside the project, so getting a link to something you
 * published meant: open it, wait for the workspace, open the preview, find the
 * toolbar. From the gallery it is now two clicks.
 *
 * NOTHING NEW IS INVENTED. No rename, no duplicate, no delete: the product has
 * no action behind any of them, and a menu item that opens a dialog which
 * cannot do anything is worse than no menu.
 *
 * The actions are declared once as data and rendered into both menus, because
 * right-click is what people try on a card grid and a visible button is what
 * they find without trying — and the two must never drift apart.
 */
type Action =
  | { key: string; label: string; href: string; external?: boolean }
  | { key: string; label: string; onSelect: () => void };

export function ProjectCardMenu({
  children,
  slug,
  projectId,
}: {
  children: React.ReactNode;
  /** The public slug when the project is live, null when it is not. */
  slug: string | null;
  projectId: string;
}) {
  const t = useTranslations("workspace");

  // The canonical address — the same one the publish toolbar copies, so the
  // link people get from the gallery is the link they get from inside.
  const shareUrl = slug ? publicProjectUrl(slug) : null;

  async function copy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success(t("previewLinkCopied"));
    } catch {
      // A refused clipboard is not rare, and silence leaves nothing to paste.
      toast.error(t("previewLinkCopyFailed"));
    }
  }

  const actions: Action[] = [
    { key: "open", label: t("openProject"), href: `/projects/${projectId}` },
    ...(shareUrl
      ? [
          { key: "copy", label: t("copyPreviewLink"), onSelect: copy },
          { key: "live", label: t("openPublicPage"), href: shareUrl, external: true },
        ]
      : []),
  ];

  const body = (action: Action) =>
    "href" in action ? (
      action.external ? (
        <a href={action.href} target="_blank" rel="noreferrer">
          {action.label}
        </a>
      ) : (
        <Link href={action.href}>{action.label}</Link>
      )
    ) : null;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="group/card relative">
          {children}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={t("moreActions")}
                /* Sizing belongs to .s-btn--icon, which is unlayered and would
                   beat a Tailwind width anyway. .s-card-action owns the reveal. */
                className="s-btn s-btn--secondary s-btn--icon s-card-action absolute right-2 top-2 transition-opacity"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {actions.map((action) =>
                "href" in action ? (
                  <DropdownMenuItem key={action.key} asChild>
                    {body(action)}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem key={action.key} onSelect={action.onSelect}>
                    {action.label}
                  </DropdownMenuItem>
                ),
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent>
        {actions.map((action) =>
          "href" in action ? (
            <ContextMenuItem key={action.key} asChild>
              {body(action)}
            </ContextMenuItem>
          ) : (
            <ContextMenuItem key={action.key} onSelect={action.onSelect}>
              {action.label}
            </ContextMenuItem>
          ),
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
