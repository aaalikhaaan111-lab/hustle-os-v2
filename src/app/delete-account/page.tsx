import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { legalConfig } from "@/config/legal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.deleteAccount");
  return { title: t("pageTitle") };
}

export default async function DeleteAccountPage() {
  const t = await getTranslations("legal.deleteAccount");

  const intro = t("intro", { productName: legalConfig.productName });
  const howToBody = t("howTo.body", { contactEmail: legalConfig.contactEmail });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 py-4 sm:py-6">
      <PageHeader title={t("pageTitle")} description={intro} />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-base font-bold tracking-tight text-ink">{t("whatGetsDeleted.title")}</h2>
          <p className="text-sm leading-relaxed text-ink-secondary">{t("whatGetsDeleted.body")}</p>
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="text-base font-bold tracking-tight text-ink">{t("whatStays.title")}</h2>
          <p className="text-sm leading-relaxed text-ink-secondary">{t("whatStays.body")}</p>
        </div>
      </div>

      <Card className="max-w-md">
        <CardContent className="flex flex-col gap-3 py-6">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-ink-muted">
            {t("howTo.title")}
          </span>
          <p className="text-sm leading-relaxed text-ink-secondary">{howToBody}</p>
          <a
            href={`mailto:${legalConfig.contactEmail}?subject=${encodeURIComponent("Delete account")}`}
            className="text-base font-bold text-accent hover:text-accent-hover"
          >
            {legalConfig.contactEmail}
          </a>
        </CardContent>
      </Card>

      <p className="text-xs text-ink-muted">{t("limitationNote")}</p>

      <PublicFooter />
    </div>
  );
}
