import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ChallengeZeroCard } from "@/components/dashboard/ChallengeZeroCard";
import { LevelProgressCard } from "@/components/dashboard/LevelProgressCard";
import { NextGoalCard } from "@/components/dashboard/NextGoalCard";
import { ActivityFeedCard } from "@/components/dashboard/ActivityFeedCard";
import { INTEREST_OPTIONS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex w-fit items-center rounded-full bg-gradient-to-tr from-indigo-50 to-pink-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600 shadow-[0_2px_12px_rgba(99,102,241,0.12)] ring-1 ring-inset ring-indigo-100">
      {children}
    </span>
  );
}

function interestLabels(interests: string[]): string {
  return interests
    .map((id) => INTEREST_OPTIONS.find((option) => option.id === id)?.label ?? id)
    .join(", ");
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("interests, daily_minutes")
    .eq("id", user.id)
    .maybeSingle();

  const interests = profile?.interests ?? [];
  const dailyMinutes = profile?.daily_minutes ?? null;

  const challengeSubtitle =
    interests.length > 0
      ? `Мы настроили трек под твои интересы: ${interestLabels(
          interests
        )}. Начни с быстрой разминки 👇`
      : "Начни с быстрой разминки, а мы тем временем настроим остальной трек под тебя 👇";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Dashboard"
        description="Здесь появляется твой ежедневный прогресс."
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <LevelProgressCard />
        <NextGoalCard />
      </div>

      <Card className="overflow-hidden">
        <CardContent>
          <ChallengeZeroCard subtitle={challengeSubtitle} />
        </CardContent>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardContent className="flex h-full flex-col gap-6 py-9">
            <div className="flex items-center gap-4">
              <span className="text-4xl" role="img" aria-hidden>
                📚
              </span>
              <div className="flex flex-col gap-2">
                <Eyebrow>Курс</Eyebrow>
                <h3 className="text-xl font-extrabold leading-tight tracking-[-0.02em] text-ink">
                  Скоро начнётся твой первый курс
                </h3>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-bold tracking-wide text-ink-secondary">
                <span>Прогресс</span>
                <span>0%</span>
              </div>
              <div className="h-4 w-full overflow-hidden rounded-full bg-zinc-900/[0.04] ring-1 ring-inset ring-white/60 backdrop-blur-sm">
                <div className="h-full w-0 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-[0_0_12px_rgba(147,51,234,0.5)]" />
              </div>
              {dailyMinutes !== null && (
                <p className="text-xs font-medium tracking-tight text-ink-muted">
                  Цель: {dailyMinutes} минут в день
                </p>
              )}
            </div>
            <Button href="/courses" variant="secondary" className="mt-auto w-fit">
              Смотреть курсы
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex h-full flex-col gap-6 py-9">
            <div className="flex items-center gap-4">
              <span className="text-4xl" role="img" aria-hidden>
                🗓️
              </span>
              <div className="flex flex-col gap-2">
                <Eyebrow>Воркшопы</Eyebrow>
                <h3 className="text-xl font-extrabold leading-tight tracking-[-0.02em] text-ink">
                  Пока нет запланированных встреч
                </h3>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-t-white/70 border-x-zinc-200/40 border-b-zinc-200/40 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-md">
              <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-pink-100">
                <span className="text-[9px] font-bold uppercase tracking-wide text-ink-muted">
                  Скоро
                </span>
                <span className="text-lg font-extrabold text-ink">?</span>
              </div>
              <p className="text-sm tracking-tight text-ink-secondary">
                Сообщим, как только появится первый воркшоп.
              </p>
            </div>
            <Button href="/workshops" variant="secondary" className="mt-auto w-fit">
              Все воркшопы
            </Button>
          </CardContent>
        </Card>
      </div>

      <ActivityFeedCard />
    </div>
  );
}
