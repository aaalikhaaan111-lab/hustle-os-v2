import type { Locale } from "@/i18n/locale";
import type { Stage3ProjectOutput } from "@/lib/build/stage3Types";
import type { FeedbackAnalysisState } from "@/lib/feedback/types";

export interface ProjectResponseItem {
  id: string;
  payload: Record<string, string>;
  createdAt: string;
}

export interface ProjectPublicationState {
  slug: string;
  locale: Locale;
  output: Stage3ProjectOutput;
  isPublished: boolean;
  publishedAt: string;
  updatedAt: string;
  responseCount: number;
  recentResponses: ProjectResponseItem[];
  feedback: FeedbackAnalysisState;
}

export interface PublicProjectPublication {
  slug: string;
  locale: Locale;
  output: Stage3ProjectOutput;
  publishedAt: string;
  updatedAt: string;
}

export interface PublicationActionResult {
  error: string | null;
  publication: ProjectPublicationState | null;
  publicUrl: string | null;
  message: string | null;
}
