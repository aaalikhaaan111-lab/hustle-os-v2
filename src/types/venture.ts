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

export interface VentureRecord {
  id: string;
  mission: string;
  budget: string | null;
  deadline: string | null;
  location: string | null;
  resources: string | null;
  status: string;
  created_at: string;
}

export interface CreateVentureInput {
  description: string;
  budget: string;
  deadline: string;
  location: string;
  resources: string;
}

export type ResearchConfidence = "low" | "medium" | "high";

export interface ResearchReport {
  executiveSummary: string;
  opportunities: string[];
  risks: string[];
  questions: string[];
  assumptions: string[];
  confidence: ResearchConfidence;
  confidenceRationale: string;
}
