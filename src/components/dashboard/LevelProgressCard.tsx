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
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent">
              {t("level")} {level.level}
            </span>
            <h3 className="text-2xl font-black tracking-[-0.02em] text-ink">{t(level.nameKey)}</h3>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-sm font-bold text-accent ring-1 ring-inset ring-accent/20">
            <span role="img" aria-hidden>
              ✨
            </span>
            <AnimatedNumber value={xp} /> XP
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <div className="h-4 w-full overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-inset ring-white/10 backdrop-blur-sm">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2 shadow-[0_0_12px_rgba(147,51,234,0.5)] transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs font-medium tracking-tight text-ink-muted">
            {nextLevel
              ? t("xpToNextLevel", {
                  xp: Math.max(nextLevel.floor - xp, 0),
                  level: t(nextLevel.nameKey),
                })
              : t("maxLevelReached")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
