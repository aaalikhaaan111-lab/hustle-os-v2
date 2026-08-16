"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useSyncExternalStore, type ReactNode } from "react";
import { useAppViewport } from "@/lib/workspace/useAppViewport";
import {
  IconAnalytics,
  IconBack,
  IconBuild,
  IconOverview,
  IconPlus,
  IconProjects,
  IconSettings,
  StatusPill,
  VentrioMark,
  type ProjectState,
} from "./parts";
import { Tooltip } from "./Tooltip";

export interface ShellProject {
  id: string;
  name: string;
  state: ProjectState;
}

export interface ShellRecent {
  id: string;
  name: string;
  accent: string;
}

export interface WorkspaceShellProps {
  project?: ShellProject;
  recent?: ShellRecent[];
  initials: string;
  /** Accepted and ignored — the rail has one width now. See below. */
  defaultCollapsed?: boolean;
  /** Build fills the frame exactly and scrolls internally. */
  fill?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * The rail is 68px and does not expand.
 *
 * It used to be a 236px column of labelled rows that collapsed to 76px, with a
 * toggle, a stored preference, a tooltip mode and two render paths through the
 * same function. Five destinations do not need 236px of chrome, and the toggle
 * existed mainly to undo the cost of the width. Icons with tooltips, at one
 * fixed width, removes the state and gives the width back to the work.
 */
const RAIL = 68;

const NARROW_QUERY = "(max-width: 767px)";

function subscribeToNarrow(onChange: () => void) {
  const media = window.matchMedia(NARROW_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

type NavEntry = { href: string; label: string; Icon: (p: { className?: string }) => ReactNode };

/**
 * The studio frame.
 *
 * WHAT CHANGED, structurally — this is not the old shell restyled.
 *
 * THE SHEET IS GONE. Content used to sit on a rounded white panel, inset from a
 * grey desk, with its own border and a cast shadow. Every page was therefore a
 * box inside a box, and the real estate went to the gap between them. The page
 * now sits directly in the room; the rail and the header are separated from it
 * by a hairline, which is all the separation a frame needs.
 *
 * THE DRAWER IS GONE. On a phone the whole product hid behind one unlabelled
 * hamburger — four destinations, invisible until you knew to look. There is a
 * bottom tab bar instead, which is what a person holding a phone can reach and
 * what every application they already use does.
 *
 * THE GLASS IS GONE. The rail was a translucent blurred column floating over
 * two radial violet blooms. On a dark ground that is just an expensive way to
 * draw a slightly different grey, and the blur forced a compositing layer the
 * height of the screen.
 */
export function WorkspaceShell({
  project,
  recent = [],
  initials,
  fill = false,
  actions,
  children,
}: WorkspaceShellProps) {
  // Tracks the visual viewport so the keyboard cannot push the conversation off
  // the top. See the hook — svh alone does not react to a keyboard.
  useAppViewport();

  const t = useTranslations("workspace");
  const pathname = usePathname();
  const narrow = useSyncExternalStore(
    subscribeToNarrow,
    () => window.matchMedia(NARROW_QUERY).matches,
    () => false
  );

  const primary: NavEntry[] = [
    { href: "/dashboard", label: t("navOverview"), Icon: IconOverview },
    { href: "/projects", label: t("projectsTitle"), Icon: IconProjects },
    { href: "/create", label: t("navNewProject"), Icon: IconPlus },
  ];

  const projectItems: NavEntry[] = project
    ? [
        { href: `/projects/${project.id}`, label: t("navBuild"), Icon: IconBuild },
        { href: `/projects/${project.id}/analytics`, label: t("navAnalytics"), Icon: IconAnalytics },
      ]
    : [];

  const isActive = (href: string) => pathname === href;

  /* ── Desktop rail ─────────────────────────────────────────────────────── */

  const railLink = ({ href, label, Icon }: NavEntry) => (
    <Tooltip key={href} label={label}>
      <Link
        href={href}
        aria-label={label}
        aria-current={isActive(href) ? "page" : undefined}
        className="s-nav-item h-11 w-11 items-center justify-center rounded-[var(--r-md)]"
      >
        <Icon className="h-[19px] w-[19px]" />
      </Link>
    </Tooltip>
  );

  const rail = (
    <aside
      className="s-inset hidden shrink-0 flex-col items-center border-r py-4 md:flex"
      style={{ width: RAIL, borderColor: "var(--color-border)" }}
    >
      <Link href="/dashboard" aria-label="Ventrio" className="mb-6 rounded-[var(--r-sm)]">
        <VentrioMark size={26} />
      </Link>

      <nav aria-label={t("navLabel")} className="flex flex-1 flex-col items-center gap-1">
        {primary.map(railLink)}

        {projectItems.length > 0 && (
          <>
            <span
              className="my-2 h-px w-6 shrink-0"
              style={{ background: "var(--color-border)" }}
              aria-hidden
            />
            {projectItems.map(railLink)}
          </>
        )}

        {/* Recents are a rail affordance only when there is no project open —
            otherwise the project's own destinations are the ones that matter.
            Each is the project's colour, which is the same colour its preview
            uses, so it is recognisable before it is read. */}
        {!project && recent.length > 0 && (
          <>
            <span
              className="my-2 h-px w-6 shrink-0"
              style={{ background: "var(--color-border)" }}
              aria-hidden
            />
            {recent.slice(0, 4).map((item) => (
              <Tooltip key={item.id} label={item.name || t("untitledProject")}>
                <Link
                  href={`/projects/${item.id}`}
                  aria-label={item.name || t("untitledProject")}
                  className="s-nav-item h-11 w-11 items-center justify-center rounded-[var(--r-md)]"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: item.accent }}
                    aria-hidden
                  />
                </Link>
              </Tooltip>
            ))}
          </>
        )}
      </nav>

      <div className="flex flex-col items-center gap-1">
        {railLink({ href: "/settings", label: t("navSettings"), Icon: IconSettings })}
        <Tooltip label={t("navAccount")}>
          <Link
            href="/settings?section=profile"
            aria-label={t("navAccount")}
            className="s-nav-item h-11 w-11 items-center justify-center rounded-[var(--r-md)]"
          >
            <span
              className="grid h-[26px] w-[26px] place-items-center rounded-full text-[11px] font-semibold"
              style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}
            >
              {initials}
            </span>
          </Link>
        </Tooltip>
      </div>
    </aside>
  );

