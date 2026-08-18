import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PublicShell } from "@/components/public/PublicShell";
import { PublicPage } from "@/components/public/PublicPage";
import { LegalSections } from "@/components/legal/LegalSections";
import { legalConfig } from "@/config/legal";

/**
 * The refund policy, published because Paddle requires one to verify a seller.
 *
 * Built from the same pieces as every other public page — `PublicShell`,
 * `PublicPage`, `LegalSections` — so it inherits the header, the measure, the
 * type scale and the footer without introducing another way to lay out a
 * document.
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

  const intro = t("intro", { productName: legalConfig.productName });

  const sections = (t.raw("sections") as { title: string; body: string }[]).map((section) => ({
    title: section.title,
    body: section.body
      .replaceAll("{productName}", legalConfig.productName)
      .replaceAll("{supportEmail}", SUPPORT_EMAIL),
  }));

  return (
    <PublicShell>
      <PublicPage title={t("pageTitle")} lede={intro} narrow>
        <LegalSections sections={sections} />
        <p className="lp-legal-foot">
          {t("lastUpdated")}
          <br />
          {tCommon("contactCta", { email: SUPPORT_EMAIL })}
        </p>
      </PublicPage>
    </PublicShell>
  );
}
