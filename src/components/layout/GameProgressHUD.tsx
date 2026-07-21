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
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className="flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 text-[13px] font-bold text-warning ring-1 ring-inset ring-warning/20">
        <span role="img" aria-hidden>
          🔥
        </span>
        <AnimatedNumber value={streakDays} />
      </div>
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[13px] font-bold text-accent ring-1 ring-inset ring-accent/20 transition-transform duration-200 ease-out",
          pulse && "animate-pop-in"
        )}
      >
        <span role="img" aria-hidden>
          ✨
        </span>
        <AnimatedNumber value={xp} />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-accent/70">
          XP
        </span>
      </div>
    </div>
  );
}
