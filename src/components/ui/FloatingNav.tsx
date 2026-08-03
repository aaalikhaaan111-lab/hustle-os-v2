"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Wordmark } from "@/components/layout/Wordmark";
import { cn } from "@/lib/utils";

export interface FloatingNavProps {
  isAuthenticated: boolean;
}

// The landing's only navigation. A floating glass dock, centred and fixed
// over the page: the dark, semi-opaque + blurred fill stays legible over the
// WebGL hero and over every section below it, so no scroll-based recolouring
// is needed. On small screens the same dock expands in place — there is no
// second, detached menu button anywhere on the page.
export function FloatingNav({ isAuthenticated }: FloatingNavProps) {
  const t = useTranslations("landing");
  const [isOpen, setIsOpen] = useState(false);
  const shape = isOpen ? "rounded-2xl" : "rounded-full";

  // One in-page anchor and one real page. The landing section carries a
  // scroll-margin so the dock never lands on top of the heading it jumps to.
  // "Examples" is gone with the showcase it was the only route to.
  const links = [
    { href: "#how-it-works", label: t("navHow") },
    { href: "/faq", label: t("navFaq") },
  ];

  return (
    <header
      className={cn(
        "fixed left-1/2 top-5 z-50 flex w-[calc(100%-2rem)] -translate-x-1/2 flex-col border border-white/10 bg-[#101018]/70 px-5 py-2.5 backdrop-blur-md transition-[border-radius] sm:w-auto",
        shape
      )}
    >
      <div className="flex w-full items-center justify-between gap-6 sm:gap-10">
        <Link href="/" aria-label="Ventrio" className="flex items-center gap-2">
          <Wordmark className="h-5 w-5" />
        </Link>

        <nav className="hidden shrink-0 items-center gap-6 whitespace-nowrap text-[13px] font-medium text-white/60 sm:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="whitespace-nowrap transition-colors hover:text-white">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-2.5 whitespace-nowrap sm:flex">
          {isAuthenticated ? (
            <Link
              href="/projects"
              className="whitespace-nowrap rounded-full bg-white px-4 py-1.5 text-[13px] font-semibold text-[#0d0a1f] transition-colors hover:bg-white/90"
            >
              {t("openProjects")}
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="whitespace-nowrap rounded-full border border-white/15 px-4 py-1.5 text-[13px] font-medium text-white/70 transition-colors hover:border-white/30 hover:text-white"
              >
                {t("login")}
              </Link>
              <Link
                href="/signup"
                className="whitespace-nowrap rounded-full bg-white px-4 py-1.5 text-[13px] font-semibold text-[#0d0a1f] transition-colors hover:bg-white/90"
              >
                {t("ctaShort")}
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          aria-label={isOpen ? t("menuClose") : t("menuOpen")}
          className="flex h-8 w-8 items-center justify-center text-white/70 sm:hidden"
        >
          {isOpen ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      <div
        className={cn(
          "flex w-full flex-col items-stretch overflow-hidden transition-all duration-300 ease-in-out sm:hidden",
          isOpen ? "max-h-96 pt-4 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <nav className="flex flex-col gap-3 text-sm text-white/70">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="py-1">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-3 flex flex-col gap-2">
          {isAuthenticated ? (
            <Link href="/projects" className="rounded-full bg-white py-2 text-center text-[13px] font-semibold text-[#0d0a1f]">
              {t("openProjects")}
            </Link>
          ) : (
            <>
              <Link href="/login" className="rounded-full border border-white/15 py-2 text-center text-[13px] font-medium text-white/80">
                {t("login")}
              </Link>
              <Link href="/signup" className="rounded-full bg-white py-2 text-center text-[13px] font-semibold text-[#0d0a1f]">
                {t("ctaShort")}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
