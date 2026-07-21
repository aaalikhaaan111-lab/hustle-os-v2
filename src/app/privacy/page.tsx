import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { BackNav } from "@/components/layout/BackNav";
import { LegalSections } from "@/components/legal/LegalSections";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { legalConfig } from "@/config/legal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.privacy");
  return { title: t("pageTitle") };
}

export default async function PrivacyPage() {
  const t = await getTranslations("legal.privacy");
  const tCommon = await getTranslations("legal.common");
  const tc = await getTranslations("common");

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
    <div className="mx-auto flex max-w-2xl flex-col gap-6 py-4 sm:py-6">
      <BackNav fallback="/" label={tc("backToVentrio")} />
      <PageHeader title={t("pageTitle")} description={intro} />
      <LegalSections sections={resolvedSections} />
      <p className="text-xs text-ink-muted">
        {tCommon("lastUpdated", { date: legalConfig.effectiveDate })}
        <br />
        {tCommon("contactCta", { email: legalConfig.contactEmail })}
      </p>
      <PublicFooter />
    </div>
  );
}
