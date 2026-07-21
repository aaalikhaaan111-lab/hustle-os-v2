import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { getCurrentProject } from "@/lib/build/queries";

const JOURNEY_STEPS = [
  "journeyInterest",
  "journeyProblem",
  "journeyIdea",
  "journeyValidation",
  "journeyFirstVersion",
  "journeyTesting",
  "journeyLaunch",
  "journeyPitch",
] as const;

export default async function BuildLandingPage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    redirect("/login");
  }

  const project = await getCurrentProject(supabase, user.id);
  if (project) {
    redirect("/build/workspace");
  }

  const t = await getTranslations("build");

  return (
    <div className="flex flex-col gap-10">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 py-6 text-center">
        <span className="inline-flex w-fit items-center rounded-full bg-accent-soft px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-accent shadow-[0_2px_12px_rgba(99,102,241,0.12)] ring-1 ring-inset ring-accent/20">
          {t("landingEyebrow")}
        </span>
        <h1 className="text-[2rem] font-black leading-[1.08] tracking-[-0.02em] text-ink sm:text-4xl md:text-5xl">
          {t("landingTitle")}
        </h1>
        <p className="max-w-lg text-sm leading-relaxed tracking-tight text-ink-secondary sm:text-base">
          {t("landingSubtitle")}
        </p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <Button href="/build/new" size="lg">
            {t("startProject")}
          </Button>
          <Button href="/build/new?mode=quick_sprint" size="lg" variant="secondary">
            {t("startQuickSprint")}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-5 py-8">
          <h2 className="text-center text-sm font-bold uppercase tracking-[0.14em] text-ink-muted">
            {t("journeyTitle")}
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {JOURNEY_STEPS.map((key, index) => (
              <div key={key} className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-border bg-surface/60 px-3 py-1.5 text-xs font-semibold text-ink-secondary shadow-sm backdrop-blur-md">
                  {t(key)}
                </span>
                {index < JOURNEY_STEPS.length - 1 && (
                  <span className="text-ink-muted" aria-hidden>
                    →
                  </span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
