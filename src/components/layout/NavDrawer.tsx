"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { usePrefersReducedMotion } from "@/components/landing/hooks";
import { Wordmark } from "@/components/layout/Wordmark";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { signOutAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

interface NavDrawerProps {
  isAuthenticated: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Single right-side navigation drawer for the whole live product. Desktop:
// open by default, collapsible, reopened from the fixed trigger. Mobile: a
// sheet that opens over the content. Real destinations only.
export function NavDrawer({ isAuthenticated, open, onOpenChange }: NavDrawerProps) {
  const t = useTranslations("landing");
  const tNav = useTranslations("nav");
  const pathname = usePathname();
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const primary = [
    { href: "/create", label: tNav("create") },
    { href: "/projects", label: tNav("projects") },
    { href: "/profile", label: tNav("profile") },
  ];
  const ventrio = [
    { href: "/about", label: t("navAbout") },
    { href: "/who-its-for", label: t("navWho") },
    { href: "/faq", label: t("navFaq") },
  ];

  return (
    <>
      {/* Fixed trigger — always reachable, top-right. */}
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-label={open ? t("menuClose") : t("menuOpen")}
        aria-expanded={open}
        aria-controls="ventrio-nav-drawer"
        className={cn(
          "fixed right-[max(0.9rem,env(safe-area-inset-right))] top-[max(0.9rem,env(safe-area-inset-top))] z-50 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-ink-secondary shadow-sm transition-all hover:text-ink hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          open && "md:opacity-0 md:pointer-events-none"
        )}
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px]" aria-hidden>
          <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {/* Mobile backdrop */}
      <button
        type="button"
        aria-hidden={!open}
        tabIndex={-1}
        onClick={() => onOpenChange(false)}
        className={cn(
          "fixed inset-0 z-40 bg-ink/20 backdrop-blur-[2px] transition-opacity md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      <nav
        id="ventrio-nav-drawer"
        aria-label={t("menuLabel")}
        className={cn(
          "fixed inset-y-0 right-0 z-40 flex w-[min(19rem,86vw)] flex-col border-l border-border bg-surface transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-5 pt-[max(1.1rem,env(safe-area-inset-top))] pb-4">
          <Link
            href="/"
            // On a genuine internal-page -> "/" navigation, keep Next's default
            // (scroll to top of the new page). On "/" itself, this is a same-URL
            // click Next won't act on at all, so disable it here and scroll
            // ourselves — otherwise Link's scroll-position-restoring behavior
            // fights and undoes the manual scrollTo below.
            scroll={pathname !== "/"}
            onClick={() => {
              onOpenChange(false);
              if (pathname === "/") {
                window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
              }
            }}
            aria-label="Ventrio"
            className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Wordmark className="text-[15px] tracking-[-0.03em]" />
          </Link>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={t("menuClose")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-3 pb-6">
          <Section>
            {primary.map((item) => (
              <DrawerLink key={item.href} href={item.href} active={isActive(pathname, item.href)} onNavigate={() => onOpenChange(false)}>
                {item.label}
              </DrawerLink>
            ))}
          </Section>

          <Section label={t("sectionVentrio")}>
            {ventrio.map((item) => (
              <DrawerLink key={item.href} href={item.href} active={isActive(pathname, item.href)} onNavigate={() => onOpenChange(false)}>
                {item.label}
              </DrawerLink>
            ))}
          </Section>

          <div className="mt-auto flex flex-col gap-1 border-t border-border pt-4">
            {isAuthenticated ? (
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="w-full rounded-xl px-3 py-2.5 text-left text-[14px] font-medium text-ink-secondary transition-colors hover:bg-surface-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {t("signOut")}
                </button>
              </form>
            ) : (
              <>
                <DrawerLink href="/login" onNavigate={() => onOpenChange(false)}>{t("login")}</DrawerLink>
                <DrawerLink href="/signup" onNavigate={() => onOpenChange(false)} emphasis>{t("ctaShort")}</DrawerLink>
              </>
            )}
            <div className="px-3 pt-2">
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}

function Section({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">{label}</p>}
      {children}
    </div>
  );
}

function DrawerLink({
  href,
  active,
  emphasis,
  onNavigate,
  children,
}: {
  href: string;
  active?: boolean;
  emphasis?: boolean;
  onNavigate: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        emphasis
          ? "bg-accent text-white hover:bg-accent-hover"
          : active
            ? "bg-accent-soft text-accent"
            : "text-ink-secondary hover:bg-surface-hover hover:text-ink"
      )}
    >
      {children}
    </Link>
  );
}
