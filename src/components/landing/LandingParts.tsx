"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { VentrioMark } from "@/components/workspace-ui/parts";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/shadcn/navigation-menu";

/**
 * The chip button.
 *
 * THE LABEL IS PRESENT TWICE, ON PURPOSE. The label sits in an `overflow:
 * hidden` window with two stacked copies; on hover the stack translates exactly
 * one line-height, so the first copy leaves as the second arrives and the
 * control never changes size.
 *
 * The swap runs at 260ms with a short blur through the middle of the travel —
 * at the 140ms it used to run, the two labels read as a flicker rather than as
 * one label being replaced by another.
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
 * MATHEMATICALLY CENTRED. The grid was `auto 1fr auto`, so the middle column
 * began after the brand and ended before the CTA — and because those two are
 * different widths (about 95px against 165px), centring the nav inside that
 * column left it roughly 35px to the left of the actual centre of the page. The
 * columns are `1fr auto 1fr` now: the side tracks are equal by definition, so
 * the middle one is centred in the viewport whatever the brand or the button
 * happen to measure.
 *
 * Each destination is a trigger with a panel rather than a bare link, because
 * the panel is where a visitor finds out what is behind the word before
 * committing a click. Every link inside a panel is a route that exists.
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

  const menus = [
    {
      label: t("navHow"),
      lead: t("menuHowLead"),
      links: [
        { href: "#how", title: t("menuHowA"), desc: t("menuHowADesc") },
        { href: "#after", title: t("menuHowB"), desc: t("menuHowBDesc") },
      ],
    },
    {
      label: t("navPricing"),
      lead: t("menuPriceLead"),
      links: [
        { href: "/pricing", title: t("menuPriceA"), desc: t("menuPriceADesc") },
        { href: "#pricing", title: t("menuPriceB"), desc: t("menuPriceBDesc") },
      ],
    },
    {
      label: t("navAbout"),
      lead: t("menuAboutLead"),
      links: [
        { href: "/about", title: t("menuAboutA"), desc: t("menuAboutADesc") },
        { href: "/who-its-for", title: t("menuAboutB"), desc: t("menuAboutBDesc") },
      ],
    },
    {
      label: t("navFaq"),
      lead: t("menuHelpLead"),
      links: [
        { href: "/faq", title: t("menuHelpA"), desc: t("menuHelpADesc") },
        { href: "/contact", title: t("menuHelpB"), desc: t("menuHelpBDesc") },
      ],
    },
  ];

  return (
    <header className="lp-header" data-stuck={stuck ? "true" : undefined}>
      <div className="lp-wrap lp-header-inner">
        <Link href="/" className="lp-brand">
          <VentrioMark size={20} />
          Ventrio
        </Link>

        <NavigationMenu className="lp-nav" aria-label={t("menuLabel")}>
          <NavigationMenuList className="lp-nav-list">
            {menus.map((menu) => (
              <NavigationMenuItem key={menu.label}>
                <NavigationMenuTrigger className="lp-nav-trigger">
                  {menu.label}
                </NavigationMenuTrigger>
                <NavigationMenuContent className="lp-nav-panel">
                  <p className="lp-nav-lead">{menu.lead}</p>
                  <ul className="lp-nav-links">
                    {menu.links.map((link) => (
                      <li key={link.href}>
                        <NavigationMenuLink asChild>
                          {link.href.startsWith("#") ? (
                            <a href={link.href} className="lp-nav-card">
                              <span className="lp-nav-card-title">{link.title}</span>
                              <span className="lp-nav-card-desc">{link.desc}</span>
                            </a>
                          ) : (
                            <Link href={link.href} className="lp-nav-card">
                              <span className="lp-nav-card-title">{link.title}</span>
                              <span className="lp-nav-card-desc">{link.desc}</span>
                            </Link>
                          )}
                        </NavigationMenuLink>
                      </li>
                    ))}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>

        <div className="lp-header-cta">
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
 * The four cards.
 *
 * NOT INTERACTIVE ANY MORE. They were buttons in a hover accordion: pointing at
 * one widened it and collapsed its neighbours, so reading the row moved the row.
 * They are plain articles now, all the same size, and nothing a visitor does
 * changes the layout.
 *
 * What hover adds is a small drawn figure inside the card being pointed at, and
 * only that card. The figure is CSS — a stack of bars standing for a page, a
 * cursor, a thread — because a photograph or a stock illustration here would be
 * decoration, and these are meant to say something about the sentence above
 * them.
 *
 * On touch there is no hover, so the stylesheet shows the figure permanently in
 * a compact form: nothing is behind an interaction the device cannot perform.
 */
export function CardDeck({
  cards,
}: {
  cards: { n: number; title: string; body: string }[];
}) {
  return (
    <div className="lp-deck">
      {cards.map((card) => (
        <article key={card.n} className="lp-card" tabIndex={0}>
          <span className="lp-card-n" aria-hidden>
            {String(card.n).padStart(2, "0")}
          </span>

          {/* The figure. Purely illustrative, hidden from assistive tech. */}
          <span className={`lp-figure lp-figure--${card.n}`} aria-hidden>
            <span />
            <span />
            <span />
          </span>

          <span className="lp-card-text">
            <span className="lp-card-title">{card.title}</span>
            <span className="lp-card-body">{card.body}</span>
          </span>
        </article>
      ))}
    </div>
  );
}

/**
 * The FAQ, as a real accordion.
 *
 * It was six static question-and-answer blocks, every answer always open, which
 * is a wall of text rather than a list of questions. The whole row is the
 * control, one answer is open at a time, and the height animates rather than
 * snapping.
 *
 * SINGLE-OPEN, deliberately: with six items and short answers, letting several
 * stand open recreates the wall this replaces.
 */
export function Faq({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="lp-faq">
      {items.map((item, index) => {
        const isOpen = index === open;
        return (
          <div key={item.q} className="lp-faq-item" data-open={isOpen ? "true" : undefined}>
            <button
              type="button"
              className="lp-faq-q"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : index)}
            >
              <span>{item.q}</span>
              <span className="lp-faq-mark" aria-hidden />
            </button>
            <div className="lp-faq-a">
              <div>
                <p>{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
