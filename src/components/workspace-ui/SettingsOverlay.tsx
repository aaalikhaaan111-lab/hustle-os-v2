"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/shadcn/dialog";
import { Skeleton } from "@/components/ui/shadcn/skeleton";
import { SettingsClient, type SettingsSection } from "@/app/settings/SettingsClient";
import { loadSettingsDataAction, type SettingsData } from "@/lib/actions/settings";

/**
 * Settings, over the application rather than instead of it.
 *
 * WHY IT IS NOT A PAGE ANY MORE. Changing your display name or your language
 * is not a destination — it is a short errand you run in the middle of
 * something else. As a route it unmounted whatever you were doing, and coming
 * back meant navigating back and hoping the workspace restored the same
 * conversation and the same preview state. As an overlay, closing it puts you
 * back exactly where you were because you never left.
 *
 * The backdrop is dimmed AND blurred: dimming alone leaves the page legible
 * enough to keep competing for attention, and the blur says "this is still
 * here, it is just not what you are doing right now".
 *
 * The route survives untouched for deep links and for anyone who lands on
 * /settings directly. Both render the same `SettingsClient`, so there is one
 * settings implementation and no chance of the two drifting.
 */
export function SettingsOverlay({
  open,
  onOpenChange,
  section,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section: SettingsSection;
}) {
  const t = useTranslations("workspace");
  const [data, setData] = useState<SettingsData | null>(null);

  // Fetched on first open, then kept. Nothing here changes underneath the
  // person while the panel is shut, and re-reading on every open would make
  // the panel flicker each time it is raised.
  useEffect(() => {
    if (!open || data) return;
    let cancelled = false;
    void loadSettingsDataAction().then((result) => {
      if (!cancelled && result) setData(result);
    });
    return () => {
      cancelled = true;
    };
  }, [open, data]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        /* Wide and tall, because this holds a two-column screen rather than a
           confirmation. It stops short of the viewport on both axes so the
           dimmed application stays visible around it — that framing is what
           makes it read as "over" rather than as another page. */
        /* `studio` MATTERS HERE. The dialog portals to <body>, which puts it
           outside the shell that carries the platform's token scope — so
           without this the panel rendered with the old global palette: a
           violet Save button and a violet avatar in a product whose primary is
           near-black. Re-declaring the scope on the portalled content is what
           keeps the overlay part of the same design system as the page behind
           it. */
        /* A FIXED PANEL, NOT ONE THAT RESIZES PER SECTION.
           The dialog sized itself to its contents, so moving from Usage to
           Privacy visibly grew or shrank the whole window — the frame jumping
           around the thing you were reading. The panel now takes one size and
           keeps it; only the content area changes, and it scrolls inside if a
           section is taller. */
        className="studio h-[min(38rem,calc(100dvh-3rem))] w-[calc(100%-1.5rem)] max-w-5xl gap-0 overflow-hidden p-0 sm:max-w-5xl"
      >
        {/* Named for screen readers; the panel draws its own visible heading. */}
        <DialogTitle className="sr-only">{t("settingsTitle")}</DialogTitle>

        <div className="h-full overflow-y-auto overscroll-contain">
          {data ? (
            <SettingsClient
              initialSection={section}
              email={data.email}
              displayName={data.displayName}
              usage={data.usage}
              embedded
            />
          ) : (
            /* The panel's own shape while it loads, so opening it does not
               flash an empty box the size of the screen. */
            <div className="flex flex-col gap-8 p-6 md:flex-row md:gap-12 md:p-10">
              <div className="flex shrink-0 flex-col gap-2 md:w-52">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-9 w-full" />
                ))}
              </div>
              <div className="min-w-0 flex-1 md:max-w-[640px]">
                <Skeleton className="h-64 w-full" />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
