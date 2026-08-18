import { getTranslations } from "next-intl/server";
import { PublicShell } from "@/components/public/PublicShell";
import { PublicPage } from "@/components/public/PublicPage";
import { Faq } from "@/components/public/Faq";

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
