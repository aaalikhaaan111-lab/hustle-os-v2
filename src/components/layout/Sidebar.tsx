"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";
import { Wordmark } from "@/components/layout/Wordmark";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-52 flex-col border-r border-white/[0.045] bg-[#090a10]/55 backdrop-blur-2xl md:flex">
      <div className="flex h-20 items-center px-7">
        <Wordmark className="text-[15px] tracking-[-0.03em]" />
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-4 py-6">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tour-nav={item.href}
              className={cn(
                "group relative flex items-center gap-3 px-3 py-3 text-[13px] font-medium tracking-tight transition-all duration-200 ease-out active:scale-[0.985] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                active
                  ? "text-ink"
                  : "text-ink-muted hover:text-ink"
              )}
            >
              <span className={cn("absolute -left-4 h-5 w-px bg-accent transition-all duration-300", active ? "opacity-100" : "scale-y-0 opacity-0")} aria-hidden />
              <item.icon
                className={cn(
                  "h-[18px] w-[18px] transition-all duration-200",
                  active ? "text-accent" : "text-ink-muted group-hover:text-ink-secondary"
                )}
              />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>
      <div className="mx-7 mb-7 h-px bg-gradient-to-r from-white/[0.07] to-transparent" aria-hidden />
    </aside>
  );
}
