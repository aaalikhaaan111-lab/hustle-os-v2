import type { ReactNode } from "react";
import { BackgroundBlobs } from "@/components/layout/BackgroundBlobs";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { GameProgressHUD } from "@/components/layout/GameProgressHUD";
import { PageTransition } from "@/components/layout/PageTransition";
import { Wordmark } from "@/components/layout/Wordmark";
import { DevResetBar } from "@/components/dev/DevResetBar";
import { GameProgressProvider } from "@/lib/game-progress/GameProgressContext";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <GameProgressProvider>
      <div className="relative min-h-screen">
        <BackgroundBlobs />
        <Sidebar />

        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border/60 bg-canvas/80 px-4 backdrop-blur-md md:hidden">
          <Wordmark />
          <GameProgressHUD className="ml-auto" />
        </header>

        <div className="relative z-10 md:pl-64">
          <main className="mx-auto w-full max-w-6xl px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-8 sm:px-6 sm:pt-12 md:pb-16 lg:px-8">
            <PageTransition>{children}</PageTransition>
          </main>
        </div>

        <MobileNav />
        {process.env.NODE_ENV === "development" && <DevResetBar />}
      </div>
    </GameProgressProvider>
  );
}
