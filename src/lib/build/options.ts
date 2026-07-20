import type {
  IntendedOutcome,
  IntendedOutcomeLabelKey,
  NicheOption,
  ProjectFamily,
  ProjectTypeOption,
  StartingStage,
  StartingStageLabelKey,
  TimeAvailability,
  TimeAvailabilityLabelKey,
} from "@/lib/build/types";

export const PROJECT_TYPE_OPTIONS: ProjectTypeOption[] = [
  { id: "digital_product", labelKey: "typeDigitalProduct", emoji: "💻", family: "commercial" },
  { id: "service", labelKey: "typeService", emoji: "🛠️", family: "commercial" },
  { id: "content_media", labelKey: "typeContentMedia", emoji: "🎬", family: "content" },
  { id: "community_social", labelKey: "typeCommunitySocial", emoji: "🤝", family: "community" },
  { id: "research", labelKey: "typeResearch", emoji: "🔬", family: "research" },
  { id: "smart_city", labelKey: "typeSmartCity", emoji: "🏙️", family: "smart_city" },
  { id: "physical_product", labelKey: "typePhysicalProduct", emoji: "📦", family: "commercial" },
  { id: "small_business", labelKey: "typeSmallBusiness", emoji: "🏪", family: "commercial" },
];

export function familyForProjectType(projectType: string): ProjectFamily {
  return (
    PROJECT_TYPE_OPTIONS.find((option) => option.id === projectType)?.family ?? "commercial"
  );
}

export const NICHE_OPTIONS: NicheOption[] = [
  { id: "education", labelKey: "nicheEducation", emoji: "📚" },
  { id: "technology", labelKey: "nicheTechnology", emoji: "💻" },
  { id: "finance", labelKey: "nicheFinance", emoji: "📈" },
  { id: "content", labelKey: "nicheContent", emoji: "🎥" },
  { id: "health", labelKey: "nicheHealth", emoji: "🩺" },
  { id: "gaming", labelKey: "nicheGaming", emoji: "🎮" },
  { id: "local_community", labelKey: "nicheLocalCommunity", emoji: "🏘️" },
  { id: "sustainability", labelKey: "nicheSustainability", emoji: "🌱" },
  { id: "smart_cities", labelKey: "nicheSmartCities", emoji: "🏙️" },
  { id: "other", labelKey: "nicheOther", emoji: "✨" },
];

export const STARTING_STAGE_OPTIONS: { id: StartingStage; labelKey: StartingStageLabelKey }[] = [
  { id: "interest", labelKey: "startingInterest" },
  { id: "problem", labelKey: "startingProblem" },
  { id: "idea", labelKey: "startingIdea" },
  { id: "building", labelKey: "startingBuilding" },
  { id: "early_version", labelKey: "startingEarlyVersion" },
];

export const INTENDED_OUTCOME_OPTIONS: { id: IntendedOutcome; labelKey: IntendedOutcomeLabelKey }[] = [
  { id: "validate_idea", labelKey: "outcomeValidateIdea" },
  { id: "first_version", labelKey: "outcomeFirstVersion" },
  { id: "launch_publicly", labelKey: "outcomeLaunchPublicly" },
  { id: "run_event", labelKey: "outcomeRunEvent" },
  { id: "complete_research", labelKey: "outcomeCompleteResearch" },
  { id: "prepare_pitch", labelKey: "outcomePreparePitch" },
];

export const TIME_AVAILABILITY_OPTIONS: { id: TimeAvailability; labelKey: TimeAvailabilityLabelKey }[] = [
  { id: "under_2h", labelKey: "timeUnder2h" },
  { id: "2_4h", labelKey: "time2to4h" },
  { id: "5_7h", labelKey: "time5to7h" },
  { id: "over_7h", labelKey: "timeOver7h" },
];
