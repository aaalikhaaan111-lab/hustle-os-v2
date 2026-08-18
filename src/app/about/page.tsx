import { getTranslations } from "next-intl/server";
import { PublicShell } from "@/components/public/PublicShell";
import { PublicPage } from "@/components/public/PublicPage";

export default async function AboutPage() {
  const t = await getTranslations("info");
  return (
    <PublicShell>
      <PublicPage eyebrow={t("aboutEyebrow")} title={t("aboutTitle")} narrow>
        <div className="lp-prose">
          <p>{t("aboutP1")}</p>
          <p>{t("aboutP2")}</p>
          <p>{t("aboutP3")}</p>
        </div>
      </PublicPage>
    </PublicShell>
  );
}
