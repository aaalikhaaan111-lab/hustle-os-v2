import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

interface BuildProjectCardProps {
  hasProject: boolean;
  projectName?: string;
  progress?: number;
  nextTaskTitle?: string | null;
}

export async function BuildProjectCard({
  hasProject,
  projectName,
  progress = 0,
  nextTaskTitle,
}: BuildProjectCardProps) {
  const t = await getTranslations("dashboard");

  return (
    <Card>
      <CardContent className="flex h-full flex-col gap-6 py-9">
        <div className="flex items-center gap-4">
          <span className="text-4xl" role="img" aria-hidden>
            🛠️
          </span>
          <div className="flex flex-col gap-2">
            <span className="inline-flex w-fit items-center rounded-full bg-accent-soft px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-accent ring-1 ring-inset ring-accent/20">
              {t("buildTeaserBadge")}
            </span>
            <h3 className="text-xl font-extrabold leading-tight tracking-[-0.02em] text-ink">
              {hasProject ? projectName || t("untitledProject") : t("buildTeaserTitle")}
            </h3>
          </div>
        </div>

        {hasProject ? (
          <>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-bold tracking-wide text-ink-secondary">
                <span>{nextTaskTitle ? t("buildNextTask", { title: nextTaskTitle }) : t("buildAllTasksDone")}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-inset ring-white/10 backdrop-blur-sm">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-all duration-700 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <Button href="/build/workspace" className="mt-auto w-fit">
              {t("continueProject")}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm tracking-tight text-ink-secondary">{t("buildTeaserBody")}</p>
            <Button href="/build" variant="secondary" className="mt-auto w-fit">
              {t("buildStartCta")}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
