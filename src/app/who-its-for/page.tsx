import { getTranslations } from "next-intl/server";
import { PublicShell } from "@/components/public/PublicShell";
import { PublicPage } from "@/components/public/PublicPage";

export default async function WhoItsForPage() {
  const t = await getTranslations("info");
  const groups = [1, 2, 3, 4].map((n) => ({
    title: t(`who${n}Title` as never),
    body: t(`who${n}Body` as never),
  }));

  return (
    <PublicShell>
      <PublicPage eyebrow={t("whoEyebrow")} title={t("whoTitle")} lede={t("whoIntro")}>
        <div className="lp-tiles">
          {groups.map((group) => (
            <div key={group.title} className="lp-tile">
              <h2>{group.title}</h2>
              <p>{group.body}</p>
            </div>
          ))}
        </div>
      </PublicPage>
    </PublicShell>
  );
}
