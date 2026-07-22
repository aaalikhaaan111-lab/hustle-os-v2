"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PageTransition } from "@/components/layout/PageTransition";
import { Wordmark } from "@/components/layout/Wordmark";

// Routes that opt into the immersive, full-height canvas: no page padding, no
// max-width, no generic mobile top bar (they render their own header), and the
// page owns its internal scroll instead of the document scrolling. This covers
// the AI creation experience, the legacy single-project workspace, and every
// id-scoped project workspace (/projects/<id>) — but NOT the /projects list,
// which uses the normal shell.
const IMMERSIVE_EXACT = new Set(["/create", "/build/workspace"]);

function isImmersive(pathname: string): boolean {
  if (IMMERSIVE_EXACT.has(pathname)) return true;
  return /^\/projects\/[^/]+$/.test(pathname);
}

export function AppMain({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const immersive = isImmersive(pathname);

  if (immersive) {
    return (
      <div className="relative z-10 md:pl-64">
        <main className="h-[100dvh] w-full overflow-hidden">{children}</main>
      </div>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-40 flex min-h-14 items-center gap-3 border-b border-border/60 bg-canvas/80 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md md:hidden">
        <Wordmark />
      </header>

      <div className="relative z-10 md:pl-64">
        <main className="mx-auto w-full max-w-6xl px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-8 sm:px-6 sm:pt-12 md:pb-16 lg:px-8">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </>
  );
}
