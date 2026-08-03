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
    const next = stored !== null ? stored === "1" : desktop;
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
