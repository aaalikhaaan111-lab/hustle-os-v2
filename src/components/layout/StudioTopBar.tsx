"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { VentrioMark } from "@/components/workspace-ui/parts";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";

/**
 * The bar for everything outside the workspace: pricing, auth, legal, contact.
 *
 * These pages used to be the other half of the "two different products"
 * problem. They ran under a right-hand slide-out drawer opened from a floating
 * circular button, over a light canvas with drifting background blobs, while
 * the workspace ran a left rail over a grey desk. Same product, two navigation
 * models, two grounds, two type scales.
 *
 * This is the same room as the workspace — same ground, same hairline, same
 * type — with the horizontal equivalent of the rail. The destinations are shown
 * rather than hidden behind a button, because there are five of them.
 */
export function StudioTopBar({ isAuthenticated }: { isAuthenticated: boolean }) {
  const t = useTranslations("landing");
  const tNav = useTranslations("nav");
  const tAuth = useTranslations("auth");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/pricing", label: tNav("pricing") },
    { href: "/about", label: t("navAbout") },
    { href: "/who-its-for", label: t("navWho") },
    { href: "/faq", label: t("navFaq") },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header
      className="sticky top-0 z-40 border-b"
      style={{ borderColor: "var(--color-border)", background: "rgb(251 250 248 / 0.88)", backdropFilter: "blur(12px)" }}
    >
      <div className="mx-auto flex h-14 w-full max-w-[1080px] items-center gap-3 px-5 sm:px-8">
        <Link href={isAuthenticated ? "/dashboard" : "/"} className="flex shrink-0 items-center gap-2">
          <VentrioMark size={24} />
          <span className="text-[15px] font-semibold tracking-[-0.02em]">Ventrio</span>
        </Link>

        <nav aria-label={t("menuLabel")} className="ml-4 hidden items-center gap-1 md:flex">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className="s-nav-item h-9 rounded-[var(--r-sm)] px-3 text-[13.5px] font-medium"
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* On a phone this row is the mark plus ONE action plus the menu.
            It used to carry the language switcher, Log in and Sign up as well:
            329px of controls on a 390px screen, which pushed the bar past the
            viewport and gave the whole page a horizontal scroll. Everything
            secondary moved into the disclosure below. */}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <span className="hidden md:flex">
            <LanguageSwitcher />
          </span>
          {isAuthenticated ? (
            <Link href="/dashboard" className="s-btn s-btn--secondary">
              {t("openProjects")}
            </Link>
          ) : (
            <>
              <Link href="/login" className="s-btn s-btn--ghost hidden md:inline-flex">
                {t("login")}
              </Link>
              <Link href="/signup" className="s-btn s-btn--primary">
                {tAuth("signUp")}
              </Link>
            </>
          )}

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? t("menuClose") : t("menuOpen")}
            className="s-btn s-btn--ghost s-btn--icon md:hidden"
          >
            <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden className="h-[18px] w-[18px]">
              {open ? <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" /> : <path d="M3 5h12M3 9h12M3 13h12" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile: the same links, listed under the bar rather than in a sheet
          over the page. Nothing is covered, so nothing has to be dismissed. */}
      {open && (
        <nav
          aria-label={t("menuLabel")}
          className="s-fade border-t px-5 py-2 md:hidden"
          style={{ borderColor: "var(--color-border)" }}
        >
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              aria-current={isActive(href) ? "page" : undefined}
              className="s-nav-item min-h-[44px] rounded-[var(--r-sm)] px-2 text-[15px] font-medium"
            >
              {label}
            </Link>
          ))}

          {/* The controls the bar cannot fit on a phone. */}
          {!isAuthenticated && (
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="s-nav-item min-h-[44px] rounded-[var(--r-sm)] px-2 text-[15px] font-medium"
            >
              {t("login")}
            </Link>
          )}
          <div className="border-t pt-2 mt-2" style={{ borderColor: "var(--color-border)" }}>
            <LanguageSwitcher />
          </div>
        </nav>
      )}
    </header>
  );
}
