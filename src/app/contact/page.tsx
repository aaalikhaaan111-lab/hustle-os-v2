import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { legalConfig } from "@/config/legal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.contact");
  return { title: t("pageTitle") };
}

export default async function ContactPage() {
  const t = await getTranslations("legal.contact");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 py-4 sm:py-6">
      <PageHeader title={t("pageTitle")} description={t("intro")} />
      <Card className="max-w-md">
        <CardContent className="flex flex-col gap-2 py-6">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-ink-muted">
            {t("emailLabel")}
          </span>
          <a
            href={`mailto:${legalConfig.contactEmail}`}
            className="text-lg font-bold text-accent hover:text-accent-hover"
          >
            {legalConfig.contactEmail}
          </a>
          <p className="mt-2 text-sm text-ink-secondary">{t("responseNote")}</p>
        </CardContent>
      </Card>
      <PublicFooter />
    </div>
  );
}
