import { redirect } from "next/navigation";
import dynamic from "next/dynamic";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { CreateSessionButton } from "@/components/workshops/CreateSessionButton";
import { JoinSessionForm } from "@/components/workshops/JoinSessionForm";
import { WORKSHOP_PACKS } from "@/lib/workshops";
import { pick } from "@/i18n/content";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";

// Deferred to its own chunk: the simulator isn't needed for the initial,
// above-the-fold join/host flow, so it shouldn't be part of that critical path.
const UnitEconomicsSimulator = dynamic(
  () =>
    import("@/components/workshops/UnitEconomicsSimulator").then(
      (mod) => mod.UnitEconomicsSimulator
    ),
  { loading: () => <SkeletonCard /> }
);

interface LockedWorkshopCardProps {
  emoji: string;
  title: string;
  description: string;
  comingSoonLabel: string;
}

function LockedWorkshopCard({ emoji, title, description, comingSoonLabel }: LockedWorkshopCardProps) {
  return (
    <Card className="pointer-events-none opacity-60 grayscale">
      <CardContent className="flex flex-col gap-4 py-8">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-hover text-2xl">
            {emoji}
          </span>
          <div className="flex flex-col gap-1">
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-surface-hover px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-muted">
              {comingSoonLabel}
            </span>
            <h3 className="text-lg font-extrabold leading-tight tracking-[-0.02em] text-ink">
              {title}
            </h3>
          </div>
        </div>
        <p className="text-sm tracking-tight text-ink-secondary">{description}</p>
      </CardContent>
    </Card>
  );
}

export default async function WorkshopsPage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const defaultDisplayName = profile?.display_name?.trim() || user.email?.split("@")[0] || "";

  const t = await getTranslations("workshops");
  const locale = await getLocale();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("title")} description={t("description")} />

      <div className="flex flex-col gap-4">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
          {t("liveQuizzesTitle")}
        </h2>
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[2fr_1fr] lg:items-start lg:gap-6">
          <Card className="order-1 border-accent/30 bg-accent-soft/40 lg:order-2">
            <CardContent className="flex flex-col gap-4 py-6">
              <h3 className="text-base font-extrabold leading-tight tracking-[-0.02em] text-ink">
                {t("joinTitle")}
              </h3>
              <JoinSessionForm defaultDisplayName={defaultDisplayName} />
            </CardContent>
          </Card>

          <p className="order-2 text-center text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted lg:hidden">
            {t("orCreateOwn")}
          </p>

          <div className="order-3 grid gap-4 sm:grid-cols-3 lg:order-1">
            {WORKSHOP_PACKS.map((pack) => (
              <Card key={pack.slug}>
                <CardContent className="flex h-full flex-col gap-3 py-6">
                  <span className="text-3xl">{pack.emoji}</span>
                  <h3 className="text-base font-extrabold leading-tight tracking-[-0.02em] text-ink">
                    {pick(pack.title, locale)}
                  </h3>
                  <p className="flex-1 text-xs tracking-tight text-ink-secondary">{pick(pack.description, locale)}</p>
                  <p className="text-[11px] font-semibold text-ink-muted">
                    {t("questionsCount", { count: pack.questions.length })}
                  </p>
                  <CreateSessionButton slug={pack.slug} />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <UnitEconomicsSimulator />

      <div className="grid gap-6 sm:grid-cols-2">
        <LockedWorkshopCard
          emoji="🎬"
          title={t("pitchDeckTitle")}
          description={t("pitchDeckDescription")}
          comingSoonLabel={t("comingSoon")}
        />
        <LockedWorkshopCard
          emoji="🧪"
          title={t("custdevTitle")}
          description={t("custdevDescription")}
          comingSoonLabel={t("comingSoon")}
        />
      </div>
    </div>
  );
}
