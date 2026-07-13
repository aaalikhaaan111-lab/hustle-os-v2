import type { ComponentType, SVGProps } from "react";
import {
  ChallengesIcon,
  CoursesIcon,
  DashboardIcon,
  FinanceIcon,
  GrowthIcon,
  OperationsIcon,
  ProductIcon,
  ProfileIcon,
  ResearchIcon,
  WorkshopsIcon,
} from "@/components/ui/icons";
import type { Department, VentureContextFieldConfig } from "@/types/venture";

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
  { label: "Courses", href: "/courses", icon: CoursesIcon },
  { label: "Workshops", href: "/workshops", icon: WorkshopsIcon },
  { label: "Profile", href: "/profile", icon: ProfileIcon },
];

export const DEPARTMENTS: Department[] = [
  {
    id: "research",
    name: "Research",
    description:
      "Validates the mission against real market signal before resources move.",
    icon: ResearchIcon,
  },
  {
    id: "product",
    name: "Product",
    description:
      "Turns validated direction into the smallest buildable version.",
    icon: ProductIcon,
  },
  {
    id: "growth",
    name: "Growth",
    description:
      "Designs how the right audience finds and adopts the first version.",
    icon: GrowthIcon,
  },
  {
    id: "finance",
    name: "Finance",
    description:
      "Keeps runway, budget, and unit economics grounded in reality.",
    icon: FinanceIcon,
  },
  {
    id: "operations",
    name: "Operations",
    description:
      "Coordinates execution across departments and keeps the venture moving.",
    icon: OperationsIcon,
  },
];

export const VENTURE_CONTEXT_FIELDS: VentureContextFieldConfig[] = [
  { id: "budget", label: "Budget", placeholder: "e.g. $5,000", type: "text" },
  { id: "deadline", label: "Deadline", placeholder: "", type: "date" },
  {
    id: "location",
    label: "Location",
    placeholder: "City, country, or remote",
    type: "text",
  },
  {
    id: "resources",
    label: "Resources",
    placeholder: "Time, skills, savings, network",
    type: "text",
  },
];

export const VENTURE_EXAMPLE_PROMPTS = [
  "Launch an affordable IELTS feedback service",
  "Help teenagers understand personal finance",
  "Turn my video editing skill into a business",
] as const;

export const VENTURE_DESCRIPTION_MIN_LENGTH = 12;

export const VENTURE_DESCRIPTION_MAX_LENGTH = 4000;
