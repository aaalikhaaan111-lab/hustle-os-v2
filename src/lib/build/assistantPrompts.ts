// Stage-aware starter prompts for the project assistant. These are optional
// shortcuts — the user can always type any project-related question freely.

export type AssistantPhase = "early" | "validation" | "building" | "pitch";

const VALIDATION_STAGES = new Set([
  "validation",
  "sources",
  "methodology",
  "data_collection",
  "participants",
  "feasibility",
  "existing_solutions",
  "market",
]);

const BUILDING_STAGES = new Set([
  "solution",
  "plan",
  "first_version",
  "format",
  "first_pieces",
  "content_angle",
  "public_value",
  "partners",
]);

const PITCH_STAGES = new Set([
  "pitch",
  "testing",
  "launch",
  "publishing",
  "presentation",
  "findings",
  "outreach",
  "pilot",
  "feedback_consistency",
]);

export function assistantPhase(stage: string | null): AssistantPhase {
  if (!stage) return "early";
  if (VALIDATION_STAGES.has(stage)) return "validation";
  if (BUILDING_STAGES.has(stage)) return "building";
  if (PITCH_STAGES.has(stage)) return "pitch";
  return "early";
}

// Message keys in the build namespace; the label doubles as the message sent.
export const STARTER_PROMPT_KEYS: Record<AssistantPhase, string[]> = {
  early: ["starterClarifyProblem", "starterWhoToTalk", "starterChallengeIdea", "starterWhatNext"],
  validation: [
    "starterInterviewQs",
    "starterReviewEvidence",
    "starterTestAssumption",
    "starterInterpretFeedback",
  ],
  building: ["starterFirstVersion", "starterLeaveOut", "starterReviewPlan", "starterChooseTool"],
  pitch: ["starterImprovePitch", "starterJudgeQs", "starterWeakClaims", "starterExplainClearly"],
};
