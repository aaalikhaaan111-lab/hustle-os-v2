"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { useAppViewport } from "@/lib/workspace/useAppViewport";
import {
  IconAnalytics,
  IconBack,
  IconBuild,
  IconGlobe,
  IconOverview,
  IconPlus,
  IconProjects,
  IconSearch,
  IconSettings,
  IconShield,
  IconUser,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/shadcn/dropdown-menu";
import { ProjectSearch, SearchShortcut } from "./ProjectSearch";
import { signOutAction } from "@/lib/actions/auth";
import { ChevronsUpDown, PanelLeft } from "lucide-react";

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
  /**
   * Every project, newest first. The sidebar shows the first few and search
   * covers all of them — one list, so the two can never disagree.
   */
  recent?: ShellRecent[];
  initials: string;
  /** Shown in the account menu so it identifies who is signed in. */
  email?: string;
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
      /* 3rem, not 3.25rem: the rail's own `p-2` plus a `size-8` button is
         exactly 48px, so any other width leaves the icons sitting off-centre
         against one edge. */
      style={{ "--sidebar-width": "15.5rem", "--sidebar-width-icon": "3rem" } as React.CSSProperties}
    >
      <ShellBody {...props} />
    </SidebarProvider>
  );
}

function ShellBody({ project, recent = [], initials, email, fill = false, actions, children }: WorkspaceShellProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  // Tracks the visual viewport so the keyboard cannot push the conversation off
  // the top. See the hook — svh alone does not react to a keyboard.
  useAppViewport();

  const t = useTranslations("workspace");
  const tProfile = useTranslations("profile");
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
      <ProjectSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        projects={recent}
        projectId={project?.id}
      />

      <Sidebar collapsible="icon">
        <SidebarHeader>
          {/* THE LOGO IS THE TOGGLE, on desktop. On a phone the drawer is
              already open when you can see this, so tapping the mark should
              take you home instead of closing the thing you just opened.

              COLLAPSED, the wordmark is hidden outright rather than left to be
              clipped. `size="lg"` sets `p-0!` in icon mode while the base rule
              still forces `size-8`, so the text began at 24px inside a 32px box
              and eight pixels of a "V" survived the overflow — a sliver of a
              letter that read as a rendering fault. The mark centres in the
              rail instead, which is what the collapsed state should look like:
              deliberate, not truncated. */}
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
                  className="group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0"
                >
                  <VentrioMark size={22} />
                  <span className="text-[15px] font-semibold group-data-[collapsible=icon]:hidden">
                    Ventrio
                  </span>
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
                {/* Search sits with the destinations because that is what it
                    is — a way to reach one. It is a dialog rather than a field
                    in the rail: the rail collapses, and a text input that
                    disappears is not somewhere people will look. */}
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => setSearchOpen(true)} tooltip={t("searchTitle")}>
                    <IconSearch className="h-[17px] w-[17px] shrink-0" />
                    <span>{t("searchTitle")}</span>
                    <SearchShortcut />
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

          {/* Everything you have made.

              It used to disappear the moment a project was open, which is
              exactly when moving to another one is most useful, and left the
              rail with three rows in it. Hidden only when collapsed to icons:
              a column of identical dots is not a list of projects. */}
          {recent.length > 0 && (
            <SidebarGroup className="group-data-[collapsible=icon]:hidden">
              <SidebarGroupLabel>{t("navRecent")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {recent.slice(0, 7).map((item) => (
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

        {/* THE FOOTER IS ONE OBJECT, not two loose links.
            It was a "Settings" row and an "Account" row sitting under the
            navigation looking like two more destinations. It is the signed-in
            person now — avatar, name, address — and it opens the account menu,
            which is where every settings section and signing out actually live.
            That is the shape people already know from every product with an
            account, and it is the only row in the rail that is about you rather
            than about the work. */}
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    tooltip={t("navAccount")}
                    className="group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 data-[state=open]:bg-sidebar-accent"
                  >
                    <span
                      className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-[11px] font-semibold text-secondary-foreground"
                      aria-hidden
                    >
                      {initials}
                    </span>
                    <span className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                      <span className="truncate text-[13px] font-medium">{t("navAccount")}</span>
                      {email && (
                        <span className="truncate text-[12px] text-muted-foreground">{email}</span>
                      )}
                    </span>
                    <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  side={isMobile ? "top" : "right"}
                  align="end"
                  sideOffset={8}
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
                >
                  {email && (
                    <>
                      <DropdownMenuLabel className="font-normal">
                        <span className="block text-[12px] text-muted-foreground">
                          {t("accountSignedInAs")}
                        </span>
                        <span className="block truncate text-[13px] font-medium">{email}</span>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                    </>
                  )}

                  {/* Every item is an existing settings section. Nothing here
                      opens a screen that has to be built. */}
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                      <Link href="/settings?section=profile" onClick={() => setOpenMobile(false)}>
                        <IconUser className="h-4 w-4" />
                        {t("settingsProfile")}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/settings?section=usage" onClick={() => setOpenMobile(false)}>
                        <IconAnalytics className="h-4 w-4" />
                        {t("usage")}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/settings?section=language" onClick={() => setOpenMobile(false)}>
                        <IconGlobe className="h-4 w-4" />
                        {t("settingsLanguage")}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/settings?section=privacy" onClick={() => setOpenMobile(false)}>
                        <IconShield className="h-4 w-4" />
                        {t("settingsPrivacy")}
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>

                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/settings" onClick={() => setOpenMobile(false)}>
                      <IconSettings className="h-4 w-4" />
                      {t("navSettings")}
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />
                  {/* Signing out is a server action, so it is a form rather
                      than a link — the item submits it. */}
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => {
                      setOpenMobile(false);
                      void signOutAction();
                    }}
                  >
                    {tProfile("logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
