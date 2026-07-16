import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { PublicFooter } from "@/components/layout/PublicFooter";

const STEPS = [
  { step: "01", emoji: "🎯", titleKey: "step1Title", descriptionKey: "step1Description" },
  { step: "02", emoji: "⏱️", titleKey: "step2Title", descriptionKey: "step2Description" },
  { step: "03", emoji: "🌱", titleKey: "step3Title", descriptionKey: "step3Description" },
] as const;

export default function Home() {
  const t = useTranslations("landing");

  return (
    <div className="flex flex-col gap-16 py-4 sm:py-6">
      <section className="flex flex-col gap-5">
        <Badge variant="accent" className="w-fit">
          {t("badge")}
        </Badge>
        <h1 className="max-w-2xl break-words text-4xl font-black leading-[1.05] tracking-[-0.03em] text-ink [hyphens:auto] sm:text-5xl sm:max-w-3xl md:text-6xl lg:max-w-4xl lg:text-7xl">
          {t("title")}
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-ink-secondary sm:text-lg">
          {t("subtitle")}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button href="/signup" size="lg">
            {t("cta")}
          </Button>
          <p className="text-sm text-ink-secondary">
            {t("haveAccount")}{" "}
            <a href="/login" className="font-medium text-accent hover:text-accent-hover">
              {t("login")}
            </a>
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-ink-muted">
          {t("howItWorks")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map(({ step, emoji, titleKey, descriptionKey }) => (
            <Card key={step}>
              <CardContent className="flex h-full flex-col gap-3 py-7">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-ink-muted">{step}</span>
                  <span className="text-2xl" role="img" aria-hidden>
                    {emoji}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink">{t(titleKey)}</h3>
                  <p className="mt-1.5 text-sm text-ink-secondary">{t(descriptionKey)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
