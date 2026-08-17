import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { Wordmark } from "@/components/layout/Wordmark";
import { legalConfig } from "@/config/legal";
import { IconInstagram, IconThreads, IconTikTok } from "@/components/layout/SocialIcons";

/** The one address we publish. Stated here so it lives in exactly one place. */
const CONTACT_EMAIL = "founder@ventrio.org";

/**
 * The accounts that exist. Adding one here is the whole change — the row
 * renders from this list, and an account we do not have simply is not in it.
 */
const SOCIAL_LINKS = [
  { href: "https://instagram.com/ventrio.app", label: "Instagram", icon: IconInstagram },
  { href: "https://threads.net/@ventrio.app", label: "Threads", icon: IconThreads },
  { href: "https://tiktok.com/@ventrio.app", label: "TikTok", icon: IconTikTok },
] as const;

/**
 * The public footer, shared by the landing and every standalone page.
 *
 * Every destination is a route that exists or an anchor on the landing. The
 * in-page anchor is absolute (`/#how-it-works`) because this also renders on
 * /privacy, /login and the rest, where a bare `#how-it-works` would point at
 * nothing.
 *
 * IT SETS ITS OWN WIDTH. The footer used to take whatever width its parent
 * gave it, which was the landing's 1280px container on the homepage and a
 * reading-measure `max-w-2xl` on the legal pages — where five link columns had
 * to share 42rem and the row collapsed. The inner container below is the
 * footer's own, so the layout is the same wherever it renders, and a page
 * cannot squeeze it by nesting it in a narrower wrapper.
 */
export async function PublicFooter() {
  const t = await getTranslations("footer");
  const year = new Date().getFullYear();

  const groups = [
    {
      title: t("groupProduct"),
      links: [
        { href: "/#how-it-works", label: t("howItWorks") },
        { href: "/projects", label: t("myProjects") },
        { href: "/create", label: t("startBuilding") },
      ],
    },
    {
      title: t("groupCompany"),
      links: [
        { href: "/about", label: t("about") },
        { href: "/who-its-for", label: t("whoItsFor") },
        { href: "/faq", label: t("faq") },
      ],
    },
    {
      title: t("groupLegal"),
      links: [
        { href: "/privacy", label: t("privacy") },
        { href: "/terms", label: t("terms") },
        { href: "/cookies", label: t("cookies") },
        { href: "/refund-policy", label: t("refundPolicy") },
        { href: "/ai-policy", label: t("aiPolicy") },
        { href: "/delete-account", label: t("deleteAccount") },
      ],
    },
  ];

  const linkClass =
    "rounded-sm text-ink-muted transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  return (
    <footer className="mt-16 text-sm">
      {/* The footer's own container, so it measures itself rather than
          inheriting whatever column it was dropped into. A full-bleed was
          tried first and is wrong here: it escapes the app shell's drawer
          padding as well as the page's reading column, and clips the footer
          under the open nav. Pages therefore hand the footer the width they
          hand the landing, and this caps it. */}
      <div
        data-footer-inner
        className="mx-auto w-full max-w-[1280px] border-t border-border/60 pt-10"
      >
      <div className="flex flex-col gap-10 md:flex-row md:justify-between">
        {/* Who this is, in one line, and where to find us.
            `-mt-1` on the wide layout only: the wordmark row is a 20px mark
            beside 15px text, against the sentence-case headings in the columns
            opposite, so matching the container tops left this block sitting
            visibly lower than the row it is meant to align with. The nudge is
            optical, and it is skipped on the stacked layout where there is
            nothing beside it to align to. */}
        <div className="max-w-xs md:-mt-1">
          <Link
            href="/"
            aria-label={legalConfig.productName}
            className="inline-flex items-center gap-2 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Wordmark className="h-5 w-5" />
            <span className="text-[15px] font-semibold text-ink">{legalConfig.productName}</span>
          </Link>
          <p className="mt-2.5 text-[13px] leading-relaxed text-ink-muted">{t("blurb")}</p>
          <ul className="-ml-1.5 mt-3 flex items-center gap-1" aria-label={t("socialLabel")}>
            {SOCIAL_LINKS.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={label}
                  title={label}
                  className={`${linkClass} inline-flex h-8 w-8 items-center justify-center`}
                >
                  <Icon className="h-5 w-5" />
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Four columns only while the nav has the container to itself. From md
            it sits beside the blurb, which leaves each of four tracks ~42px —
            narrower than a single heading in either language, so the row
            overflowed the page. Two tracks there, four again at lg where the
            row is wide enough. `min-w-0` lets a track shrink to its box rather
            than to its longest word. */}
        <nav
          className="grid min-w-0 grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-4 md:grid-cols-2 md:gap-x-10 lg:grid-cols-4 lg:gap-x-12"
          aria-label={t("groupsLabel")}
        >
          {groups.map((group) => (
            <div key={group.title} className="min-w-0">
              <h2 className="s-eyebrow break-words">
                {group.title}
              </h2>
              <ul className="mt-3 flex flex-col gap-2 text-[13px]">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={linkClass}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="min-w-0">
            <h2 className="s-eyebrow break-words">
              {t("groupContact")}
            </h2>
            <ul className="mt-3 flex flex-col gap-2 text-[13px]">
              <li>
                {/* The one token here with no natural break point. */}
                <a href={`mailto:${CONTACT_EMAIL}`} className={`${linkClass} break-all`}>
                  {CONTACT_EMAIL}
                </a>
              </li>
              <li>
                <Link href="/contact" className={linkClass}>
                  {t("contact")}
                </Link>
              </li>
            </ul>
          </div>
        </nav>
      </div>

      <div className="mt-10 flex flex-col-reverse gap-4 border-t border-border/60 pt-6 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
        <p>{t("rights", { year, productName: legalConfig.productName })}</p>
        <LanguageSwitcher />
      </div>
      </div>
    </footer>
  );
}
