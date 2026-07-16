"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/Card";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { useGameProgress } from "@/lib/game-progress/GameProgressContext";
import { getLevelInfo, LEVELS } from "@/lib/game-progress/levels";

export function LevelProgressCard() {
  const t = useTranslations("dashboard");
  const { xp, isReady } = useGameProgress();

  if (!isReady) return null;

  const level = getLevelInfo(xp);
  const nextLevel = LEVELS.find((entry) => entry.level === level.level + 1);
  const progress =
    level.ceiling === null
      ? 100
      : Math.min(100, Math.round(((xp - level.floor) / (level.ceiling - level.floor)) * 100));

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 py-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600">
              {t("level")} {level.level}
            </span>
            <h3 className="text-2xl font-black tracking-[-0.02em] text-ink">{level.name}</h3>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-tr from-indigo-50 to-pink-50 px-3 py-1.5 text-sm font-bold text-indigo-600 ring-1 ring-inset ring-indigo-100">
            <span role="img" aria-hidden>
              ✨
            </span>
            <AnimatedNumber value={xp} /> XP
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <div className="h-4 w-full overflow-hidden rounded-full bg-zinc-900/[0.04] ring-1 ring-inset ring-white/60 backdrop-blur-sm">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-[0_0_12px_rgba(147,51,234,0.5)] transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs font-medium tracking-tight text-ink-muted">
            {nextLevel
              ? t("xpToNextLevel", {
                  xp: Math.max(nextLevel.floor - xp, 0),
                  level: nextLevel.name,
                })
              : t("maxLevelReached")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
