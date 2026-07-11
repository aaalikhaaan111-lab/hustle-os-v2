"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";
import { Wordmark } from "@/components/layout/Wordmark";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-base md:flex">
      <div className="flex h-16 items-center px-6">
        <Wordmark className="text-base" />
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
                active
                  ? "bg-surface text-ink"
                  : "text-ink-secondary hover:bg-surface hover:text-ink"
              )}
            >
              <item.icon
                className={cn(
                  "h-[18px] w-[18px] transition-colors duration-150",
                  active && "text-accent"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border px-6 py-4 text-xs text-ink-muted">
        v2 foundation
      </div>
    </aside>
  );
}
