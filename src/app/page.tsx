import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

const STEPS = [
  {
    step: "01",
    emoji: "🎯",
    title: "Каждый день — новый челлендж",
    description:
      "Никакой скучной теории. Только конкретное действие, которое можно выполнить прямо сегодня.",
  },
  {
    step: "02",
    emoji: "⏱️",
    title: "5–15 минут в день",
    description:
      "Выбери удобный формат под свой темп — без выгорания и лишнего давления.",
  },
  {
    step: "03",
    emoji: "🌱",
    title: "Мышление меняется через практику",
    description:
      "Развивай предпринимательское чутьё шаг за шагом, а не по учебнику.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col gap-16 py-4 sm:py-6">
      <section className="flex flex-col gap-5">
        <Badge variant="accent" className="w-fit">
          Практика, а не теория
        </Badge>
        <h1 className="max-w-2xl break-words text-4xl font-black leading-[1.05] tracking-[-0.03em] text-ink [hyphens:auto] sm:text-5xl sm:max-w-3xl md:text-6xl lg:max-w-4xl lg:text-7xl">
          Изучай предпринимательство через действие.
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-ink-secondary sm:text-lg">
          Тут не будет скучной теории и часовых лекций. Только 1 практический челлендж
          каждый день, который развивает бизнес-мышление.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button href="/signup" size="lg">
            Начать бесплатно
          </Button>
          <p className="text-sm text-ink-secondary">
            Уже есть аккаунт?{" "}
            <a href="/login" className="font-medium text-accent hover:text-accent-hover">
              Войти
            </a>
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-ink-muted">
          Как это работает
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map(({ step, emoji, title, description }) => (
            <Card key={step}>
              <CardContent className="flex h-full flex-col gap-3 py-7">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-ink-muted">{step}</span>
                  <span className="text-2xl" role="img" aria-hidden>
                    {emoji}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink">{title}</h3>
                  <p className="mt-1.5 text-sm text-ink-secondary">{description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
