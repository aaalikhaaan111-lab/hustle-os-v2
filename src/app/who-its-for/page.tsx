import { getTranslations } from "next-intl/server";
import { InfoLayout } from "@/components/info/InfoLayout";

export default async function WhoItsForPage() {
  const t = await getTranslations("info");
  const groups = [
    { title: t("who1Title"), body: t("who1Body") },
    { title: t("who2Title"), body: t("who2Body") },
    { title: t("who3Title"), body: t("who3Body") },
    { title: t("who4Title"), body: t("who4Body") },
  ];
  return (
    <InfoLayout eyebrow={t("whoEyebrow")} title={t("whoTitle")}>
      <p className="text-[16px] leading-8 text-ink-secondary">{t("whoIntro")}</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {groups.map((group) => (
          <div key={group.title} className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="text-[15px] font-semibold text-ink">{group.title}</h2>
            <p className="mt-2 text-[14px] leading-6 text-ink-secondary">{group.body}</p>
          </div>
        ))}
      </div>
    </InfoLayout>
  );
}
