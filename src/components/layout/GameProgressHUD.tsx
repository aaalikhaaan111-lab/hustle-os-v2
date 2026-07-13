"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { useGameProgress } from "@/lib/game-progress/GameProgressContext";
import { cn } from "@/lib/utils";

export function GameProgressHUD({ className }: { className?: string }) {
  const { xp, streakDays, isReady } = useGameProgress();
  const [pulse, setPulse] = useState(false);
  const prevXpRef = useRef(xp);

  useEffect(() => {
    if (xp > prevXpRef.current) {
      setPulse(true);
      const timeout = setTimeout(() => setPulse(false), 500);
      prevXpRef.current = xp;
      return () => clearTimeout(timeout);
    }
    prevXpRef.current = xp;
  }, [xp]);

  if (!isReady) return null;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex items-center gap-1.5 rounded-full bg-gradient-to-tr from-orange-50 to-amber-50 px-3 py-1.5 text-sm font-bold text-orange-600 ring-1 ring-inset ring-orange-100">
        <span role="img" aria-hidden>
          🔥
        </span>
        <AnimatedNumber value={streakDays} />
      </div>
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-full bg-gradient-to-tr from-indigo-50 to-pink-50 px-3 py-1.5 text-sm font-bold text-indigo-600 ring-1 ring-inset ring-indigo-100 transition-transform duration-200 ease-out",
          pulse && "animate-pop-in"
        )}
      >
        <span role="img" aria-hidden>
          ✨
        </span>
        <AnimatedNumber value={xp} />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-400">
          XP
        </span>
      </div>
    </div>
  );
}
