import type { ComponentType, SVGProps } from "react";
import {
  ChallengesIcon,
  CoursesIcon,
  DashboardIcon,
  ProfileIcon,
  WorkshopsIcon,
} from "@/components/ui/icons";

export interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export interface InterestOption {
  id: string;
  label: string;
  emoji: string;
}

export const INTEREST_OPTIONS: InterestOption[] = [
  { id: "entrepreneurship", label: "Предпринимательство", emoji: "🚀" },
  { id: "personal-finance", label: "Личные финансы", emoji: "💰" },
  { id: "economics", label: "Экономика", emoji: "📊" },
  { id: "business-skills", label: "Бизнес-навыки", emoji: "🛠️" },
];

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: DashboardIcon },
  { label: "Challenges", href: "/challenges", icon: ChallengesIcon },
  { label: "Learn", href: "/courses", icon: CoursesIcon },
  { label: "Workshops", href: "/workshops", icon: WorkshopsIcon },
  { label: "Profile", href: "/profile", icon: ProfileIcon },
];
