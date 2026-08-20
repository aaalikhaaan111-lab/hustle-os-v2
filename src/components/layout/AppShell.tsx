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
    /**
     * NO ENTRY ANIMATION HERE, DELIBERATELY.
     *
     * `animate-page-in` translates on the Y axis, and a transformed ancestor
     * becomes the containing block for every `position: fixed` descendant. The
     * workspace holds its mobile keyboard layout together with exactly that —
     * `body:has(.studio-frame)` is fixed and `.studio-frame` is absolute inside
     * it — so animating this wrapper would reparent the whole frame for the
     * duration and snap it back at the end. On a phone that is a visible jump
     * on every navigation.
     *
     * These routes get their perceived speed from `loading.tsx` instead, which
     * is the better tool anyway: a skeleton in the shape of the real layout
     * appears immediately, rather than delaying content by the length of a
     * fade.
     */
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
      {/* `key` is what makes this a transition rather than a one-off: without
          it the element survives navigation, and a CSS animation only replays
          when the node is new. These routes — auth, profile, the previews —
          have no fixed descendants, so the transform is safe here. */}
      <main key={pathname} className="animate-page-in relative flex-1">
        {children}
      </main>
      <RoutePrefetcher isAuthenticated={isAuthenticated} />
    </div>
  );
}
