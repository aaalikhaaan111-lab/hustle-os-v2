import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PublicShell } from "@/components/public/PublicShell";
import { PublicPage } from "@/components/public/PublicPage";
import { LegalSections } from "@/components/legal/LegalSections";
import { legalConfig } from "@/config/legal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.cookies");
  return { title: t("pageTitle") };
}

export default async function CookiesPage() {
  const t = await getTranslations("legal.cookies");
  const tCommon = await getTranslations("legal.common");

  const intro = t("intro", { productName: legalConfig.productName });
  // Resolved the same way as the other legal pages. This one passed its
  // sections through untouched, so a `{productName}` inside a section body
  // reached the page as literal braces.
  const sections = (t.raw("sections") as { title: string; body: string }[]).map((section) => ({
    title: section.title,
    body: section.body
      .replaceAll("{contactEmail}", legalConfig.contactEmail)
      .replaceAll("{productName}", legalConfig.productName)
      .replaceAll("{minimumAge}", String(legalConfig.minimumAge)),
  }));

  return (
    <PublicShell>
      <PublicPage title={t("pageTitle")} lede={intro} narrow>
      <LegalSections sections={sections} />
      <p className="lp-legal-foot">
        {tCommon("lastUpdated", { date: legalConfig.effectiveDate })}
        <br />
        {tCommon("contactCta", { email: legalConfig.contactEmail })}
      </p>
      </PublicPage>
    </PublicShell>
  );
}
