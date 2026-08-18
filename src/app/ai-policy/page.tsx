import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PublicShell } from "@/components/public/PublicShell";
import { PublicPage } from "@/components/public/PublicPage";
import { LegalSections } from "@/components/legal/LegalSections";
import { legalConfig } from "@/config/legal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.aiPolicy");
  return { title: t("pageTitle") };
}

export default async function AiPolicyPage() {
  const t = await getTranslations("legal.aiPolicy");
  const tCommon = await getTranslations("legal.common");

  const cityPart = legalConfig.operatorCity ? `, ${legalConfig.operatorCity}` : "";
  const intro = t("intro", {
    productName: legalConfig.productName,
    operatorName: legalConfig.operatorName,
    operatorCountry: legalConfig.operatorCountry,
    operatorCityPart: cityPart,
    contactEmail: legalConfig.contactEmail,
  });

  const sections = t.raw("sections") as { title: string; body: string }[];
  const resolvedSections = sections.map((section) => ({
    title: section.title,
    body: section.body
      .replaceAll("{contactEmail}", legalConfig.contactEmail)
      .replaceAll("{productName}", legalConfig.productName)
      .replaceAll("{minimumAge}", String(legalConfig.minimumAge)),
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
