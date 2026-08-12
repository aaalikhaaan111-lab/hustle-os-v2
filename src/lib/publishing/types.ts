import type { Locale } from "@/i18n/locale";
import type { Stage3ProjectOutput } from "@/lib/build/stage3Types";
import type { GeneratedAppV1 } from "@/lib/v2/app/contract";
import type { FeedbackAnalysisState } from "@/lib/feedback/types";

export interface ProjectResponseItem {
  id: string;
  payload: Record<string, string>;
  createdAt: string;
}

export interface ProjectPublicationState {
  slug: string;
  locale: Locale;
  /**
   * The published artifact, in whichever form the project has.
   *
   * A project built by the app runtime has an application and no page artifact,
   * and one built by the fixed renderer has the reverse. Exactly one of these is
   * ever set; both being null is not a publication and is filtered out before a
   * state is constructed.
   */
  output: Stage3ProjectOutput | null;
  app: GeneratedAppV1 | null;
  /** The published name, from whichever artifact this publication holds. */
  name: string;
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
  output: Stage3ProjectOutput | null;
  app: GeneratedAppV1 | null;
  name: string;
  description: string;
  publishedAt: string;
  updatedAt: string;
}

export interface PublicationActionResult {
  error: string | null;
  publication: ProjectPublicationState | null;
  publicUrl: string | null;
  message: string | null;
}
