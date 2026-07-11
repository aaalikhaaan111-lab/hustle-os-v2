import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { PageTransition } from "@/components/layout/PageTransition";
import { Wordmark } from "@/components/layout/Wordmark";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-base">
      <Sidebar />

      <header className="sticky top-0 z-40 flex h-14 items-center border-b border-border bg-base/95 px-4 backdrop-blur md:hidden">
        <Wordmark />
      </header>

      <div className="md:pl-64">
        <main className="mx-auto w-full max-w-6xl px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-7 sm:px-6 sm:pt-9 md:pb-16 lg:px-8">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
