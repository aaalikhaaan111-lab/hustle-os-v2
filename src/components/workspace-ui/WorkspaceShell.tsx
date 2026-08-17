"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useSyncExternalStore, type ReactNode } from "react";
import { useAppViewport } from "@/lib/workspace/useAppViewport";
import {
  sidebarCollapsed,
  sidebarCollapsedServer,
  subscribeSidebarCollapsed,
  toggleSidebarCollapsed,
} from "@/lib/workspace/sidebarCollapse";
import { Tooltip } from "./Tooltip";
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
/** Wide enough for a 36px row plus the padding either side. */
const RAIL_COLLAPSED = 60;

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
   * THE SIDEBAR COLLAPSES FROM THE LOGO.
   *
   * Backed by a store rather than component state so the value is readable
   * during render, writable from the click, and the same on the server as on
   * the first client render. See `sidebarCollapse.ts` for why the server
   * snapshot is always `false`.
   */
  const collapsed = useSyncExternalStore(
    subscribeSidebarCollapsed,
    sidebarCollapsed,
    sidebarCollapsedServer,
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

  /**
   * One row, two states. Collapsed, the label is removed from the flow by CSS
   * (`[data-collapsed]`) rather than hidden with a utility — hiding the text
   * alone leaves its gap behind and the icon sits visibly off-centre. The
   * tooltip carries the name, and `aria-label` carries it for assistive tech,
   * so a collapsed rail is never a column of unexplained glyphs.
   */
  const railLink = ({ href, label, Icon }: NavEntry) => {
    const row = (
      <Link
        key={href}
        href={href}
        aria-current={isActive(href) ? "page" : undefined}
        aria-label={collapsed ? label : undefined}
        data-collapsed={collapsed || undefined}
        className="s-nav-item h-9 w-full px-2.5"
      >
        <Icon className="h-[17px] w-[17px] shrink-0" />
        <span className="min-w-0 truncate">{label}</span>
      </Link>
    );
    return collapsed ? (
      <Tooltip key={href} label={label}>
        {row}
      </Tooltip>
    ) : (
      row
    );
  };

  const rail = (
    <aside
      className="hidden shrink-0 flex-col border-r px-2 pb-2 pt-3 transition-[width] md:flex"
      style={{
        width: collapsed ? RAIL_COLLAPSED : RAIL,
        borderColor: "var(--sidebar-border)",
        background: "var(--sidebar)",
        transitionDuration: "var(--t-base)",
      }}
    >
      {/* THE LOGO IS THE TOGGLE.
          It was a link to the dashboard, which the first nav row already is —
          so the mark was doing a job something else did better, and the
          sidebar had no way to collapse at all. A button, with the state in
          `aria-expanded` and the name in a tooltip when there is no room for
          one. */}
      <Tooltip label={collapsed ? t("sidebarExpand") : t("sidebarCollapse")}>
        <button
          type="button"
          onClick={toggleSidebarCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? t("sidebarExpand") : t("sidebarCollapse")}
          className="s-nav-item mb-3 h-10 w-full shrink-0 px-2.5"
          data-collapsed={collapsed || undefined}
        >
          <VentrioMark size={22} />
          <span className="min-w-0 truncate text-[15px] font-semibold tracking-[-0.01em]">Ventrio</span>
        </button>
      </Tooltip>

      {collapsed ? (
        <Tooltip label={t("navNewProject")}>
          <Link
            href="/create"
            aria-label={t("navNewProject")}
            className="s-btn s-btn--primary mb-3 h-9 w-full px-0"
          >
            <IconPlus className="h-4 w-4" />
          </Link>
        </Tooltip>
      ) : (
        <Link href="/create" className="s-btn s-btn--primary mb-3 w-full">
          <IconPlus className="h-4 w-4" />
          {t("navNewProject")}
        </Link>
      )}

      <nav aria-label={t("navLabel")} className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden">
        {primary.map(railLink)}

        {projectItems.length > 0 && (
          <>
            {!collapsed && <p className="s-eyebrow mb-1 mt-4 px-2.5">{t("navThisProject")}</p>}
            {collapsed && <span className="my-2 h-px w-full shrink-0" style={{ background: "var(--sidebar-border)" }} aria-hidden />}
            {projectItems.map(railLink)}
          </>
        )}

        {/* Everything you have made. Hidden when collapsed: a column of eight
            identical dots is not a list of projects. */}
        {!project && !collapsed && recent.length > 0 && (
          <>
            <p className="s-eyebrow mb-1 mt-4 px-2.5">{t("navRecent")}</p>
            {recent.slice(0, 8).map((item) => (
              <Link
                key={item.id}
                href={`/projects/${item.id}`}
                className="s-nav-item h-8 w-full px-2.5 text-[13.5px]"
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: item.accent }}
                  aria-hidden
                />
                <span className="min-w-0 truncate">{item.name || t("untitledProject")}</span>
              </Link>
            ))}
          </>
        )}
      </nav>

      <div className="mt-2 flex flex-col gap-0.5 border-t pt-2" style={{ borderColor: "var(--sidebar-border)" }}>
        {railLink({ href: "/settings", label: t("navSettings"), Icon: IconSettings })}
        {(() => {
          const row = (
            <Link
              href="/settings?section=profile"
              aria-label={collapsed ? t("navAccount") : undefined}
              data-collapsed={collapsed || undefined}
              className="s-nav-item h-9 w-full px-2.5"
            >
              <span
                className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full text-[10px] font-semibold"
                style={{ background: "var(--secondary)", color: "var(--secondary-foreground)" }}
                aria-hidden
              >
                {initials}
              </span>
              <span className="min-w-0 truncate">{t("navAccount")}</span>
            </Link>
          );
          return collapsed ? <Tooltip label={t("navAccount")}>{row}</Tooltip> : row;
        })()}
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
