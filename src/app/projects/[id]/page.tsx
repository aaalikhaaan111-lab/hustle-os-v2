import { notFound, redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { getProjectById } from "@/lib/build/queries";
import { buildWorkspaceViewProps } from "@/lib/build/workspaceProps";
import { loadWorkspaceUsage } from "@/lib/workspace/usage";
import { WorkspaceShell } from "@/components/workspace-ui/WorkspaceShell";
import { WorkspaceView } from "@/components/build/WorkspaceView";

interface ProjectWorkspacePageProps {
  params: Promise<{ id: string }>;
  /** `?c=` names the conversation to open; absent, the latest one opens. */
  searchParams: Promise<{ c?: string }>;
}

// The canonical, id-scoped project workspace. The project is resolved by its
// explicit id and ownership-checked; every read and mutation inside the
// workspace is scoped to this same project. Pitch is intentionally not passed
// (retired from the multi-project surface), which hides the pitch menu.
export default async function ProjectWorkspacePage({ params, searchParams }: ProjectWorkspacePageProps) {
  const { id } = await params;
  const { c: requestedConversationId } = await searchParams;
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    redirect("/login");
  }

  const project = await getProjectById(supabase, user.id, id);
  if (!project) {
    notFound();
  }

  const [props, usage] = await Promise.all([
    buildWorkspaceViewProps(supabase, project, requestedConversationId),
    loadWorkspaceUsage(supabase, user.id),
  ]);

  const published = Boolean(props.publication?.isPublished);

  // The workspace renders in the PROJECT's language, not the browser's.
  //
  // The assistant already replies in `project.locale`, so without this a person
  // whose interface cookie disagreed with their project saw Russian answers
  // beside English controls. An earlier fix moved one variable and only
  // corrected the voice-input language — every visible label still came from
  // the root provider. Re-scoping the subtree is what actually fixes it, and it
  // fixes the whole workspace at once rather than one label at a time.
  const workspaceMessages = (await import(`../../../../messages/${props.projectLocale}.json`)).default;

  // The shell is new; what it wraps is the same WorkspaceView with the same
  // assistant, publication and stage-3 props it already received.
  return (
    <NextIntlClientProvider locale={props.projectLocale} messages={workspaceMessages}>
    <WorkspaceShell
      initials={(user.email ?? "?").slice(0, 2).toUpperCase()}
      project={{ id: project.id, name: props.projectName, state: published ? "published" : "draft" }}
      defaultCollapsed
      fill
    >
      <WorkspaceView {...props} usage={usage} />
    </WorkspaceShell>
  </NextIntlClientProvider>
  );
}
