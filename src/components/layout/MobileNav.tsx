"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <nav className="fixed inset-x-3 bottom-[max(0.55rem,env(safe-area-inset-bottom))] z-30 flex rounded-[1.4rem] bg-[#11131c]/88 p-1.5 shadow-[0_18px_55px_rgba(0,0,0,0.38)] ring-1 ring-inset ring-white/[0.08] backdrop-blur-xl md:hidden">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            data-tour-nav={item.href}
            className={cn(
              "relative flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-[1rem] py-1.5 text-[10px] font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-accent",
              active ? "text-ink" : "text-ink-muted"
            )}
          >
            <span className={cn("absolute inset-0 rounded-[1rem] bg-white/[0.055] transition-all duration-300", active ? "scale-100 opacity-100" : "scale-90 opacity-0")} aria-hidden />
            <item.icon
              className={cn("relative h-[18px] w-[18px] transition-all duration-200", active && "-translate-y-px text-accent")}
            />
            <span className="relative">{t(item.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
