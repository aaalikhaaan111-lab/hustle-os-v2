import { CHALLENGE_CATALOG, DIFFICULTY_ORDER, type ChallengeDef } from "@/lib/challenges";
import type { ChallengeCompletion } from "@/lib/game-progress/GameProgressContext";

export type Dimension = "depth" | "feasibility" | "risk";

export interface QuestRecommendation {
  quest: ChallengeDef;
  weakDimension: Dimension | null;
  weakDimensionScore: number | null;
}

export function recommendNextQuest(completions: ChallengeCompletion[]): QuestRecommendation | null {
  const completedIds = new Set(completions.map((c) => c.challengeId));
  const remaining = CHALLENGE_CATALOG.filter((quest) => !completedIds.has(quest.id));
  if (remaining.length === 0) return null;

  let weakDimension: Dimension | null = null;
  let weakScore: number | null = null;

  const scored = completions.filter((c) => c.score);
  if (scored.length > 0) {
    const totals = { depth: 0, feasibility: 0, risk: 0 };
    for (const completion of scored) {
      totals.depth += completion.score!.depth;
      totals.feasibility += completion.score!.feasibility;
      totals.risk += completion.score!.risk;
    }
    const averages: Record<Dimension, number> = {
      depth: totals.depth / scored.length,
      feasibility: totals.feasibility / scored.length,
      risk: totals.risk / scored.length,
    };
    const entries = (Object.entries(averages) as [Dimension, number][]).sort(
      (a, b) => a[1] - b[1]
    );
    weakDimension = entries[0][0];
    weakScore = Math.round(entries[0][1] * 10) / 10;
  }

  const targetTierIndex = Math.min(
    Math.floor(completions.length / 6),
    DIFFICULTY_ORDER.length - 1
  );
  const targetTier = DIFFICULTY_ORDER[targetTierIndex];
  const byTier = remaining.filter((quest) => quest.difficulty === targetTier);
  const quest = byTier[0] ?? remaining[0];

  return {
    quest,
    weakDimension,
    weakDimensionScore: weakScore,
  };
}
