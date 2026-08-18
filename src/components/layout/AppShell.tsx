"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { StudioTopBar } from "@/components/layout/StudioTopBar";
import { RoutePrefetcher } from "@/components/layout/RoutePrefetcher";
import { carriesPublicShell } from "@/components/public/routes";

/**
 * One shell for every live surface outside the workspace.
 *
 * The drawer is gone, and with it the stored open/closed preference, the
 * desktop-vs-phone reconciliation that preference needed, and the floating
 * circular trigger. Navigation is a top bar that shows its destinations —
 * see `StudioTopBar`.
 *
 * Two kinds of route opt out. Every PUBLIC page now carries the shared
 * `PublicHeader` through `PublicShell` — the landing did already, and the rest
 * joined it — so mounting `StudioTopBar` there stacks two headers on one page.
 * The workspace carries its own rail and header, for the same reason.
 */
export function AppShell({ children, isAuthenticated }: { children: ReactNode; isAuthenticated: boolean }) {
  const pathname = usePathname();
  const isPublic = carriesPublicShell(pathname);
  const isWorkspace =
    pathname === "/dashboard" ||
    pathname === "/projects" ||
    pathname.startsWith("/projects/") ||
    pathname === "/create" ||
    pathname === "/settings" ||
    // The design lab renders its own complete application frame.
    pathname === "/workspace-lab";

  if (isPublic || isWorkspace) {
    return (
      <div className="relative min-h-screen">
        {children}
        <RoutePrefetcher isAuthenticated={isAuthenticated} />
      </div>
    );
  }

  return (
    <div className="studio studio-room relative flex min-h-screen flex-col">
      <StudioTopBar isAuthenticated={isAuthenticated} />
      <main className="relative flex-1">{children}</main>
      <RoutePrefetcher isAuthenticated={isAuthenticated} />
    </div>
  );
}
