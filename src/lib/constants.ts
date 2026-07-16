import type { ComponentType, SVGProps } from "react";
import {
  ChallengesIcon,
  CoursesIcon,
  DashboardIcon,
  ProfileIcon,
  WorkshopsIcon,
} from "@/components/ui/icons";

export type NavLabelKey = "dashboard" | "challenges" | "learn" | "workshops" | "profile";

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

export const NAV_ITEMS: NavItem[] = [
  { labelKey: "dashboard", href: "/dashboard", icon: DashboardIcon },
  { labelKey: "challenges", href: "/challenges", icon: ChallengesIcon },
  { labelKey: "learn", href: "/courses", icon: CoursesIcon },
  { labelKey: "workshops", href: "/workshops", icon: WorkshopsIcon },
  { labelKey: "profile", href: "/profile", icon: ProfileIcon },
];
