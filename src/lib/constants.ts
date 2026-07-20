import type { ComponentType, SVGProps } from "react";
import {
  BuildIcon,
  CoursesIcon,
  DashboardIcon,
  ProfileIcon,
  WorkshopsIcon,
} from "@/components/ui/icons";

export type NavLabelKey = "dashboard" | "challenges" | "learn" | "build" | "workshops" | "profile";

export interface NavItem {
  labelKey: NavLabelKey;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export type InterestLabelKey =
  | "interestEntrepreneurship"
  | "interestPersonalFinance"
  | "interestEconomics"
  | "interestBusinessSkills";

export interface InterestOption {
  id: string;
  labelKey: InterestLabelKey;
  emoji: string;
}

export const INTEREST_OPTIONS: InterestOption[] = [
  { id: "entrepreneurship", labelKey: "interestEntrepreneurship", emoji: "🚀" },
  { id: "personal-finance", labelKey: "interestPersonalFinance", emoji: "💰" },
  { id: "economics", labelKey: "interestEconomics", emoji: "📊" },
  { id: "business-skills", labelKey: "interestBusinessSkills", emoji: "🛠️" },
];

// The onboarding "What are you interested in?" answers are stored alongside the
// existing "what to improve" interests in the same `profiles.interests` array
// (no schema change), namespaced with this prefix so the two sets never collide
// and readers of the improve-interests can filter these out. These topic tags
// are collected only — they intentionally do NOT drive personalization.
export const TOPIC_INTEREST_PREFIX = "topic:";

export function isTopicInterest(id: string): boolean {
  return id.startsWith(TOPIC_INTEREST_PREFIX);
}

export type TopicLabelKey =
  | "topicBusiness"
  | "topicTechnology"
  | "topicContent"
  | "topicDesign"
  | "topicFinance"
  | "topicGaming"
  | "topicSports"
  | "topicEducation"
  | "topicOther";

export interface TopicOption {
  id: string;
  labelKey: TopicLabelKey;
  emoji: string;
}

export const TOPIC_OPTIONS: TopicOption[] = [
  { id: "business", labelKey: "topicBusiness", emoji: "💼" },
  { id: "technology", labelKey: "topicTechnology", emoji: "💻" },
  { id: "content", labelKey: "topicContent", emoji: "🎬" },
  { id: "design", labelKey: "topicDesign", emoji: "🎨" },
  { id: "finance", labelKey: "topicFinance", emoji: "📈" },
  { id: "gaming", labelKey: "topicGaming", emoji: "🎮" },
  { id: "sports", labelKey: "topicSports", emoji: "⚽" },
  { id: "education", labelKey: "topicEducation", emoji: "📚" },
  { id: "other", labelKey: "topicOther", emoji: "✨" },
];

// Challenges is intentionally not a top-level destination anymore — it lives
// as a tab inside Learn (/courses?tab=challenges). Build is the primary loop
// and sits centrally right after Learn.
export const NAV_ITEMS: NavItem[] = [
  { labelKey: "dashboard", href: "/dashboard", icon: DashboardIcon },
  { labelKey: "learn", href: "/courses", icon: CoursesIcon },
  { labelKey: "build", href: "/build", icon: BuildIcon },
  { labelKey: "workshops", href: "/workshops", icon: WorkshopsIcon },
  { labelKey: "profile", href: "/profile", icon: ProfileIcon },
];
