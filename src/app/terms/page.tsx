import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PublicShell } from "@/components/public/PublicShell";
import { PublicPage } from "@/components/public/PublicPage";
import { LegalSections } from "@/components/legal/LegalSections";
import { legalConfig } from "@/config/legal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.terms");
  return { title: t("pageTitle") };
}

export default async function TermsPage() {
  const t = await getTranslations("legal.terms");
  const tCommon = await getTranslations("legal.common");

  // Every variable the string names has to be supplied: next-intl treats a
  // missing one as a formatting error and renders the key path — this page was
  // publishing the literal text "legal.terms.intro" where its opening paragraph
  // belongs. The same operator details are resolved the same way on /privacy
  // and /ai-policy, whose intros were already passing them.
  const cityPart = legalConfig.operatorCity ? `, ${legalConfig.operatorCity}` : "";
  const intro = t("intro", {
    productName: legalConfig.productName,
    operatorName: legalConfig.operatorName,
    operatorCountry: legalConfig.operatorCountry,
    operatorCityPart: cityPart,
  });

  const sections = t.raw("sections") as { title: string; body: string }[];
  const resolvedSections = sections.map((section) => ({
    title: section.title,
    body: section.body
      .replaceAll("{productName}", legalConfig.productName)
      .replaceAll("{minimumAge}", String(legalConfig.minimumAge))
      .replaceAll("{governingLaw}", legalConfig.governingLaw),
  }));

  return (
    <PublicShell>
      <PublicPage title={t("pageTitle")} lede={intro} narrow>
      <LegalSections sections={resolvedSections} />
      <p className="lp-legal-foot">
        {tCommon("lastUpdated", { date: legalConfig.effectiveDate })}
        <br />
        {tCommon("contactCta", { email: legalConfig.contactEmail })}
      </p>
      </PublicPage>
    </PublicShell>
  );
}
