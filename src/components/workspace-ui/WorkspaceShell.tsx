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
 * The rail is 232px, labelled, and does not collapse.
 *
 * It was 68px of bare icons with tooltips. That is fine for someone who uses a
 * tool every day and learns the glyphs; it is hostile to the person this
 * product is for, who has never used a builder and should not have to hover a
 * shape to discover what it does. Every destination now says its own name.
 *
 * It still does not collapse. The toggle that used to be here existed mainly
 * to undo the cost of a 236px column, and a fixed width removes a piece of
 * state, a stored preference and two render paths through one function.
 */
const RAIL = 232;

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

  /**
   * `/create` is deliberately NOT in this list on desktop. It is the standing
   * button above the rail, and having it in both places put "New project" on
   * the screen three times — button, nav row, and the page's own action.
   * The phone tab bar still carries it, because there is no standing button
   * down there to carry it instead.
   */
  const primary: NavEntry[] = [
    { href: "/dashboard", label: t("navOverview"), Icon: IconOverview },
    { href: "/projects", label: t("projectsTitle"), Icon: IconProjects },
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
    <Link
      key={href}
      href={href}
      aria-current={isActive(href) ? "page" : undefined}
      className="s-nav-item h-10 w-full px-3"
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      <span className="min-w-0 truncate">{label}</span>
    </Link>
  );

  const rail = (
    <aside
      className="s-inset hidden shrink-0 flex-col border-r px-3 py-4 md:flex"
      style={{ width: RAIL, borderColor: "var(--color-border)" }}
    >
      <Link href="/dashboard" className="mb-5 flex items-center gap-2.5 px-2 py-1">
        <VentrioMark size={26} />
        <span className="text-[16px] font-semibold tracking-[-0.02em]">Ventrio</span>
      </Link>

      {/* Starting something new is the product's whole point, so it is a real
          button standing above the navigation rather than the third item in a
          list of places to go. */}
      <Link href="/create" className="s-btn s-btn--primary mb-5 w-full">
        <IconPlus className="h-4 w-4" />
        {t("navNewProject")}
      </Link>

      <nav aria-label={t("navLabel")} className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {primary.map(railLink)}

        {projectItems.length > 0 && (
          <>
            <p className="s-eyebrow mb-1 mt-5 px-3">{t("navThisProject")}</p>
            {projectItems.map(railLink)}
          </>
        )}

        {/* Recents belong in the rail only when no project is open — otherwise
            this project's own destinations are the ones that matter. Each
            carries the project's colour, the same one its preview uses, so it
            is recognisable before it is read. */}
        {!project && recent.length > 0 && (
          <>
            <p className="s-eyebrow mb-1 mt-5 px-3">{t("navRecent")}</p>
            {recent.slice(0, 5).map((item) => (
              <Link
                key={item.id}
                href={`/projects/${item.id}`}
                className="s-nav-item h-9 w-full px-3 text-[14px]"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: item.accent }}
                  aria-hidden
                />
                <span className="min-w-0 truncate">{item.name || t("untitledProject")}</span>
              </Link>
            ))}
          </>
        )}
      </nav>

      <div className="flex flex-col gap-0.5 border-t pt-3" style={{ borderColor: "var(--color-border)" }}>
        {railLink({ href: "/settings", label: t("navSettings"), Icon: IconSettings })}
        <Link href="/settings?section=profile" className="s-nav-item h-10 w-full px-3">
          <span
            className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full text-[10px] font-semibold"
            style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}
            aria-hidden
          >
            {initials}
          </span>
          <span className="min-w-0 truncate">{t("navAccount")}</span>
        </Link>
      </div>
    </aside>
  );

  /* ── Mobile bottom bar ────────────────────────────────────────────────── */

  const tabs: NavEntry[] = [
    ...primary,
    { href: "/create", label: t("navNewProject"), Icon: IconPlus },
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
          className="s-nav-item s-tab min-h-[56px] flex-1 flex-col items-center justify-center gap-1.5 rounded-none"
        >
          <Icon className="h-[20px] w-[20px]" />
          <span className="text-[11.5px] font-medium leading-none">{label}</span>
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
      {/* RENDERED ON `narrow`, NOT HIDDEN WITH A UTILITY.
          These used to be `md:hidden` and `hidden md:flex`, and BOTH were
          showing at every width — the header carried two back arrows side by
          side on a phone and on a 1440px screen. `.s-nav-item` sets
          `display: flex` and, like the button sheet, it is deliberately
          unlayered so Tailwind's preflight cannot reset it; an unlayered rule
          beats a layered utility whatever its specificity, so `hidden` and
          `md:flex` both lost to it silently.

          The shell already subscribes to the same media query for the tab bar,
          so the honest fix is to render one control or the other rather than
          to draw both and try to hide one.

          On a phone this is the ONLY way out of a project — the build route
          hides the tab bar, because the composer owns that edge. */}
      {narrow &&
        (project ? (
          <Link
            href="/projects"
            aria-label={t("projectsTitle")}
            className="s-nav-item h-10 w-10 shrink-0 items-center justify-center rounded-[var(--r-md)]"
          >
            <IconBack className="h-[18px] w-[18px]" />
          </Link>
        ) : (
          <Link href="/dashboard" aria-label="Ventrio" className="shrink-0">
            <VentrioMark size={24} />
          </Link>
        ))}

      {project ? (
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {!narrow && (
            <Link
              href="/projects"
              className="s-nav-item h-8 shrink-0 items-center gap-1.5 rounded-[var(--r-sm)] px-2 text-[13.5px] font-medium"
            >
              <IconBack className="h-4 w-4" />
              {t("projectsTitle")}
            </Link>
          )}
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
