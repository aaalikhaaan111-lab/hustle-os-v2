"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChallengeConsole } from "@/components/challenges/ChallengeConsole";
import { useGameProgress } from "@/lib/game-progress/GameProgressContext";
import { startTour } from "@/lib/tour/tourStorage";
import type { ChallengeDef } from "@/lib/challenges";

interface FirstSessionFlowProps {
  firstChallenge: ChallengeDef;
}

export function FirstSessionFlow({ firstChallenge }: FirstSessionFlowProps) {
  const router = useRouter();
  const { isReady, isChallengeCompleted, userId } = useGameProgress();

  // If this user already completed the seed challenge (e.g. they refreshed
  // after finishing, or navigated back here), don't replay it — just send
  // them on to the dashboard. This must only run once, against the state as
  // it was when the page mounted: completing the challenge during this very
  // render also makes the condition true, and a reactive check would yank
  // the user away mid-completion.
  const hasCheckedReplayRef = useRef(false);
  useEffect(() => {
    if (!isReady || hasCheckedReplayRef.current) return;
    hasCheckedReplayRef.current = true;
    if (isChallengeCompleted(firstChallenge.id)) {
      router.replace("/dashboard");
    }
  }, [isReady, isChallengeCompleted, firstChallenge.id, router]);

  if (!isReady) return null;

  return (
    <ChallengeConsole
      challenge={firstChallenge}
      skipValidation
      onClose={() => {
        // Only kick off the guided tour if the challenge actually completed
        // (the user might close early via Escape/backdrop click) — ProductTour
        // (mounted globally) picks this up on its own next render.
        if (isChallengeCompleted(firstChallenge.id) && userId) {
          startTour(userId);
        }
        router.push("/dashboard");
      }}
    />
  );
}
