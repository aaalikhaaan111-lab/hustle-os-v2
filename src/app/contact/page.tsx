import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PublicShell } from "@/components/public/PublicShell";
import { PublicPage } from "@/components/public/PublicPage";
import { legalConfig } from "@/config/legal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.contact");
  const title = t("pageTitle");
  /* Without its own `alternates` this page inherited the root canonical, which
     told crawlers this URL IS the homepage — the one canonical mistake that
     actively removes a page from an index. */
  return {
    title,
    alternates: { canonical: "/contact" },
    openGraph: { title, url: "/contact" },
  };
}

export default async function ContactPage() {
  const t = await getTranslations("legal.contact");

  return (
    <PublicShell>
      <PublicPage title={t("pageTitle")} lede={t("intro")} narrow>
        <div className="lp-tile">
          <p className="lp-eyebrow">{t("emailLabel")}</p>
          <p className="lp-contact-email">
            <a href={`mailto:${legalConfig.contactEmail}`}>{legalConfig.contactEmail}</a>
          </p>
          <p>{t("responseNote")}</p>
        </div>
      </PublicPage>
    </PublicShell>
  );
}
