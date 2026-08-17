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
 * The sidebar is 244px, labelled, and does not collapse.
 *
 * It was 68px of bare icons with tooltips — fine for someone who uses a tool
 * daily and learns the glyphs, hostile to a person who has never opened a
 * builder. Every destination says its own name, and the column fills: the
 * work you have made is listed in it, which is both the fastest way back into
 * a project and the reason the rail is no longer three rows over 600px of
 * nothing.
 */
const RAIL = 244;

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

  /* ── The sidebar ──────────────────────────────────────────────────────
     Identity, the one action the product is for, where you can go, everything
     you have made, then you. */

  const railLink = ({ href, label, Icon }: NavEntry) => (
    <Link
      key={href}
      href={href}
      aria-current={isActive(href) ? "page" : undefined}
      className="s-nav-item h-9 w-full px-3"
    >
      <Icon className="h-[17px] w-[17px] shrink-0" />
      <span className="min-w-0 truncate">{label}</span>
    </Link>
  );

  const rail = (
    <aside
      className="hidden shrink-0 flex-col border-r px-3 pb-3 pt-4 md:flex"
      style={{ width: RAIL, borderColor: "var(--color-border)", background: "var(--color-surface)" }}
    >
      <Link href="/dashboard" className="mb-4 flex items-center gap-2.5 px-2">
        <VentrioMark size={24} />
        <span
          className="text-[19px] font-medium tracking-[-0.01em]"
          style={{ fontFamily: "var(--font-display), Georgia, serif" }}
        >
          Ventrio
        </span>
      </Link>

      <Link href="/create" className="s-btn s-btn--primary mb-5 w-full">
        <IconPlus className="h-4 w-4" />
        {t("navNewProject")}
      </Link>

      <nav aria-label={t("navLabel")} className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {primary.map(railLink)}

        {projectItems.length > 0 && (
          <>
            <p className="s-eyebrow mb-1 mt-5 px-3">{t("navThisProject")}</p>
            {projectItems.map(railLink)}
          </>
        )}

        {/* EVERYTHING YOU HAVE MADE, listed. Each carries the project's own
            colour — the same one its preview uses — so it is recognisable
            before it is read. */}
        {!project && recent.length > 0 && (
          <>
            <p className="s-eyebrow mb-1 mt-6 px-3">{t("navRecent")}</p>
            {recent.slice(0, 8).map((item) => (
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

      <div className="mt-3 flex flex-col gap-0.5 border-t pt-3" style={{ borderColor: "var(--color-border)" }}>
        {railLink({ href: "/settings", label: t("navSettings"), Icon: IconSettings })}
        <Link href="/settings?section=profile" className="s-nav-item h-11 w-full px-3">
          <span
            className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full text-[11px] font-semibold"
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
      className="flex shrink-0 items-stretch border-t md:hidden"
      style={{
        borderColor: "var(--color-border)",
        background: "var(--color-surface)",
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

  /* ── The bar, and there is only one, and only on a phone ──────────────
     THE GLOBAL HEADER IS GONE ON DESKTOP.

     It was a 56px strip naming the current screen — above a sidebar that
     already highlights the current screen, and above a page whose own title
     said it a third time: "Projects / Projects / 18 projects." It cost a rule
     across the top of every page and 56px of the only dimension a conversation
     needs.

     On a phone there is no sidebar, so something has to carry the way back and
     the name of where you are. That is all this is. In the workspace the
     project's identity lives in the head of the conversation card, beside the
     work. */

  const mobileBar = (
    <header
      className="flex h-14 shrink-0 items-center gap-3 border-b px-4 md:hidden"
      style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
    >
      {project ? (
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
      )}

      <span
        className="min-w-0 flex-1 truncate text-[17px] font-medium"
        style={{ fontFamily: "var(--font-display), Georgia, serif" }}
      >
        {project
          ? project.name || t("untitledProject")
          : pathname === "/settings"
            ? t("navSettings")
            : pathname === "/projects"
              ? t("projectsTitle")
              : pathname === "/create"
                ? t("navNewProject")
                : t("navOverview")}
      </span>

      {project && <StatusPill state={project.state} />}
      <div className="flex shrink-0 items-center gap-2">{actions}</div>
    </header>
  );

  return (
    <div className="studio studio-room studio-frame flex w-full overflow-hidden">
      {rail}

      <div className="flex min-w-0 flex-1 flex-col">
        {narrow && mobileBar}

        <main className={`relative min-h-0 flex-1 ${fill ? "overflow-hidden" : "overflow-auto"}`}>
          {/* Keyed on the route so each page arrives rather than swapping. */}
          <div key={pathname} className="s-enter h-full">
            {children}
          </div>
        </main>

        {/* The build screen fills the frame and owns its own bottom edge; a tab
            bar under it would sit on top of the composer. */}
        {narrow && !fill && bottomBar}
      </div>
    </div>
  );
}
