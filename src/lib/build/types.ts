import type { Localized } from "@/i18n/content";

// ============================================================================
// Project creation input
// ============================================================================

export type ProjectType =
  | "digital_product"
  | "service"
  | "content_media"
  | "community_social"
  | "research"
  | "smart_city"
  | "physical_product"
  | "small_business";

export type ProjectTypeLabelKey =
  | "typeDigitalProduct"
  | "typeService"
  | "typeContentMedia"
  | "typeCommunitySocial"
  | "typeResearch"
  | "typeSmartCity"
  | "typePhysicalProduct"
  | "typeSmallBusiness";

export interface ProjectTypeOption {
  id: ProjectType;
  labelKey: ProjectTypeLabelKey;
  emoji: string;
  family: ProjectFamily;
}

// Deterministic pathway content is authored per "family" rather than per
// project type: AGENTS.md calls for different stage emphasis for
// software/commercial projects, content projects, community initiatives,
// research projects, and smart-city/social-impact projects, but the four
// commercial-ish types (digital product, service, physical product, small
// business) all need the same problem -> audience -> solution -> first
// version -> launch shape, just with different wording. New project types
// can be added later by mapping them onto an existing family, or by adding
// a new family's template set.
export type ProjectFamily = "commercial" | "content" | "community" | "research" | "smart_city";

export type StartingStage = "interest" | "problem" | "idea" | "building" | "early_version";

export type StartingStageLabelKey =
  | "startingInterest"
  | "startingProblem"
  | "startingIdea"
  | "startingBuilding"
  | "startingEarlyVersion";

export type IntendedOutcome =
  | "validate_idea"
  | "first_version"
  | "launch_publicly"
  | "run_event"
  | "complete_research"
  | "prepare_pitch";

export type IntendedOutcomeLabelKey =
  | "outcomeValidateIdea"
  | "outcomeFirstVersion"
  | "outcomeLaunchPublicly"
  | "outcomeRunEvent"
  | "outcomeCompleteResearch"
  | "outcomePreparePitch";

export type TimeAvailability = "under_2h" | "2_4h" | "5_7h" | "over_7h";

export type TimeAvailabilityLabelKey =
  | "timeUnder2h"
  | "time2to4h"
  | "time5to7h"
  | "timeOver7h";

export type PathwayMode = "standard" | "quick_sprint";

export type NicheLabelKey =
  | "nicheEducation"
  | "nicheTechnology"
  | "nicheFinance"
  | "nicheContent"
  | "nicheHealth"
  | "nicheGaming"
  | "nicheLocalCommunity"
  | "nicheSustainability"
  | "nicheSmartCities"
  | "nicheOther";

export interface NicheOption {
  id: string;
  labelKey: NicheLabelKey;
  emoji: string;
}

export interface ProjectCreationInput {
  name: string | null;
  projectType: ProjectType;
  niche: string;
  startingStage: StartingStage;
  targetAudience: string | null;
  intendedOutcome: IntendedOutcome;
  timeAvailability: TimeAvailability;
  pathwayMode: PathwayMode;
}

// ============================================================================
// Generated pathway
// ============================================================================

export interface GeneratedTask {
  templateId: string;
  stage: string;
  orderIndex: number;
  title: string;
  objective: string;
  whyItMatters: string;
  action: string;
  expectedOutput: string;
  estimatedTime: string;
  completionCriteria: string;
  outputKind: "text" | "longtext";
  xp: number;
  recommendedLessonId?: string;
}

// ============================================================================
// AI review of a task answer
// ============================================================================

export type TaskReviewStatus = "ready" | "needs_work";

export interface TaskReview {
  status: TaskReviewStatus;
  summary: string;
  strengths: string[];
  missingPoints: string[];
  nextImprovement: string;
  improvedExample?: string;
}

// ============================================================================
// Pitch / summary
// ============================================================================

export interface ProjectSummary {
  name: string;
  oneLiner: string;
  problem: string;
  audience: string;
  solution: string;
  whyItMatters: string;
  evidence: string;
  firstVersion: string;
  mainRisk: string;
  nextStep: string;
}

export interface ProjectPitch {
  problem: string;
  audience: string;
  solution: string;
  evidence: string;
  progress: string;
  nextStep: string;
  pitch30: string;
  pitch60: string;
  qaPrep: string[];
}

export interface TaskTemplate {
  id: string;
  stage: string;
  title: Localized;
  objective: Localized;
  whyItMatters: Localized;
  action: Localized;
  expectedOutput: Localized;
  estimatedTime: Localized;
  completionCriteria: Localized;
  outputKind: "text" | "longtext";
  xp: number;
  recommendedLessonId?: string;
}
