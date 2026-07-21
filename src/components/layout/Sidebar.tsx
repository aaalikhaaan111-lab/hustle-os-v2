"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("nav");

  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-white/[0.06] bg-surface/50 backdrop-blur-2xl md:flex">
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
              data-tour-nav={item.href}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-4 py-2.5 text-[15px] font-semibold tracking-tight transition-all duration-200 ease-out active:scale-[0.98]",
                active
                  ? "bg-accent-soft text-accent shadow-[inset_0_0_0_1px_rgba(93,107,255,0.22)]"
                  : "text-ink-secondary hover:bg-surface-hover hover:text-ink"
              )}
            >
              <item.icon
                className={cn(
                  "h-5 w-5 transition-colors duration-150",
                  active ? "text-accent" : "text-ink-muted"
                )}
              />
              {t(item.labelKey)}
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
