"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChallengeConsole } from "@/components/challenges/ChallengeConsole";
import { useGameProgress } from "@/lib/game-progress/GameProgressContext";
import type { ChallengeDef } from "@/lib/challenges";

interface FirstSessionFlowProps {
  firstChallenge: ChallengeDef;
}

export function FirstSessionFlow({ firstChallenge }: FirstSessionFlowProps) {
  const router = useRouter();
  const { isReady, isChallengeCompleted } = useGameProgress();

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
        // The guided tour has already run (before this challenge was offered),
        // so closing here just returns the user to the dashboard.
        router.push("/dashboard");
      }}
    />
  );
}
