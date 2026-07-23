"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BackgroundBlobs } from "@/components/layout/BackgroundBlobs";
import { NavDrawer } from "@/components/layout/NavDrawer";
import { DevResetBar } from "@/components/dev/DevResetBar";
import { RoutePrefetcher } from "@/components/layout/RoutePrefetcher";
import { GameProgressProvider } from "@/lib/game-progress/GameProgressContext";
import { cn } from "@/lib/utils";

const NAV_OPEN_KEY = "ventrio:nav-open";

// One light shell for every live surface: a calm background, the right-side
// NavDrawer (open by default on desktop, a sheet on mobile), and the page.
// The old left sidebar + bottom mobile bar + landing hamburger are all folded
// into the single drawer.
export function AppShell({ children, isAuthenticated }: { children: ReactNode; isAuthenticated: boolean }) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

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

  return (
    <GameProgressProvider>
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
        <RoutePrefetcher />
        {process.env.NODE_ENV === "development" && <DevResetBar />}
      </div>
    </GameProgressProvider>
  );
}
