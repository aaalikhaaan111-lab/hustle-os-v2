import { getTranslations } from "next-intl/server";
import { InfoLayout } from "@/components/info/InfoLayout";

export default async function AboutPage() {
  const t = await getTranslations("info");
  return (
    <InfoLayout eyebrow={t("aboutEyebrow")} title={t("aboutTitle")}>
      <div className="flex flex-col gap-5 text-[16px] leading-8 text-ink-secondary">
        <p>{t("aboutP1")}</p>
        <p>{t("aboutP2")}</p>
        <p>{t("aboutP3")}</p>
      </div>
    </InfoLayout>
  );
}
