import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { Wordmark } from "@/components/layout/Wordmark";
import { legalConfig } from "@/config/legal";

/** The one address we publish. Stated here so it lives in exactly one place. */
const CONTACT_EMAIL = "founder@ventrio.org";

/**
 * The public footer, shared by the landing and every standalone page.
 *
 * Every destination is a route that exists or an anchor on the landing. The
 * in-page anchor is absolute (`/#how-it-works`) because this also renders on
 * /privacy, /login and the rest, where a bare `#how-it-works` would point at
 * nothing. No social links: none are configured, and an invented handle is
 * worse than an absent one.
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
        { href: "/delete-account", label: t("deleteAccount") },
      ],
    },
  ];

  const linkClass =
    "rounded-sm text-ink-muted transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  return (
    <footer className="mt-16 border-t border-border/60 pt-10 text-sm">
      <div className="flex flex-col gap-10 md:flex-row md:justify-between">
        {/* Who this is, in one line */}
        <div className="max-w-xs">
          <Link
            href="/"
            aria-label={legalConfig.productName}
            className="inline-flex items-center gap-2 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Wordmark className="h-5 w-5" />
            <span className="text-[15px] font-semibold text-ink">{legalConfig.productName}</span>
          </Link>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">{t("blurb")}</p>
        </div>

        <nav className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-4 md:gap-x-12" aria-label={t("groupsLabel")}>
          {groups.map((group) => (
            <div key={group.title}>
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-secondary">
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

          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-secondary">
              {t("groupContact")}
            </h2>
            <ul className="mt-3 flex flex-col gap-2 text-[13px]">
              <li>
                <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>
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
    </footer>
  );
}
