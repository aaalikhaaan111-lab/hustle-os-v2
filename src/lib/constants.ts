import type { ComponentType, SVGProps } from "react";
import {
  FinanceIcon,
  GrowthIcon,
  HomeIcon,
  OperationsIcon,
  ProductIcon,
  ProfileIcon,
  ResearchIcon,
  VenturesIcon,
} from "@/components/ui/icons";
import type { Department, VentureContextFieldConfig } from "@/types/venture";

export interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/", icon: HomeIcon },
  { label: "Ventures", href: "/ventures", icon: VenturesIcon },
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
