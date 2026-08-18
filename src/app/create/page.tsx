import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { isLocale } from "@/i18n/locale";
import { clientMessages } from "@/i18n/clientMessages";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { CreateExperience } from "@/components/create/CreateExperience";
import { WorkspaceShell } from "@/components/workspace-ui/WorkspaceShell";
import { loadShellNav } from "@/lib/workspace/shellNav";
import { loadCreationDraftAction } from "@/lib/actions/creation";

interface CreatePageProps {
  searchParams: Promise<{ fresh?: string }>;
}

// The AI-first creation experience. /build/new redirects here so the retired
// questionnaire can no longer become a user's primary creation path.
// An unfinished Stage 3 creation session resumes from server persistence. A
// second project is only created after the user intentionally starts over.
export default async function CreatePage({ searchParams }: CreatePageProps) {
  // "New project" means a new project. Every entry point that says those words
  // links here with `?fresh=1`, and that is the whole fix for the reported bug:
  // the route used to resume the most recent unfinished creation session on
  // every visit, so pressing New project reopened the conversation you were
  // trying to leave. A bare /create still resumes, which is what makes a
  // refresh mid-conversation safe.
  const fresh = "fresh" in (await searchParams);
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    redirect("/login");
  }

  const initialDraft = fresh ? null : await loadCreationDraftAction();

  // The creation surface renders in the language of the conversation, not the
  // account cookie. Someone writing in Russian was getting Russian answers
  // between English buttons, because the chrome came from the root provider
  // while the assistant followed the project. The project workspace already
  // scopes its subtree this way; this is the same fix one screen earlier.
  const accountLocale = await getLocale();
  const locale = isLocale(initialDraft?.locale) ? initialDraft.locale : accountLocale;
  // Trimmed the same way the root provider is: this subtree is a second full
  // copy of the bundle in the same HTML, so the namespaces no client component
  // reads are dropped from both.
  const messages = clientMessages((await import(`../../../messages/${locale}.json`)).default);
  const nav = await loadShellNav(supabase, user.id, user.email);

  // Creation lives inside the one authenticated shell, so Overview, Projects
  // and Settings stay one click away and there is no second navigation on
  // screen. The rail starts compact: this surface is about the conversation.
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <WorkspaceShell initials={nav.initials} email={nav.email} recent={nav.recent} defaultCollapsed fill>
        <CreateExperience userId={user.id} initialDraft={initialDraft} fresh={fresh} />
      </WorkspaceShell>
    </NextIntlClientProvider>
  );
}
