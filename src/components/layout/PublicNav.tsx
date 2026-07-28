"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { signOutAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

interface PublicNavProps {
  isAuthenticated: boolean;
}

// Minimal hamburger for the public shell. Only real destinations are linked;
// the secondary items are in-page anchors to sections that actually exist on
// this page.
export function PublicNav({ isAuthenticated }: PublicNavProps) {
  const t = useTranslations("landing");
  const tNav = useTranslations("nav");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("menuOpen")}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-secondary transition-colors hover:bg-white/[0.06] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px]" aria-hidden>
          <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={t("menuLabel")}>
          <button
            type="button"
            aria-label={t("menuClose")}
            onClick={close}
            className="absolute inset-0 h-full w-full cursor-default bg-[#05060a]/70 backdrop-blur-sm"
          />
          <nav className="absolute right-0 top-0 flex h-full w-[min(20rem,86vw)] flex-col gap-1 border-l border-white/[0.07] bg-[#0b0d14]/95 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.1rem,env(safe-area-inset-top))] shadow-[0_0_80px_rgba(0,0,0,0.5)]">
            <div className="mb-3 flex items-center justify-between px-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-ink-muted">{t("menuLabel")}</span>
              <button
                type="button"
                onClick={close}
                aria-label={t("menuClose")}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-white/[0.06] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
                  <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <MenuLink href="/create" onClick={close}>{tNav("create")}</MenuLink>
            <MenuLink href="/projects" onClick={close}>{tNav("projects")}</MenuLink>
            <MenuLink href="/profile" onClick={close}>{tNav("profile")}</MenuLink>

            <div className="my-2 h-px bg-white/[0.06]" aria-hidden />

            <MenuAnchor href="#formation" onClick={close}>{t("navFormation")}</MenuAnchor>
            <MenuAnchor href="#after" onClick={close}>{t("navAfter")}</MenuAnchor>

            <div className="my-2 h-px bg-white/[0.06]" aria-hidden />

            {isAuthenticated ? (
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="w-full rounded-xl px-3 py-3 text-left text-[15px] font-medium text-ink-secondary transition-colors hover:bg-white/[0.05] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {t("signOut")}
                </button>
              </form>
            ) : (
              <>
                <MenuLink href="/login" onClick={close}>{t("login")}</MenuLink>
                <MenuLink href="/signup" onClick={close} emphasis>{t("ctaShort")}</MenuLink>
              </>
            )}
          </nav>
        </div>
      )}
    </>
  );
}

function MenuLink({ href, onClick, children, emphasis }: { href: string; onClick: () => void; children: React.ReactNode; emphasis?: boolean }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "rounded-xl px-3 py-3 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        emphasis ? "bg-white/[0.06] text-ink hover:bg-white/[0.1]" : "text-ink-secondary hover:bg-white/[0.05] hover:text-ink"
      )}
    >
      {children}
    </Link>
  );
}

function MenuAnchor({ href, onClick, children }: { href: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <a
      href={href}
      onClick={onClick}
      className="rounded-xl px-3 py-3 text-[15px] font-medium text-ink-secondary transition-colors hover:bg-white/[0.05] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {children}
    </a>
  );
}
