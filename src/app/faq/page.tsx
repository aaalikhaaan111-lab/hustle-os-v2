import { getTranslations } from "next-intl/server";
import { InfoLayout } from "@/components/info/InfoLayout";

export default async function FaqPage() {
  const t = await getTranslations("info");
  const qa = [
    { q: t("faqQ1"), a: t("faqA1") },
    { q: t("faqQ2"), a: t("faqA2") },
    { q: t("faqQ3"), a: t("faqA3") },
    { q: t("faqQ4"), a: t("faqA4") },
    { q: t("faqQ5"), a: t("faqA5") },
  ];
  return (
    <InfoLayout eyebrow={t("faqEyebrow")} title={t("faqTitle")}>
      <div className="flex flex-col divide-y divide-border border-y border-border">
        {qa.map((item) => (
          <div key={item.q} className="py-5">
            <h2 className="text-[16px] font-semibold text-ink">{item.q}</h2>
            <p className="mt-2 text-[15px] leading-7 text-ink-secondary">{item.a}</p>
          </div>
        ))}
      </div>
    </InfoLayout>
  );
}
