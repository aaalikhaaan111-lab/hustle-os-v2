"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
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
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/shadcn/sidebar";
import { Button } from "@/components/ui/shadcn/button";
import { PanelLeft } from "lucide-react";

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
  /** Accepted and ignored — the sidebar owns its own collapsed state now. */
  defaultCollapsed?: boolean;
  /** Build fills the frame exactly and scrolls internally. */
  fill?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}

type NavEntry = { href: string; label: string; Icon: (p: { className?: string }) => ReactNode };

/**
 * The application shell.
 *
 * WHAT THIS REPLACES. A hand-written `<aside>` with a bespoke collapse store, a
 * hand-rolled tooltip on every collapsed row, a `data-collapsed` CSS contract
 * for hiding labels, and — on phones — a bottom tab bar that could not be shown
 * on the one route where the composer owns the bottom edge, so the build screen
 * had no navigation at all.
 *
 * It is shadcn's Sidebar now, which supplies all of that as one primitive:
 * `collapsible="icon"` for the desktop rail, per-item `tooltip` when collapsed,
 * and — the reason the bottom bar could go — a real Sheet drawer on mobile, so
 * every route has the same navigation reachable from one trigger.
 */
export function WorkspaceShell(props: WorkspaceShellProps) {
  return (
    <SidebarProvider
      /* The shell is a fixed, non-scrolling frame; the provider's own wrapper
         must not add a second full-height box inside it. */
      className="studio studio-room studio-frame min-h-0"
      style={{ "--sidebar-width": "15.5rem", "--sidebar-width-icon": "3.25rem" } as React.CSSProperties}
    >
      <ShellBody {...props} />
    </SidebarProvider>
  );
}

function ShellBody({ project, recent = [], initials, fill = false, actions, children }: WorkspaceShellProps) {
  // Tracks the visual viewport so the keyboard cannot push the conversation off
  // the top. See the hook — svh alone does not react to a keyboard.
  useAppViewport();

  const t = useTranslations("workspace");
  const pathname = usePathname();
  const { isMobile, toggleSidebar, setOpenMobile } = useSidebar();

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

  const navButton = ({ href, label, Icon }: NavEntry) => (
    <SidebarMenuItem key={href}>
      <SidebarMenuButton asChild isActive={isActive(href)} tooltip={label}>
        <Link href={href} onClick={() => setOpenMobile(false)}>
          <Icon className="h-[17px] w-[17px] shrink-0" />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          {/* THE LOGO IS THE TOGGLE, on desktop. On a phone the drawer is
              already open when you can see this, so tapping the mark should
              take you home instead of closing the thing you just opened. */}
          <SidebarMenu>
            <SidebarMenuItem>
              {isMobile ? (
                <SidebarMenuButton asChild size="lg">
                  <Link href="/dashboard" onClick={() => setOpenMobile(false)}>
                    <VentrioMark size={22} />
                    <span className="text-[15px] font-semibold">Ventrio</span>
                  </Link>
                </SidebarMenuButton>
              ) : (
                <SidebarMenuButton
                  size="lg"
                  onClick={toggleSidebar}
                  tooltip={t("sidebarExpand")}
                  aria-label={t("sidebarCollapse")}
                >
                  <VentrioMark size={22} />
                  <span className="text-[15px] font-semibold">Ventrio</span>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup className="pt-0">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip={t("navNewProject")}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary active:text-primary-foreground"
                  >
                    <Link href="/create" onClick={() => setOpenMobile(false)}>
                      <IconPlus className="h-4 w-4 shrink-0" />
                      <span>{t("navNewProject")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {primary.map(navButton)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {projectItems.length > 0 && (
            <SidebarGroup>
              <SidebarGroupLabel>{t("navThisProject")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>{projectItems.map(navButton)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {/* Everything you have made. Hidden when the rail is collapsed to
              icons: a column of identical dots is not a list of projects. */}
          {!project && recent.length > 0 && (
            <SidebarGroup className="group-data-[collapsible=icon]:hidden">
              <SidebarGroupLabel>{t("navRecent")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {recent.slice(0, 8).map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton asChild size="sm">
                        <Link href={`/projects/${item.id}`} onClick={() => setOpenMobile(false)}>
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: item.accent }}
                            aria-hidden
                          />
                          <span className="truncate">{item.name || t("untitledProject")}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            {navButton({ href: "/settings", label: t("navSettings"), Icon: IconSettings })}
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip={t("navAccount")}>
                <Link href="/settings?section=profile" onClick={() => setOpenMobile(false)}>
                  <span
                    className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-secondary text-[10px] font-semibold text-secondary-foreground"
                    aria-hidden
                  >
                    {initials}
                  </span>
                  <span>{t("navAccount")}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-h-0 overflow-hidden bg-background">
        {/* THE MOBILE BAR. One trigger, top left, opening the same navigation
            as the desktop rail — which is what let the bottom tab bar go. That
            bar could not render on the build route (the composer owns the
            bottom edge), so the one screen people spend the most time on had
            no navigation at all. */}
        {isMobile && (
          <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-sidebar px-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              aria-label={t("navOpen")}
              className="shrink-0"
            >
              <PanelLeft className="h-[18px] w-[18px]" />
            </Button>

            {project && (
              <Link
                href="/projects"
                aria-label={t("projectsTitle")}
                className="s-nav-item h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-sm)]"
              >
                <IconBack className="h-[18px] w-[18px]" />
              </Link>
            )}

            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
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
        )}

        <main className={`relative min-h-0 flex-1 ${fill ? "overflow-hidden" : "overflow-auto"}`}>
          {/* Keyed on the route so each page arrives rather than swapping. */}
          <div key={pathname} className="s-enter h-full">
            {children}
          </div>
        </main>
      </SidebarInset>
    </>
  );
}
