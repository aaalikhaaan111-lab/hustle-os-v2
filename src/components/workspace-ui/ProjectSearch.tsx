"use client";

import { useEffect, useSyncExternalStore } from "react";
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
import { IconAnalytics, IconOverview, IconPlus, IconProjects, IconSettings } from "./parts";

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
 * It lists destinations and every project by name. Nothing here is invented:
 * each row navigates somewhere that already exists.
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
  const router = useRouter();

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

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("searchTitle")}
      description={t("searchHint")}
    >
      <CommandInput placeholder={t("searchPlaceholder")} />
      <CommandList>
        <CommandEmpty>{t("searchNoResults")}</CommandEmpty>

        <CommandGroup heading={t("searchGo")}>
          <CommandItem onSelect={() => go("/create")}>
            <IconPlus className="h-4 w-4" />
            {t("navNewProject")}
          </CommandItem>
          <CommandItem onSelect={() => go("/dashboard")}>
            <IconOverview className="h-4 w-4" />
            {t("navOverview")}
          </CommandItem>
          <CommandItem onSelect={() => go("/projects")}>
            <IconProjects className="h-4 w-4" />
            {t("projectsTitle")}
          </CommandItem>
          <CommandItem onSelect={() => go("/settings")}>
            <IconSettings className="h-4 w-4" />
            {t("navSettings")}
          </CommandItem>
          {projectId && (
            <CommandItem onSelect={() => go(`/projects/${projectId}/analytics`)}>
              <IconAnalytics className="h-4 w-4" />
              {t("navAnalytics")}
            </CommandItem>
          )}
        </CommandGroup>

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
