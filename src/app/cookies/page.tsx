import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { LegalSections } from "@/components/legal/LegalSections";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { legalConfig } from "@/config/legal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.cookies");
  return { title: t("pageTitle") };
}

export default async function CookiesPage() {
  const t = await getTranslations("legal.cookies");
  const tCommon = await getTranslations("legal.common");

  const intro = t("intro", { productName: legalConfig.productName });
  const sections = t.raw("sections") as { title: string; body: string }[];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 py-4 sm:py-6">
      <PageHeader title={t("pageTitle")} description={intro} />
      <LegalSections sections={sections} />
      <p className="text-xs text-ink-muted">
        {tCommon("lastUpdated", { date: legalConfig.effectiveDate })}
        <br />
        {tCommon("contactCta", { email: legalConfig.contactEmail })}
      </p>
      <PublicFooter />
    </div>
  );
}
