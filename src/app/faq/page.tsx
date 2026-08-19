import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PublicShell } from "@/components/public/PublicShell";
import { PublicPage } from "@/components/public/PublicPage";
import { Faq } from "@/components/public/Faq";

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
  const title = t("faqTitle");
  const description = t("faqA1").slice(0, 155);
  return {
    title,
    description,
    alternates: { canonical: "/faq" },
    openGraph: { title, description, url: "/faq" },
    twitter: { title, description },
  };
}


/**
 * The same accordion the homepage uses. This page used to render its own
 * always-open question list in its own type scale — two answers to the same
 * question, styled differently, on one site.
 *
 * Nothing is open on arrival here: the page is nothing but questions, so
 * choosing one for the visitor would be arbitrary.
 */
export default async function FaqPage() {
  const t = await getTranslations("info");
  const qa = [1, 2, 3, 4, 5].map((n) => ({
    q: t(`faqQ${n}` as never),
    a: t(`faqA${n}` as never),
  }));

  return (
    <PublicShell>
      <PublicPage eyebrow={t("faqEyebrow")} title={t("faqTitle")}>
        <Faq items={qa} initialOpen={null} />
      </PublicPage>
    </PublicShell>
  );
}
