import type { ComponentType, SVGProps } from "react";

export type DepartmentId =
  | "research"
  | "product"
  | "growth"
  | "finance"
  | "operations";

export interface Department {
  id: DepartmentId;
  name: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export interface VentureBrief {
  mission: string;
  targetAudience: string;
  location: string;
  deadline: string;
  budget: string;
  currency: string;
  resources: string;
  desiredFirstResult: string;
}
