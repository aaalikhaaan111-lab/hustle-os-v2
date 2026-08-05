import type { SupabaseClient } from "@supabase/supabase-js";
import { getTranslations } from "next-intl/server";
import type { Database } from "@/types/supabase";
import { parseSnapshotFields } from "@/lib/build/snapshot";
import { loadProjectAssistant } from "@/lib/actions/assistant";
import type { WorkspaceViewProps } from "@/components/build/WorkspaceView";
import { parseStage3ProjectState } from "@/lib/build/stage3Types";
import { isLocale, DEFAULT_LOCALE } from "@/i18n/locale";
import { loadProjectPublicationState } from "@/lib/publishing/queries";
import { getSiteUrl } from "@/lib/site";

type Client = SupabaseClient<Database>;
type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];

/**
 * Assembles every prop the workspace needs for one project.
 *
 * The caller has already resolved and ownership-checked the project, so every
 * read below is scoped to that exact project.id.
 *
 * This used to also load roadmap tasks, task outputs and proof counts from the
 * retired educational product's tables. None of it reached the screen — the
 * workspace renders either the pre-output conversation or the chat-and-preview
 * surface, and neither has ever drawn a roadmap — so those were three round
 * trips per page load spent assembling props nothing read. Removing them takes
 * the current product's last runtime dependency on those tables with them.
 */
export async function buildWorkspaceViewProps(
  supabase: Client,
  project: ProjectRow,
  /** Conversation named by the URL, so a reload reopens it rather than the latest. */
  requestedConversationId?: string | null
): Promise<Omit<WorkspaceViewProps, "usage">> {
  const [assistant, publication] = await Promise.all([
    loadProjectAssistant(project.id, requestedConversationId),
    loadProjectPublicationState(supabase, project.id, project.user_id),
  ]);

  // Scoped to the PROJECT's language, not the request's. The workspace renders
  // in the project's locale, so a greeting built from the account cookie
  // arrived in the wrong language and sat there beside Russian answers.
  const projectLocale = isLocale(project.locale) ? project.locale : DEFAULT_LOCALE;
  const t = await getTranslations({ locale: projectLocale, namespace: "build" });

  const projectName = project.name || t("untitledProject");
  const savedFields = parseSnapshotFields(project.snapshot_fields);
  const stage3 = parseStage3ProjectState(project.snapshot_fields);

  /**
   * True for projects created by the current AI flow, which is what decides
   * whether the workspace opens on the pre-output conversation.
   *
   * The old test began with "has no roadmap tasks". That clause is gone, and
   * deliberately not replaced with a stage-3 check: the three remaining
   * conditions already separate the two generations of project exactly — no
   * project carrying roadmap tasks satisfies them — so the flag means the same
   * thing for every existing project as it did before, with one fewer table in
   * the answer. Reading `stage3.output` here instead would have quietly moved
   * finished projects onto a different surface.
   */
  const awaitingFirstVersion =
    project.current_stage === null &&
    project.progress === 0 &&
    project.intended_outcome === "first_version";

  // Deterministic, project-specific greeting for an empty conversation.
  const direction = savedFields.solution ?? null;
  const openingMessage = awaitingFirstVersion
    ? direction
      ? t("assistantCreatedGreeting", { name: projectName, direction })
      : t("assistantCreatedGreetingSimple", { name: projectName })
    : t("assistantOpeningDone", { name: projectName });

  return {
    projectId: project.id,
    projectName,
    projectConcept: savedFields.solution ?? null,
    projectAudience: savedFields.audience ?? project.target_audience ?? null,
    projectLocale,
    awaitingFirstVersion,
    savedFields,
    assistant: {
      available: assistant.available,
      conversationId: assistant.conversationId,
      messages: assistant.messages,
      phase: assistant.phase,
    },
    openingMessage,
    publication,
    publicBaseUrl: getSiteUrl(),
    stage3: {
      status: stage3?.status ?? null,
      direction: stage3?.direction ?? null,
      output: stage3?.output ?? null,
    },
  };
}
