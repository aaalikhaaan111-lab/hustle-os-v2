import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { BackNav } from "@/components/layout/BackNav";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PLANS, type PlanId } from "@/lib/billing/plans";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pricing");
  return { title: t("pageTitle") };
}

/** The three plans, in the order they are shown. */
const ORDER: readonly PlanId[] = ["free", "pro", "studio"] as const;
const PRICE: Record<PlanId, string> = { free: "$0", pro: "$20", studio: "$49" };

/**
 * Pricing.
 *
 * Every number on this page is read from `PLANS`, which is the same object the
 * quota resolver and the publish action enforce against. There is no second
 * list of limits to fall out of date — if the free allowance changes, this page
 * changes with it.
 *
 * What is deliberately absent: custom domains, teams, unlimited anything,
 * analytics beyond response counts, and any claim about the product improving
 * itself. None of those exist, and a pricing page is the worst possible place
 * to promise one.
 *
 * Billing is not connected. Paid buttons say so and route nowhere that could
 * imply a subscription was created — a fake success here would be worse than
 * no button at all.
 */
export default async function PricingPage() {
  const t = await getTranslations("pricing");
  const tc = await getTranslations("common");

  const features = (plan: PlanId): string[] => {
    const e = PLANS[plan];
    return [
      t("featureGenerations", { count: e.generationsPerMonth }),
      e.maxPublishedProjects === null ? t("featurePublishMany") : t("featurePublishOne"),
      e.canRemoveBranding ? t("featureBrandingOff") : t("featureBrandingOn"),
      t("featureSubdomain"),
      t("featureDiscovery"),
    ];
  };

  const cta: Record<PlanId, string> = {
    free: t("freeCta"),
    pro: t("proCta"),
    studio: t("studioCta"),
  };
  const name: Record<PlanId, string> = {
    free: t("freeName"),
    pro: t("proName"),
    studio: t("studioName"),
  };
  const tagline: Record<PlanId, string> = {
    free: t("freeTagline"),
    pro: t("proTagline"),
    studio: t("studioTagline"),
  };

  return (
    <>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6">
        <BackNav fallback="/" label={tc("backToVentrio")} />
        <PageHeader title={t("pageTitle")} description={t("lead")} />

        <div className="grid gap-4 md:grid-cols-3">
          {ORDER.map((plan) => (
            <div
              key={plan}
              className={`flex flex-col rounded-2xl border p-5 ${
                plan === "pro" ? "border-accent/40 bg-surface shadow-sm" : "border-border bg-surface"
              }`}
            >
              <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-secondary">
                {name[plan]}
              </p>
              <p className="mt-3 flex items-baseline gap-1">
                <span className="text-[32px] font-semibold leading-none tracking-[-0.02em] text-ink">
                  {PRICE[plan]}
                </span>
                {plan !== "free" && (
                  <span className="text-[13px] text-ink-muted">{t("perMonth")}</span>
                )}
              </p>
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink-muted">{tagline[plan]}</p>

              <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                {features(plan).map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-[13.5px] leading-relaxed text-ink">
                    <svg viewBox="0 0 16 16" aria-hidden className="mt-[3px] h-3.5 w-3.5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 8.5l3.5 3.5L13 5" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                {plan === "free" ? (
                  <Link
                    href="/create"
                    className="inline-flex w-full items-center justify-center rounded-xl bg-ink px-4 py-2.5 text-[14px] font-semibold text-surface transition-opacity hover:opacity-90"
                  >
                    {cta.free}
                  </Link>
                ) : (
                  /*
                    No Stripe yet, so this is a stated pending state rather than
                    a checkout. It must never look like a subscription was
                    created — `disabled` and the note below say plainly that
                    billing is not open.
                  */
                  <>
                    <button
                      type="button"
                      disabled
                      aria-describedby="billing-note"
                      className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-xl border border-border px-4 py-2.5 text-[14px] font-semibold text-ink-muted"
                    >
                      {cta[plan]} — {t("billingPending")}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <p id="billing-note" className="text-[13px] leading-relaxed text-ink-muted">
          {t("billingSoon")}
        </p>
        <p className="text-xs text-ink-muted">{t("note")}</p>
      </div>
      <div className="mx-auto w-[min(100%-2rem,1280px)]">
        <PublicFooter />
      </div>
    </>
  );
}
