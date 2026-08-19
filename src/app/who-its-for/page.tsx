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
  const title = t("whoTitle");
  const description = t("whoIntro").slice(0, 155);
  return {
    title,
    description,
    alternates: { canonical: "/who-its-for" },
    openGraph: { title, description, url: "/who-its-for" },
    twitter: { title, description },
  };
}


export default async function WhoItsForPage() {
  const t = await getTranslations("info");
  const groups = [1, 2, 3, 4].map((n) => ({
    title: t(`who${n}Title` as never),
    body: t(`who${n}Body` as never),
  }));

  return (
    <PublicShell>
      <PublicPage eyebrow={t("whoEyebrow")} title={t("whoTitle")} lede={t("whoIntro")}>
        <div className="lp-tiles">
          {groups.map((group) => (
            <div key={group.title} className="lp-tile">
              <h2>{group.title}</h2>
              <p>{group.body}</p>
            </div>
          ))}
        </div>
      </PublicPage>
    </PublicShell>
  );
}
