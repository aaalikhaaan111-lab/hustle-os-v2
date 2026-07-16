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
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border/60 bg-canvas/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            data-tour-nav={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors duration-150",
              active ? "text-ink" : "text-ink-muted"
            )}
          >
            <item.icon
              className={cn("h-5 w-5 transition-colors duration-150", active && "text-accent")}
            />
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
