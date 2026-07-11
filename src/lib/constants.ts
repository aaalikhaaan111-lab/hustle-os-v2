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
import type { Department } from "@/types/venture";

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

export const CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "KZT",
  "AED",
  "INR",
  "NGN",
  "BRL",
  "JPY",
  "CAD",
  "AUD",
  "SGD",
] as const;
