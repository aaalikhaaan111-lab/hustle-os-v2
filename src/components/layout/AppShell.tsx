import type { ReactNode } from "react";
import { BackgroundBlobs } from "@/components/layout/BackgroundBlobs";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { AppMain } from "@/components/layout/AppMain";
import { DevResetBar } from "@/components/dev/DevResetBar";
import { ProductTour } from "@/components/tour/ProductTour";
import { RoutePrefetcher } from "@/components/layout/RoutePrefetcher";
import { GameProgressProvider } from "@/lib/game-progress/GameProgressContext";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <GameProgressProvider>
      <div className="relative min-h-screen">
        <BackgroundBlobs />
        <Sidebar />

        <AppMain>{children}</AppMain>

        <MobileNav />
        <ProductTour />
        <RoutePrefetcher />
        {process.env.NODE_ENV === "development" && <DevResetBar />}
      </div>
    </GameProgressProvider>
  );
}
