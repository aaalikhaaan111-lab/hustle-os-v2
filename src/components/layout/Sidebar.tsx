"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";
import { Wordmark } from "@/components/layout/Wordmark";
import { GameProgressHUD } from "@/components/layout/GameProgressHUD";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-t-white/60 border-zinc-200/30 bg-white/65 backdrop-blur-2xl md:flex">
      <div className="flex h-16 items-center px-6">
        <Wordmark className="text-base" />
      </div>
      <div className="px-6 pb-2">
        <GameProgressHUD />
      </div>
      <nav className="flex flex-1 flex-col gap-2 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-full px-4 py-3 text-[15px] font-bold tracking-tight transition-all duration-200 ease-out active:scale-[0.97]",
                active
                  ? "bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.4),0_8px_24px_rgba(99,102,241,0.35)]"
                  : "text-ink-secondary hover:bg-white/60 hover:text-ink"
              )}
            >
              <item.icon
                className={cn(
                  "h-5 w-5 transition-colors duration-150",
                  active ? "text-white" : "text-ink-muted"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border/60 px-6 py-4 text-xs tracking-wide text-ink-muted">
        v2 foundation
      </div>
    </aside>
  );
}
