import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { WorkshopSession } from "@/components/workshops/WorkshopSession";
import { JoinSessionForm } from "@/components/workshops/JoinSessionForm";
import { getWorkshopSessionStateAction } from "@/lib/actions/workshops";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";

interface WorkshopSessionPageProps {
  params: Promise<{ code: string }>;
}

export default async function WorkshopSessionPage({ params }: WorkshopSessionPageProps) {
  const { code } = await params;
  const supabase = await createClient();

  // Independent of each other — getCurrentUser is just this page's own
  // redirect guard, while getWorkshopSessionStateAction runs its own
  // internal auth check regardless — so they run concurrently instead of
  // one blocking the other.
  const [user, { data: state }] = await Promise.all([
    getCurrentUser(supabase),
    getWorkshopSessionStateAction(code),
  ]);

  if (!user) {
    redirect("/login");
  }

  const t = await getTranslations("workshops");

  if (!state) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title={t("workshopTitle")} />
        <EmptyState
          icon={<span className="text-2xl">🔍</span>}
          title={t("sessionNotFoundTitle")}
          description={t("sessionNotFoundDescription", { code: code.toUpperCase() })}
          action={<Button href="/workshops">{t("backToWorkshops")}</Button>}
        />
      </div>
    );
  }

  if (!state.myParticipantId) {
    if (state.status !== "lobby") {
      return (
        <div className="flex flex-col gap-8">
          <PageHeader title={t("workshopTitle")} />
          <EmptyState
            icon={<span className="text-2xl">⏳</span>}
            title={t("alreadyStartedTitle")}
            description={t("alreadyStartedDescription")}
            action={<Button href="/workshops">{t("backToWorkshops")}</Button>}
          />
        </div>
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();
    const defaultDisplayName = profile?.display_name?.trim() || user.email?.split("@")[0] || "";

    return (
      <div className="flex flex-col gap-8">
        <PageHeader
          title={t("joinWorkshopTitle")}
          description={t("sessionCodeLabel", { code: state.code })}
        />
        <div className="max-w-sm">
          <JoinSessionForm defaultDisplayName={defaultDisplayName} fixedCode={state.code} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("workshopTitle")} />
      <WorkshopSession initialState={state} />
    </div>
  );
}
