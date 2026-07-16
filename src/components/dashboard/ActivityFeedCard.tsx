"use client";

import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/Card";
import { useGameProgress } from "@/lib/game-progress/GameProgressContext";

const DATE_LOCALE: Record<string, string> = { ru: "ru-RU", en: "en-US" };

export function ActivityFeedCard() {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const { completions, isReady } = useGameProgress();

  if (!isReady) return null;

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(DATE_LOCALE[locale] ?? "en-US", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const sorted = [...completions].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  );

  return (
    <Card>
      <CardContent className="flex flex-col gap-6 py-8">
        <h3 className="text-xl font-extrabold tracking-[-0.02em] text-ink">
          {t("activityFeedTitle")}
        </h3>

        {sorted.length === 0 ? (
          <p className="text-sm tracking-tight text-ink-secondary">{t("activityFeedEmpty")}</p>
        ) : (
          <ol className="flex flex-col gap-5">
            {sorted.map((item, index) => (
              <li key={`${item.challengeId}-${item.completedAt}`} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-pink-100 text-lg">
                    {item.emoji}
                  </span>
                  {index < sorted.length - 1 && (
                    <span className="mt-1 w-px flex-1 bg-zinc-200" aria-hidden />
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1.5 pb-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-ink">
                      {t("questCompleted", { title: item.title })}
                    </span>
                    {item.categoryLabel && (
                      <span className="inline-flex items-center rounded-full bg-gradient-to-tr from-indigo-50 to-pink-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-indigo-600 ring-1 ring-inset ring-indigo-100">
                        {item.categoryLabel}
                      </span>
                    )}
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-600 ring-1 ring-inset ring-amber-100">
                      +{item.xp} XP
                    </span>
                    {item.score && (
                      <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-600 ring-1 ring-inset ring-indigo-100">
                        {t("aiScore", { score: item.score.average })}
                      </span>
                    )}
                  </div>
                  <p className="text-xs tracking-tight text-ink-muted">
                    {formatDate(item.completedAt)}
                  </p>
                  {item.answer && (
                    <p className="rounded-xl bg-surface-hover px-3 py-2 text-sm tracking-tight text-ink-secondary">
                      {t("yourVerdict", { answer: item.answer })}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
