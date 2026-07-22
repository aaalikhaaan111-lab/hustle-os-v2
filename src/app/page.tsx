import Link from "next/link";
import { useTranslations } from "next-intl";
import { PublicFooter } from "@/components/layout/PublicFooter";

const STEPS = [
  { step: "01", titleKey: "step1Title", descriptionKey: "step1Description" },
  { step: "02", titleKey: "step2Title", descriptionKey: "step2Description" },
  { step: "03", titleKey: "step3Title", descriptionKey: "step3Description" },
] as const;

export default function Home() {
  const t = useTranslations("landing");

  return (
    <div className="flex flex-col gap-20 py-5 sm:gap-28 sm:py-10">
      <section className="emergence relative flex min-h-[58vh] flex-col justify-center overflow-hidden rounded-[2rem] px-1 py-10 sm:px-8 lg:px-12">
        <div aria-hidden className="creation-focus-field !left-[38%] !top-[48%]" />
        <p className="relative text-[10px] font-semibold uppercase tracking-[0.22em] text-accent/80">{t("badge")}</p>
        <h1 className="ventrio-display relative mt-5 max-w-5xl text-[clamp(3.15rem,9vw,7.8rem)] leading-[0.88] text-ink">
          {t("title")}
        </h1>
        <p className="relative mt-7 max-w-xl text-pretty text-base leading-7 text-ink-secondary sm:text-lg">{t("subtitle")}</p>
        <div className="relative mt-9 flex flex-wrap items-center gap-4">
          <Link href="/signup" className="primary-action px-5 py-3 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent">
            {t("cta")} <span aria-hidden>→</span>
          </Link>
          <p className="text-sm text-ink-muted">
            {t("haveAccount")} {" "}
            <Link href="/login" className="font-semibold text-ink-secondary transition-colors hover:text-ink">{t("login")}</Link>
          </p>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-3">
          <span className="creation-signal-dot" />
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-muted">{t("howItWorks")}</h2>
        </div>
        <div className="mt-7 grid gap-px overflow-hidden rounded-[1.7rem] bg-white/[0.055] sm:grid-cols-3">
          {STEPS.map(({ step, titleKey, descriptionKey }) => (
            <article key={step} className="min-h-56 bg-canvas/95 p-6 sm:p-7">
              <span className="font-mono text-[10px] tracking-[0.16em] text-accent/70">{step}</span>
              <h3 className="ventrio-display mt-10 text-2xl leading-tight text-ink">{t(titleKey)}</h3>
              <p className="mt-3 text-sm leading-6 text-ink-secondary">{t(descriptionKey)}</p>
            </article>
          ))}
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
