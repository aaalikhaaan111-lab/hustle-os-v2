import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { UnitEconomicsSimulator } from "@/components/workshops/UnitEconomicsSimulator";
import { CreateSessionButton } from "@/components/workshops/CreateSessionButton";
import { JoinSessionForm } from "@/components/workshops/JoinSessionForm";
import { WORKSHOP_PACKS } from "@/lib/workshops";
import { createClient } from "@/lib/supabase/server";

interface LockedWorkshopCardProps {
  emoji: string;
  title: string;
  description: string;
}

function LockedWorkshopCard({ emoji, title, description }: LockedWorkshopCardProps) {
  return (
    <Card className="pointer-events-none opacity-60 grayscale">
      <CardContent className="flex flex-col gap-4 py-8">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-2xl">
            {emoji}
          </span>
          <div className="flex flex-col gap-1">
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
              🔒 Скоро
            </span>
            <h3 className="text-lg font-extrabold leading-tight tracking-[-0.02em] text-ink">
              {title}
            </h3>
          </div>
        </div>
        <p className="text-sm tracking-tight text-ink-secondary">{description}</p>
      </CardContent>
    </Card>
  );
}

export default async function WorkshopsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
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
        title="Воркшопы и Симуляторы"
        description="Живые квизы для команды и практические инструменты для симуляции бизнес-процессов."
      />

      <div className="flex flex-col gap-4">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-600">
          🎮 Живые квизы — собери команду и сыграйте вместе
        </h2>
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="grid gap-4 sm:grid-cols-3">
            {WORKSHOP_PACKS.map((pack) => (
              <Card key={pack.slug}>
                <CardContent className="flex h-full flex-col gap-3 py-6">
                  <span className="text-3xl">{pack.emoji}</span>
                  <h3 className="text-base font-extrabold leading-tight tracking-[-0.02em] text-ink">
                    {pack.title}
                  </h3>
                  <p className="flex-1 text-xs tracking-tight text-ink-secondary">{pack.description}</p>
                  <p className="text-[11px] font-semibold text-ink-muted">
                    {pack.questions.length} вопросов
                  </p>
                  <CreateSessionButton slug={pack.slug} />
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardContent className="flex flex-col gap-4 py-6">
              <h3 className="text-base font-extrabold leading-tight tracking-[-0.02em] text-ink">
                Войти по коду
              </h3>
              <JoinSessionForm defaultDisplayName={defaultDisplayName} />
            </CardContent>
          </Card>
        </div>
      </div>

      <UnitEconomicsSimulator />

      <div className="grid gap-6 sm:grid-cols-2">
        <LockedWorkshopCard
          emoji="🎬"
          title="Генератор Питч-Деков"
          description="Собери питч-дек по структуре проблема-решение-тракшн прямо в браузере. Уже в разработке."
        />
        <LockedWorkshopCard
          emoji="🧪"
          title="Кастдев-Тренажер (Тест Мамы)"
          description="Потренируйся задавать вопросы, которые не подсказывают собеседнику приятный ответ. Уже в разработке."
        />
      </div>
    </div>
  );
}
