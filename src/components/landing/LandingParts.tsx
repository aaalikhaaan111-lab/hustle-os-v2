"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { VentrioMark } from "@/components/workspace-ui/parts";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/shadcn/navigation-menu";

/**
 * The chip button.
 *
 * THE LABEL IS PRESENT TWICE, ON PURPOSE. The reference's one genuinely
 * distinctive control keeps its label in an `overflow: hidden` window with two
 * stacked copies; on hover the stack translates exactly one line-height, so the
 * first copy leaves as the second arrives. Measured on the reference: a 15.6px
 * translate against a 15.6px line box, and the button's width does not change
 * between states — which is what keeps the swap from nudging the layout.
 *
 * The arrow does the same thing horizontally, so the whole control moves as one
 * idea rather than as two animated parts.
 */
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
        <span className="lp-swap">
          <span className="lp-swap-a">
            <Arrow />
          </span>
          <span className="lp-swap-b">
            <Arrow />
          </span>
        </span>
      </span>
      <span className="lp-chip-label">
        {/* The second copy is decorative: screen readers read the first. */}
        <span className="lp-swap">
          <span className="lp-swap-a">{label}</span>
          <span className="lp-swap-b" aria-hidden>
            {label}
          </span>
        </span>
      </span>
    </Link>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />
    </svg>
  );
}

/**
 * The header, on shadcn's Navigation Menu.
 *
 * The list, the item semantics and the focus behaviour come from the registry
 * component — `NavigationMenuLink` is what gives each destination its
 * `data-active` hook and its keyboard handling, and Radix owns the roving
 * focus. What is Ventrio's is the presentation: the demo's pill-shaped trigger
 * background is dropped for a rule that grows from the left, because that is
 * the movement this page already uses on its cards and its disclosure list.
 *
 * There is no dropdown. Every destination is a page or a section, so a
 * `NavigationMenuTrigger` with a viewport panel would be machinery wrapped
 * around four links — `viewport={false}` removes it.
 *
 * DESTINATIONS ARE REAL. Three are pages that exist; `#how` is the one section
 * that exists nowhere else, and the stylesheet's `scroll-margin-top` is what
 * makes it land clear of this bar.
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

  const links = [
    { href: "#how", label: t("navHow") },
    { href: "/pricing", label: t("navPricing") },
    { href: "/about", label: t("navAbout") },
    { href: "/faq", label: t("navFaq") },
  ];

  return (
    <header className="lp-header" data-stuck={stuck ? "true" : undefined}>
      <div className="lp-wrap lp-header-inner">
        <Link href="/" className="lp-brand">
          <VentrioMark size={20} />
          Ventrio
        </Link>

        <NavigationMenu viewport={false} className="lp-nav" aria-label={t("menuLabel")}>
          <NavigationMenuList className="lp-nav-list">
            {links.map((link) => (
              <NavigationMenuItem key={link.href}>
                <NavigationMenuLink asChild className="lp-nav-link">
                  {link.href.startsWith("#") ? (
                    <a href={link.href}>{link.label}</a>
                  ) : (
                    <Link href={link.href}>{link.label}</Link>
                  )}
                </NavigationMenuLink>
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>

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
 * The card deck: one open at a time, driven by the pointer.
 *
 * THIS IS WHAT REPLACES THE SCROLL REVEAL. The page is now fully present the
 * moment it loads; what moves is what you point at. Hovering a card expands it
 * — it widens, lifts onto the page's surface colour and shows its explanation —
 * while the others fall back to a ghosted numeral and a title. It is the
 * reference's card behaviour, verified there by hovering the fourth card and
 * watching the second collapse.
 *
 * Focus does the same thing as hover, so a keyboard reaches every explanation,
 * and the deck is a list of buttons rather than divs for the same reason.
 *
 * On touch there is no hover: below the wide breakpoint the stylesheet lays
 * these out as a normal grid with every explanation visible, so nothing is
 * hidden behind an interaction that device cannot perform.
 */
export function CardDeck({
  cards,
}: {
  cards: { n: number; title: string; body: string }[];
}) {
  const [open, setOpen] = useState(0);

  return (
    <div className="lp-deck">
      {cards.map((card, index) => (
        <button
          key={card.n}
          type="button"
          className="lp-card"
          data-open={index === open ? "true" : undefined}
          aria-expanded={index === open}
          /* `onMouseMove` for the same reason as the after-launch list: an
             expanding card reflows the row, and a reflow must never be able to
             change the selection under a cursor that did not move. */
          onMouseMove={() => setOpen(index)}
          onFocus={() => setOpen(index)}
          onClick={() => setOpen(index)}
        >
          <span className="lp-card-n" aria-hidden>
            {String(card.n).padStart(2, "0")}
          </span>
          <span className="lp-card-text">
            <span className="lp-card-title">{card.title}</span>
            <span className="lp-card-body">
              <span>{card.body}</span>
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * The after-launch list. Same single-open rule as the deck, laid out
 * vertically, so the two disclosures on the page behave identically.
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
          onMouseMove={() => setOpen(index)}
          onFocus={() => setOpen(index)}
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

/** Kept as a plain passthrough so callers do not need to change shape. */
export function Plain({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
