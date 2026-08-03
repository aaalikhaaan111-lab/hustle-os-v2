import type { ComponentType, SVGProps } from "react";
import {
  DashboardIcon,
  PlusIcon,
  ProfileIcon,
} from "@/components/ui/icons";

export type NavLabelKey = "create" | "projects" | "profile";

export interface NavItem {
  labelKey: NavLabelKey;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

// Primary navigation is deliberately just three destinations: Create, Projects,
// Profile. Create starts a new project inside the AI experience; Projects is
// everything the user is building; Profile is their portfolio.
export const NAV_ITEMS: NavItem[] = [
  { labelKey: "create", href: "/create", icon: PlusIcon },
  { labelKey: "projects", href: "/projects", icon: DashboardIcon },
  { labelKey: "profile", href: "/profile", icon: ProfileIcon },
];
