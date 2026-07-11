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

export type VentureContextFieldId = "budget" | "deadline" | "location" | "resources";

export interface VentureContextFieldConfig {
  id: VentureContextFieldId;
  label: string;
  placeholder: string;
  type: "text" | "date";
}

export interface VentureDraft {
  description: string;
  budget: string;
  deadline: string;
  location: string;
  resources: string;
  createdAt: string;
}
