import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { BackNav } from "@/components/layout/BackNav";
import { LegalSections } from "@/components/legal/LegalSections";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { legalConfig } from "@/config/legal";

/**
 * The refund policy, published because Paddle requires one to verify a seller.
 *
 * Built from the same three pieces as every other legal page — `BackNav`,
 * `PageHeader`, `LegalSections` — so it inherits the type scale, the measure and
 * the footer without introducing a fourth way to lay out a document.
 *
 * `SUPPORT_EMAIL` is page-local rather than `legalConfig.contactEmail`
 * (founder@), because refunds should reach a mailbox that stays answered as
 * volume grows and Paddle checks the address on this page receives mail.
 *
 * The date line is this page's own message too, not the shared `legal.common`
 * one. That string reads "Effective date: {date}" and is used verbatim by
 * Privacy, Terms, Cookies and the AI Policy — rewording it to suit this page
 * would silently change four documents that were reviewed as they are.
 */
const SUPPORT_EMAIL = "support@ventrio.org";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.refundPolicy");
  return { title: t("pageTitle") };
}

export default async function RefundPolicyPage() {
  const t = await getTranslations("legal.refundPolicy");
  const tCommon = await getTranslations("legal.common");
  const tc = await getTranslations("common");

  const intro = t("intro", { productName: legalConfig.productName });

  const sections = (t.raw("sections") as { title: string; body: string }[]).map((section) => ({
    title: section.title,
    body: section.body
      .replaceAll("{productName}", legalConfig.productName)
      .replaceAll("{supportEmail}", SUPPORT_EMAIL),
  }));

  return (
    <>
      <div className="mx-auto flex max-w-2xl flex-col gap-6 py-4 sm:py-6">
        <BackNav fallback="/" label={tc("backToVentrio")} />
        <PageHeader title={t("pageTitle")} description={intro} />
        <LegalSections sections={sections} />
        <p className="text-xs text-ink-muted">
          {t("lastUpdated")}
          <br />
          {tCommon("contactCta", { email: SUPPORT_EMAIL })}
        </p>
      </div>
      <div className="mx-auto w-[min(100%-2rem,1280px)]">
        <PublicFooter />
      </div>
    </>
  );
}
