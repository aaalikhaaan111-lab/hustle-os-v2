"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { BackgroundBlobs } from "@/components/layout/BackgroundBlobs";
import { NavDrawer } from "@/components/layout/NavDrawer";
import { RoutePrefetcher } from "@/components/layout/RoutePrefetcher";
import { cn } from "@/lib/utils";

const NAV_OPEN_KEY = "ventrio:nav-open";

// One light shell for every live surface: a calm background, the right-side
// NavDrawer (open by default on desktop, a sheet on mobile), and the page.
//
// The public landing is the exception. It carries its own floating dock, and
// that dock is the only navigation it should have — mounting the drawer here
// too would put a second, detached nav button on top of it (and shift the
// page with the drawer's padding).
export function AppShell({ children, isAuthenticated }: { children: ReactNode; isAuthenticated: boolean }) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const pathname = usePathname();
  const isLanding = pathname === "/";
  // The project workspace carries its own rail and top bar. Mounting the drawer
  // over it would put a second, unrelated navigation on the same screen.
  const isWorkspace =
    pathname === "/dashboard" ||
    pathname === "/projects" ||
    pathname.startsWith("/projects/") ||
    pathname === "/create" ||
    pathname === "/settings" ||
    // The design lab renders its own complete application frame; the drawer
    // would sit on top of the prototype being reviewed.
    pathname === "/workspace-lab";

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(NAV_OPEN_KEY);
    } catch {
      // ignore
    }
    const desktop = window.matchMedia("(min-width: 768px)").matches;
    /**
     * The stored preference is a DESKTOP preference, and only desktop reads it.
     *
     * The drawer is a side panel beside the page on a wide screen and a sheet
     * over the whole page on a phone — so "open" does not mean the same thing
     * in both places, and one stored flag cannot answer for both. It used to:
     * opening the drawer once on a desktop wrote "1", and the next visit from a
     * phone read that "1" and covered the page with a nav sheet before the
     * visitor had touched anything.
     *
     * Mobile therefore always starts closed, which is the only sensible state
     * for a sheet nobody has opened yet. Desktop keeps the preference, and
     * still defaults to open when there is none.
     */
    const next = desktop ? (stored !== null ? stored === "1" : true) : false;
    // Deferred so the state updates happen outside the effect body.
    queueMicrotask(() => {
      setOpen(next);
      setReady(true);
    });
  }, []);

  const changeOpen = (next: boolean) => {
    setOpen(next);
    try {
      window.localStorage.setItem(NAV_OPEN_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
  };

  const drawerOpen = ready && open;

  if (isLanding || isWorkspace) {
    return (
      <div className="relative min-h-screen">
        {children}
        <RoutePrefetcher isAuthenticated={isAuthenticated} />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <BackgroundBlobs />
      <NavDrawer isAuthenticated={isAuthenticated} open={drawerOpen} onOpenChange={changeOpen} />
      <main
        className={cn(
          "relative z-10 min-h-screen transition-[padding] duration-300 ease-out",
          drawerOpen && "md:pr-[19rem]"
        )}
      >
        {children}
      </main>
      <RoutePrefetcher isAuthenticated={isAuthenticated} />
    </div>
  );
}
