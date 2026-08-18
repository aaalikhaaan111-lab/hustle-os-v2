"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { VentrioMark } from "@/components/workspace-ui/parts";

/**
 * The one entrance on the page.
 *
 * A band rises a little as it enters the viewport, once, and never again. It
 * exists so a long page reads as a sequence rather than arriving all at once —
 * and it is the only scroll-linked motion here, because motion that reacts to
 * every pixel of scroll is the thing that makes a landing page feel like a
 * demo rather than a product.
 *
 * `once: true` by construction: the observer disconnects on the first
 * intersection, so scrolling back up never replays anything.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  /** Milliseconds, for staggering siblings. Kept small deliberately. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    // Anything already on screen at load is shown immediately rather than
    // animated, so the hero never fades in under the reader.
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        setShown(true);
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`lp-reveal ${className}`}
      data-shown={shown ? "true" : undefined}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

/** The chip button: an accent tile beside a dark pill. */
export function Chip({
  href,
  label,
  large = false,
}: {
  href: string;
  label: string;
  large?: boolean;
}) {
  return (
    <Link href={href} className={`lp-chip${large ? " lp-chip--lg" : ""}`}>
      <span className="lp-chip-icon" aria-hidden>
        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />
        </svg>
      </span>
      <span className="lp-chip-label">{label}</span>
    </Link>
  );
}

/**
 * The header. Transparent over the hero and gaining its hairline only once the
 * page has moved, so the top of the page is the hero rather than a bar.
 */
export function LandingHeader({ isAuthenticated }: { isAuthenticated: boolean }) {
  const t = useTranslations("landing");
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="lp-header" data-stuck={stuck ? "true" : undefined}>
      <div className="lp-wrap lp-header-inner">
        <Link href="/" className="lp-brand">
          <VentrioMark size={20} />
          Ventrio
        </Link>

        <nav className="lp-nav" aria-label={t("menuLabel")}>
          <a href="#how">{t("navHow")}</a>
          <a href="#after">{t("navAfter")}</a>
          <a href="#pricing">{t("navPricing")}</a>
          <a href="#faq">{t("navFaq")}</a>
        </nav>

        <div className="flex items-center justify-self-end">
          <Chip
            href={isAuthenticated ? "/dashboard" : "/signup?next=%2Fcreate"}
            label={isAuthenticated ? t("ctaOpen") : t("ctaStart")}
          />
        </div>
      </div>
    </header>
  );
}

/**
 * The after-launch list.
 *
 * One item open at a time, the rest reduced to their headings — so the column
 * reads as a set of choices rather than four paragraphs competing for the same
 * attention. Buttons, not clickable divs: this is a real disclosure and the
 * keyboard should reach it.
 */
export function FeatureList({
  items,
}: {
  items: { title: string; body: string }[];
}) {
  const [open, setOpen] = useState(0);

  return (
    <div className="lp-list">
      {items.map((item, index) => (
        <button
          key={item.title}
          type="button"
          className="lp-list-item"
          data-open={index === open ? "true" : undefined}
          aria-expanded={index === open}
          onClick={() => setOpen(index)}
          onMouseEnter={() => setOpen(index)}
        >
          <h3>{item.title}</h3>
          <span className="lp-list-body">
            <span>{item.body}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
