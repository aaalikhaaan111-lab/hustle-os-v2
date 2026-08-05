import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { isLocale } from "@/i18n/locale";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { CreateExperience } from "@/components/create/CreateExperience";
import { WorkspaceShell } from "@/components/workspace-ui/WorkspaceShell";
import { loadCreationDraftAction } from "@/lib/actions/creation";

// The AI-first creation experience. /build/new redirects here so the retired
// questionnaire can no longer become a user's primary creation path.
// An unfinished Stage 3 creation session resumes from server persistence. A
// second project is only created after the user intentionally starts over.
export default async function CreatePage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    redirect("/login");
  }

  const initialDraft = await loadCreationDraftAction();

  // The creation surface renders in the language of the conversation, not the
  // account cookie. Someone writing in Russian was getting Russian answers
  // between English buttons, because the chrome came from the root provider
  // while the assistant followed the project. The project workspace already
  // scopes its subtree this way; this is the same fix one screen earlier.
  const accountLocale = await getLocale();
  const locale = isLocale(initialDraft?.locale) ? initialDraft.locale : accountLocale;
  const messages = (await import(`../../../messages/${locale}.json`)).default;

  // Creation lives inside the one authenticated shell, so Overview, Projects
  // and Settings stay one click away and there is no second navigation on
  // screen. The rail starts compact: this surface is about the conversation.
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <WorkspaceShell initials={(user.email ?? "?").slice(0, 2).toUpperCase()} defaultCollapsed fill>
        <CreateExperience userId={user.id} initialDraft={initialDraft} />
      </WorkspaceShell>
    </NextIntlClientProvider>
  );
}
