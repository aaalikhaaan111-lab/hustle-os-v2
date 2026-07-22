import type { ComponentType, SVGProps } from "react";
import {
  DashboardIcon,
  PlusIcon,
  ProfileIcon,
} from "@/components/ui/icons";

export type NavLabelKey =
  | "create"
  | "projects"
  | "dashboard"
  | "challenges"
  | "learn"
  | "build"
  | "workshops"
  | "profile";

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

// Primary navigation is deliberately just three destinations: Create, Projects,
// Profile. Create starts a new project inside the AI experience; Projects is
// everything the user is building; Profile is their portfolio. Everything else
// (Home/Dashboard, Learn/courses, Challenges, Play/Workshops, Build) is removed
// from primary nav but kept reachable/redirected for backward compatibility.
export const NAV_ITEMS: NavItem[] = [
  { labelKey: "create", href: "/create", icon: PlusIcon },
  { labelKey: "projects", href: "/projects", icon: DashboardIcon },
  { labelKey: "profile", href: "/profile", icon: ProfileIcon },
];
