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
 * Two values are page-local rather than read from `legalConfig`:
 *
 * `SUPPORT_EMAIL` is the billing address, and it is deliberately not
 * `legalConfig.contactEmail` (founder@). Refunds go to a mailbox that can stay
 * answered as volume grows, and Paddle checks that the address on this page
 * actually receives mail.
 *
 * `LAST_UPDATED` is this document's own date. The shared `effectiveDate` covers
 * the policies that shipped together on 2026-08-13; this one arrived later and
 * says so rather than backdating itself.
 */
const SUPPORT_EMAIL = "support@ventrio.org";
const LAST_UPDATED = "2026-08-14";

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
          {tCommon("lastUpdated", { date: LAST_UPDATED })}
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
