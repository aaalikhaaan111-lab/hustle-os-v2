import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PublicShell } from "@/components/public/PublicShell";
import { PublicPage } from "@/components/public/PublicPage";

/**
 * Its own title and description, rather than inheriting the site's.
 *
 * Eighteen routes shared one `<title>`, which makes them indistinguishable in a
 * result list and in a browser's history. The description is taken from copy
 * this page already shows, so nothing is invented for crawlers that a visitor
 * would not read.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("info");
  const title = t("aboutTitle");
  const description = t("aboutP1").slice(0, 155);
  return {
    title,
    description,
    alternates: { canonical: "/about" },
    openGraph: { title, description, url: "/about" },
    twitter: { title, description },
  };
}


export default async function AboutPage() {
  const t = await getTranslations("info");
  return (
    <PublicShell>
      <PublicPage eyebrow={t("aboutEyebrow")} title={t("aboutTitle")} narrow>
        <div className="lp-prose">
          <p>{t("aboutP1")}</p>
          <p>{t("aboutP2")}</p>
          <p>{t("aboutP3")}</p>
        </div>
      </PublicPage>
    </PublicShell>
  );
}