  /* ── Mobile bottom bar ────────────────────────────────────────────────── */

  const tabs: NavEntry[] = [
    ...primary,
    { href: "/settings", label: t("navSettings"), Icon: IconSettings },
  ];

  const bottomBar = (
    <nav
      aria-label={t("navLabel")}
      className="s-inset flex shrink-0 items-stretch border-t md:hidden"
      style={{
        borderColor: "var(--color-border)",
        // The home indicator sits over the last few pixels of the screen.
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {tabs.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(href) ? "page" : undefined}
          className="s-nav-item s-tab min-h-[52px] flex-1 flex-col items-center justify-center gap-1 rounded-none"
        >
          <Icon className="h-[20px] w-[20px]" />
          <span className="text-[10.5px] font-medium leading-none">{label}</span>
        </Link>
      ))}
    </nav>
  );

  /* ── Header ───────────────────────────────────────────────────────────── */

  const header = (
    <header
      className="flex h-14 shrink-0 items-center gap-3 border-b px-4 sm:px-6"
      style={{ borderColor: "var(--color-border)" }}
    >
      {/* On a phone the rail is not there to carry the mark, so the header
          does — and it doubles as the way home. Inside a project it gives way
          to the back control: the build route hides the tab bar (the composer
          owns that edge), so this is the ONLY way out on a phone and it cannot
          be the thing that gets dropped at a small width. */}
      {project ? (
        <Link
          href="/projects"
          aria-label={t("projectsTitle")}
          className="s-nav-item h-10 w-10 shrink-0 items-center justify-center rounded-[var(--r-md)] md:hidden"
        >
          <IconBack className="h-[18px] w-[18px]" />
        </Link>
      ) : (
        <Link href="/dashboard" aria-label="Ventrio" className="shrink-0 md:hidden">
          <VentrioMark size={24} />
        </Link>
      )}

      {project ? (
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <Link
            href="/projects"
            /* `md`, not `sm`. The icon-only back control below is `md:hidden`,
               so at `sm` both rendered and the header carried two back
               arrows side by side between 640 and 768px. */
            className="s-nav-item hidden h-8 shrink-0 items-center gap-1.5 rounded-[var(--r-sm)] px-2 text-[13.5px] font-medium md:flex"
          >
            <IconBack className="h-4 w-4" />
            {t("projectsTitle")}
          </Link>
          <span className="min-w-0 truncate text-[15px] font-medium tracking-[-0.015em]">
            {project.name || t("untitledProject")}
          </span>
          <StatusPill state={project.state} />
        </div>
      ) : (
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium tracking-[-0.015em]">
          {pathname === "/settings"
            ? t("navSettings")
            : pathname === "/projects"
              ? t("projectsTitle")
              : pathname === "/create"
                ? t("navNewProject")
                : t("navOverview")}
        </span>
      )}

      <div className="flex shrink-0 items-center gap-2">{actions}</div>
    </header>
  );

  return (
    <div className="studio studio-room studio-frame flex w-full overflow-hidden">
      {rail}

      <div className="flex min-w-0 flex-1 flex-col">
        {header}

        <main className={`relative min-h-0 flex-1 ${fill ? "overflow-hidden" : "overflow-auto"}`}>
          {/* Keyed on the route so each page arrives rather than swapping. */}
          <div key={pathname} className="s-enter h-full">
            {children}
          </div>
        </main>

        {/* The build screen fills the frame and owns its own bottom edge; a tab
            bar under it would sit on top of the composer. Every other route
            gets the bar. */}
        {narrow && !fill && bottomBar}
      </div>
    </div>
  );
}
