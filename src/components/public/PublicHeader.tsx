"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { VentrioMark } from "@/components/workspace-ui/parts";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/shadcn/sheet";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/shadcn/navigation-menu";

/**
 * The one header every public page wears.
 *
 * WHAT IT REPLACES. The public site had THREE unrelated pieces of chrome: this
 * navigation on `/` only, an `InfoLayout` on /about, /who-its-for and /faq whose
 * entire header was a "← Back home" link, and a `BackNav` + `PageHeader` pair on
 * the legal pages and /contact. /pricing had a fourth arrangement of its own.
 * Visiting two public pages in a row therefore looked like visiting two
 * different sites, and the navigation a visitor learned on the homepage did not
 * exist anywhere they could go from it.
 *
 * It is a single component now, mounted by `PublicShell`, so a route cannot
 * accidentally acquire its own header again.
 *
 * The `lp-` class prefix is historical — it was the landing page's stylesheet
 * before the stylesheet became the public site's. It is left alone because
 * renaming ~200 selectors buys nothing a comment cannot.
 */

/**
 * The chip button.
 *
 * THE LABEL IS PRESENT TWICE, ON PURPOSE. The label sits in an `overflow:
 * hidden` window with two stacked copies; on hover the stack translates exactly
 * one line-height, so the first copy leaves as the second arrives and the
 * control never changes size.
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
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />
    </svg>
  );
}

/**
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
 * committing a click. This is the installed shadcn NavigationMenu with its own
 * interaction model intact — hover intent, keyboard, focus and dismissal are
 * Radix's, not a CSS impression of them.
 *
 * EVERY IN-PAGE TARGET IS WRITTEN `/#id`, NOT `#id`. A bare `#how` resolves
 * against whatever page is current, so on /pricing it pointed at an element that
 * does not exist there and did nothing. Rooted at `/` it goes to the homepage
 * section from anywhere, and still scrolls without a reload when you are already
 * on the homepage.
 */
export function PublicHeader({ isAuthenticated }: { isAuthenticated: boolean }) {
  const t = useTranslations("landing");
  const [stuck, setStuck] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
        { href: "/#how", title: t("menuHowA"), desc: t("menuHowADesc") },
        { href: "/#after", title: t("menuHowB"), desc: t("menuHowBDesc") },
      ],
    },
    {
      label: t("navPricing"),
      lead: t("menuPriceLead"),
      links: [
        { href: "/pricing", title: t("menuPriceA"), desc: t("menuPriceADesc") },
        { href: "/#pricing", title: t("menuPriceB"), desc: t("menuPriceBDesc") },
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

        {/**
         * `viewport={false}` is the whole fix for "every dropdown opens in the
         * same place".
         *
         * The registry's default renders ONE shared `NavigationMenuViewport`,
         * absolutely positioned against the menu root, and portals whichever
         * item is open into it. Every panel therefore appears at the same
         * coordinates no matter which trigger opened it — and the rule that
         * centred that viewport under the nav made all four land dead centre.
         *
         * Switched off, Radix renders each `NavigationMenuContent` inside its
         * own `NavigationMenuItem`, which is what lets the stylesheet anchor a
         * panel to the trigger it belongs to instead of to the menu.
         */}
        <NavigationMenu className="lp-nav" viewport={false} aria-label={t("menuLabel")}>
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
                          <Link href={link.href} className="lp-nav-card">
                            <span className="lp-nav-card-title">{link.title}</span>
                            <span className="lp-nav-card-desc">{link.desc}</span>
                          </Link>
                        </NavigationMenuLink>
                      </li>
                    ))}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>

        {/**
         * THE PHONE GETS A DRAWER, NOT A SECOND ROW.
         *
         * Four triggers cannot sit on one line at 390px, so the nav used to
         * move to its own full-width row and wrap onto two — a header three
         * rows tall before any content, on the viewport with the least of it.
         * The desktop NavigationMenu is untouched above 880px; below it the
         * same destinations live in a sheet behind one control, and the header
         * is a fixed single row.
         */}
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger className="lp-menu-btn" aria-label={t("menuLabel")}>
            <Menu size={20} aria-hidden />
          </SheetTrigger>
          <SheetContent side="right" className="lp-menu-sheet">
            <SheetHeader>
              <SheetTitle>{t("menuLabel")}</SheetTitle>
            </SheetHeader>
            <nav className="lp-menu-nav">
              {menus.map((menu) => (
                <div key={menu.label} className="lp-menu-group">
                  <p className="lp-menu-group-title">{menu.label}</p>
                  {menu.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="lp-menu-link"
                      /* A drawer that stays open over the page it just
                         navigated to is a drawer nobody closed. */
                      onClick={() => setMenuOpen(false)}
                    >
                      <span className="lp-menu-link-title">{link.title}</span>
                      <span className="lp-menu-link-desc">{link.desc}</span>
                    </Link>
                  ))}
                </div>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

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
