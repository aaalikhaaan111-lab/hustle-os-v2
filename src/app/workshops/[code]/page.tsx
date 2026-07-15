import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { WorkshopSession } from "@/components/workshops/WorkshopSession";
import { JoinSessionForm } from "@/components/workshops/JoinSessionForm";
import { getWorkshopSessionStateAction } from "@/lib/actions/workshops";
import { createClient } from "@/lib/supabase/server";

interface WorkshopSessionPageProps {
  params: Promise<{ code: string }>;
}

export default async function WorkshopSessionPage({ params }: WorkshopSessionPageProps) {
  const { code } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: state } = await getWorkshopSessionStateAction(code);

  if (!state) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Воркшоп" />
        <EmptyState
          icon={<span className="text-2xl">🔍</span>}
          title="Сессия не найдена"
          description={`Код «${code.toUpperCase()}» не соответствует активной сессии. Проверь код или попроси хоста прислать новый.`}
          action={<Button href="/workshops">Ко всем воркшопам</Button>}
        />
      </div>
    );
  }

  if (!state.myParticipantId) {
    if (state.status !== "lobby") {
      return (
        <div className="flex flex-col gap-8">
          <PageHeader title="Воркшоп" />
          <EmptyState
            icon={<span className="text-2xl">⏳</span>}
            title="Игра уже началась"
            description="Эта сессия уже в процессе — присоединиться можно только до старта. Попроси хоста создать новую."
            action={<Button href="/workshops">Ко всем воркшопам</Button>}
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
        <PageHeader title="Присоединиться к воркшопу" description={`Код сессии: ${state.code}`} />
        <div className="max-w-sm">
          <JoinSessionForm defaultDisplayName={defaultDisplayName} fixedCode={state.code} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Воркшоп" />
      <WorkshopSession initialState={state} />
    </div>
  );
}
