"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import {
  IconAnalytics,
  IconBack,
  IconBuild,
  IconClose,
  IconCollapse,
  IconOverview,
  IconPlus,
  IconProjects,
  IconSettings,
  IconVersions,
  StatusPill,
  VentrioMark,
  type ProjectState,
} from "./parts";
import { VentrioButton } from "@/components/ui/VentrioButton";
import { Tooltip } from "./Tooltip";
import "./tokens.css";

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
  /** The project being worked on, when one is open. */
  project?: ShellProject;
  /** The signed-in user's real recent projects — never demo content. */
  recent?: ShellRecent[];
  initials: string;
  /** Build asks for the compact rail so the work gets the width. */
  defaultCollapsed?: boolean;
  /**
   * Build fills the sheet exactly and scrolls internally — the sheet itself
   * must not scroll, or the composer leaves the bottom of the screen.
   */
  fill?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}

const RAIL_WIDE = 236;
const RAIL_NARROW = 76;

/** Below this the rail becomes a drawer and the menu button appears. */
const RAIL_QUERY = "(max-width: 767px)";

function subscribeToNarrow(onChange: () => void) {
  const media = window.matchMedia(RAIL_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/**
 * The workspace frame: a warm gray desk, with the page laid on it as one
 * rounded near-white sheet.
 *
 * The rail and the top bar belong to the desk, not to the page — they sit
 * outside the sheet's border, which is what stops a heading from appearing to
 * collide with the top bar the way it did when both shared one flat plane. The
 * sheet's inner padding is the single content origin every route aligns to.
 */
export function WorkspaceShell({
  project,
  recent = [],
  initials,
  defaultCollapsed = false,
  fill = false,
  actions,
  children,
}: WorkspaceShellProps) {
  const t = useTranslations("workspace");
  const pathname = usePathname();
  const narrow = useSyncExternalStore(
    subscribeToNarrow,
    () => window.matchMedia(RAIL_QUERY).matches,
    () => false
  );
  const [override, setOverride] = useState<boolean | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const collapsed = override ?? defaultCollapsed;

  const globalItems = [
    { href: "/dashboard", label: t("navOverview"), Icon: IconOverview },
    { href: "/projects", label: t("projectsTitle"), Icon: IconProjects },
    { href: "/create", label: t("navNewProject"), Icon: IconPlus },
  ];

  const projectItems = project
    ? [
        { href: `/projects/${project.id}`, label: t("navBuild"), Icon: IconBuild },
        { href: `/projects/${project.id}/analytics`, label: t("navAnalytics"), Icon: IconAnalytics },
        { href: `/projects/${project.id}/versions`, label: t("navVersions"), Icon: IconVersions },
      ]
    : [];

  const navItem = (
    { href, label, Icon }: { href: string; label: string; Icon: (p: { className?: string }) => ReactNode },
    compact: boolean
  ) => {
    const active = pathname === href;
    const link = (
      <Link
        key={href}
        href={href}
        onClick={() => setDrawerOpen(false)}
        aria-current={active ? "page" : undefined}
        className={`ws-nav ${compact ? "w-10 justify-center" : "w-full justify-start px-2.5"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2`}
        style={{ outlineColor: "var(--accent)" }}
      >
        <span className="ws-nav-icon">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        {/* The label is removed rather than faded, so nothing is ever caught
            mid-clip while the rail narrows. */}
        {!compact && <span className="min-w-0 truncate">{label}</span>}
      </Link>
    );
    // Collapsed, the icon is the only thing on screen — the name comes from a
    // portalled tooltip, because the rail clips its own overflow.
    return compact ? (
      <Tooltip key={href} label={label}>
        {link}
      </Tooltip>
    ) : (
      link
    );
  };

  const railBody = (compact: boolean, showToggle: boolean) => {
    const accountLink = (
          <Link
            href="/settings?section=profile"
            onClick={() => setDrawerOpen(false)}
            className={`ws-nav ${compact ? "w-10 justify-center" : "w-full justify-start px-2.5"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2`}
            style={{ outlineColor: "var(--accent)" }}
          >
            <span className="ws-nav-icon">
              <span
                className="grid h-[22px] w-[22px] place-items-center rounded-full text-[11px] font-semibold"
                style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}
              >
                {initials}
              </span>
            </span>
            {!compact && <span className="min-w-0 truncate">{t("navAccount")}</span>}
          </Link>
    );

    return (
    <>
      <div
        className="flex h-[60px] shrink-0 items-center"
        style={{ padding: compact ? "0 14px" : "0 14px", justifyContent: compact ? "center" : "space-between" }}
      >
        <Link
          href="/dashboard"
          aria-label="Ventrio"
          className="group flex cursor-pointer items-center gap-2 rounded-[var(--r-sm)] transition-opacity duration-[var(--t-hover)] ease-[var(--ease)] hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
          style={{ outlineColor: "var(--accent)" }}
        >
          <span className="block transition-transform duration-[var(--t-ctl)] ease-[var(--ease)] group-hover:scale-105">
            <VentrioMark size={26} />
          </span>
          {!compact && (
            <span className="text-[16px] font-bold tracking-[-0.02em]" style={{ color: "var(--ink)" }}>
              Ventrio
            </span>
          )}
        </Link>

        {showToggle && !compact && (
          <Tooltip label={t("railCollapse")} side="left">
            <VentrioButton variant="icon" size="sm" label={t("railCollapse")} onClick={() => setOverride(true)}>
              <IconCollapse className="h-[18px] w-[18px]" />
            </VentrioButton>
          </Tooltip>
        )}
      </div>

      {showToggle && compact && (
        <div className="flex shrink-0 justify-center pb-1">
          <Tooltip label={t("railExpand")}>
            <VentrioButton variant="icon" size="sm" label={t("railExpand")} onClick={() => setOverride(false)}>
              <IconCollapse className="h-[18px] w-[18px]" />
            </VentrioButton>
          </Tooltip>
        </div>
      )}

      <nav
        aria-label={t("navLabel")}
        className="flex flex-1 flex-col gap-5 overflow-y-auto overflow-x-hidden pb-3"
        style={{ padding: compact ? "0 14px 12px" : "0 12px 12px" }}
      >
        <div className={`flex flex-col gap-1 ${compact ? "items-center" : ""}`}>
          {globalItems.map((item) => navItem(item, compact))}
        </div>

        {project && (
          <div className={`flex flex-col gap-1 ${compact ? "items-center" : ""}`}>
            {!compact ? (
              <div className="flex min-w-0 items-center gap-1.5 px-2.5 pb-1">
                <span className="dot" style={{ background: "var(--accent)" }} />
                <span className="ws-nav-label min-w-0 truncate">{project.name || t("untitledProject")}</span>
              </div>
            ) : null}
            {projectItems.map((item) => navItem(item, compact))}
          </div>
        )}

        {!compact && !project && recent.length > 0 && (
          <div className="flex flex-col gap-0.5">
            <p className="ws-nav-label px-2.5 pb-1.5">{t("navRecent")}</p>
            {recent.map((item) => (
              <Link
                key={item.id}
                href={`/projects/${item.id}`}
                onClick={() => setDrawerOpen(false)}
                className="ws-nav px-2.5 text-[13.5px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ height: 36, outlineColor: "var(--accent)" }}
              >
                <span className="ws-nav-icon">
                  <span className="dot" style={{ background: item.accent }} />
                </span>
                <span className="min-w-0 truncate">{item.name || t("untitledProject")}</span>
              </Link>
            ))}
          </div>
        )}
      </nav>

      <div
        className={`flex shrink-0 flex-col gap-1 ${compact ? "items-center" : ""}`}
        style={{ padding: compact ? "10px 14px 14px" : "10px 12px 14px" }}
      >
        {navItem({ href: "/settings", label: t("navSettings"), Icon: IconSettings }, compact)}
        {compact ? (
          <Tooltip label={t("navAccount")}>{accountLink}</Tooltip>
        ) : (
          accountLink
        )}
      </div>
      </>
    );
  };

  return (
    <div className="wsRoot flex h-screen w-full overflow-hidden" style={{ background: "var(--bg)" }}>
      <aside
        className="ws-rail hidden shrink-0 flex-col overflow-hidden transition-[width] duration-[var(--t-ctl)] ease-[var(--ease)] md:flex"
        style={{ width: collapsed ? RAIL_NARROW : RAIL_WIDE }}
      >
        {railBody(collapsed, true)}
      </aside>

      {/* Mobile: the rail becomes a drawer rather than being squeezed in. */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* The scrim is a full-bleed dismiss target, not a control — it stays
              a bare button on purpose so it carries no button styling. */}
          <button
            type="button"
            aria-label={t("navClose")}
            onClick={() => setDrawerOpen(false)}
            className="ws-scrim absolute inset-0 cursor-default"
          />
          <aside
            className="pop absolute inset-y-0 left-0 flex w-[268px] flex-col"
            style={
              {
                background: "var(--canvas)",
                boxShadow: "0 0 0 1px rgb(14 16 22 / 0.05), 24px 0 60px -30px rgb(14 16 22 / 0.35)",
                "--pop-origin": "left center",
              } as React.CSSProperties
            }
          >
            {railBody(false, false)}
          </aside>
        </div>
      )}

      {/* The desk gutter around the sheet. */}
      <div className="flex min-w-0 flex-1 flex-col pb-3 pr-3 md:pb-4 md:pl-1 md:pr-4">
        <header className="flex h-[60px] shrink-0 items-center gap-3 pl-3 pr-1 md:pl-4">
          {/* Rendered rather than hidden with a utility: .vbtn sets display, and
              an unlayered rule would beat md:hidden. */}
          {narrow && (
            <VentrioButton
              variant="icon"
              size="md"
              label={t("navOpen")}
              className="-ml-1"
              onClick={() => setDrawerOpen(true)}
            >
              {drawerOpen ? <IconClose /> : <IconMenu />}
            </VentrioButton>
          )}

          {project ? (
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <Link
                href="/projects"
                className="hidden h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-[var(--r-sm)] px-1.5 text-[14px] font-medium transition-[background,color] duration-[var(--t-hover)] ease-[var(--ease)] hover:bg-[var(--raised)] hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:flex"
                style={{ color: "var(--ink-3)", outlineColor: "var(--accent)" }}
              >
                <IconBack className="h-4 w-4" />
                {t("projectsTitle")}
              </Link>
              <span className="min-w-0 truncate text-[15px] font-bold tracking-[-0.01em]">
                {project.name || t("untitledProject")}
              </span>
              <StatusPill state={project.state} />
            </div>
          ) : (
            <span className="min-w-0 flex-1 truncate text-[15px] font-bold tracking-[-0.01em]">
              {pathname === "/settings"
                ? t("navSettings")
                : pathname === "/projects"
                  ? t("projectsTitle")
                  : pathname === "/create"
                    ? t("navNewProject")
                    : t("navOverview")}
            </span>
          )}

          <div className="flex shrink-0 items-center gap-2 pr-1">{actions}</div>
        </header>

        <main
          className={`sheet relative ml-3 min-h-0 flex-1 md:ml-0 ${fill ? "overflow-hidden" : "overflow-auto"}`}
        >
          {/* Keyed on the route so each page arrives rather than swapping. */}
          <div key={pathname} className="ws-page h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function IconMenu({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      aria-hidden
      className={className ?? "h-[18px] w-[18px]"}
    >
      <path d="M3 5h12M3 9h12M3 13h12" />
    </svg>
  );
}
