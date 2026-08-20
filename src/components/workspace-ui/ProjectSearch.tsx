"use client";

import { Fragment, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/shadcn/command";
import {
  IconAnalytics,
  IconExternal,
  IconGlobe,
  IconOverview,
  IconPalette,
  IconPlus,
  IconProjects,
  IconSettings,
  IconShield,
  IconUser,
} from "./parts";
import { destinationsFor, type CommandIcon } from "@/lib/workspace/commandRegistry";
import { useLabelResolver } from "@/lib/workspace/useLabelResolver";

/** The registry names an icon; the palette owns the drawing. */
const ICONS: Record<CommandIcon, (p: { className?: string }) => React.ReactNode> = {
  plus: IconPlus,
  overview: IconOverview,
  projects: IconProjects,
  settings: IconSettings,
  analytics: IconAnalytics,
  user: IconUser,
  palette: IconPalette,
  globe: IconGlobe,
  shield: IconShield,
  external: IconExternal,
};

export interface SearchProject {
  id: string;
  name: string;
  accent: string;
}

/**
 * Search, over the things this product actually has.
 *
 * WHY IT IS A DIALOG AND NOT A FILTER. The gallery already filters as you type,
 * and that is the right tool there — you keep seeing the thumbnails. What was
 * missing is reaching a project from anywhere ELSE: from inside another
 * project, from settings, from the middle of a conversation. That meant going
 * back to the gallery first, every time.
 *
 * WHAT IT SEARCHES. Everything the product has, not just projects: the one
 * action worth taking from anywhere (new project), every route a signed-in
 * person can reach, all six Settings sections, and each individual setting
 * inside them — resolved from `commandRegistry`, which derives the Settings
 * half from the same constants that build the Settings navigation. There is no
 * second list to fall behind.
 *
 * KEYWORDS ARE WHY IT FINDS THINGS. cmdk matches the visible label unless you
 * hand it aliases, and nobody types the label. "billing" is not a word in this
 * product's UI, so without aliases it finds nothing while Pricing and the usage
 * meters both sit one click away. The aliases live in `settingsSearchKeywords`
 * per locale — the same object the Settings page's own search reads — so adding
 * a way to reach something never touches this file.
 *
 * Nothing here is invented: each row navigates somewhere that already exists.
 */
export function ProjectSearch({
  open,
  onOpenChange,
  projects,
  projectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: SearchProject[];
  /** When a project is open, its own pages are offered first. */
  projectId?: string;
}) {
  const t = useTranslations("workspace");
  const label = useLabelResolver();
  const router = useRouter();

  /**
   * The aliases, as one object per locale keyed by destination id.
   *
   * `t.raw` because this is data rather than a sentence: adding "billing" as a
   * way to reach Pricing should not require touching the registry, and a
   * missing entry is simply no aliases rather than an error.
   */
  const keywords = ((t as unknown as { raw: (key: string) => unknown }).raw(
    "settingsSearchKeywords",
  ) ?? {}) as Record<string, string>;

  // ⌘K / Ctrl-K, the binding people already try.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onOpenChange(!open);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  const destinations = destinationsFor(projectId);
  const groups = [
    { key: "action" as const, heading: t("searchGo") },
    { key: "page" as const, heading: t("navLabel") },
    { key: "settings" as const, heading: t("navSettings") },
  ];

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("searchTitle")}
      description={t("searchHint")}
      /* NO CLOSE BUTTON. It rendered inside the search row, level with the
         caret, so the first thing in a palette built for typing was a target
         for the mouse. Escape closes it, clicking the overlay closes it, and
         choosing anything closes it — the ✕ was a fourth way that cost the
         input its clean right edge. */
      showCloseButton={false}
    >
      <CommandInput placeholder={t("searchPlaceholder")} />
      <CommandList>
        <CommandEmpty>{t("searchNoResults")}</CommandEmpty>

        {groups.map(({ key, heading }, index) => {
          const rows = destinations.filter((d) => d.group === key);
          if (rows.length === 0) return null;
          return (
            <Fragment key={key}>
              {index > 0 && <CommandSeparator />}
              <CommandGroup heading={heading}>
                {rows.map((destination) => {
                  const Icon = ICONS[destination.icon];
                  const text = label(destination.label);
                  return (
                    <CommandItem
                      key={destination.id}
                      /* cmdk matches `value` and `keywords`. The label is the
                         value so what someone reads is what matches; the
                         aliases carry everything they might type instead. */
                      value={text}
                      keywords={(keywords[destination.id] ?? "").split(/\s+/).filter(Boolean)}
                      onSelect={() => go(destination.href)}
                    >
                      <Icon className="h-4 w-4" />
                      {text}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </Fragment>
          );
        })}

        {projects.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t("projectsTitle")}>
              {projects.map((project) => (
                <CommandItem
                  key={project.id}
                  /* cmdk matches on `value`; the id would never match a name
                     someone types, so the name is the value and the id is
                     carried by the closure. */
                  value={project.name || t("untitledProject")}
                  onSelect={() => go(`/projects/${project.id}`)}
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: project.accent }}
                    aria-hidden
                  />
                  <span className="truncate">{project.name || t("untitledProject")}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

/**
 * The trigger's keyboard hint, shown in the sidebar row.
 *
 * The platform is not knowable on the server, so the server renders the
 * neutral form and the client corrects it. Read through `useSyncExternalStore`
 * rather than set in an effect: it is readable during render, so there is no
 * state write after mount and no frame showing the wrong key.
 */
const subscribeNever = () => () => {};
const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform);

export function SearchShortcut() {
  const mac = useSyncExternalStore(subscribeNever, isMac, () => false);
  return <CommandShortcut>{mac ? "⌘K" : "Ctrl K"}</CommandShortcut>;
}
