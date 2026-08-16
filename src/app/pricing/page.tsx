import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { BackNav } from "@/components/layout/BackNav";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PLANS, type PlanId } from "@/lib/billing/plans";
import { paddleClientConfig } from "@/lib/billing/paddle";
import { UpgradeButton } from "@/components/billing/UpgradeButton";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { getUserPlan } from "@/lib/billing/userPlan";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pricing");
  return { title: t("pageTitle") };
}

/** The three plans, in the order they are shown. */
const ORDER: readonly PlanId[] = ["free", "pro", "studio"] as const;
/**
 * Display prices. Pro is $19 because that is what the configured Paddle price
 * charges — an advertised number that disagrees with the receipt is the one
 * mistake a pricing page must never make. Studio has no Paddle price yet, so it
 * stays a stated pending state rather than a button that cannot work.
 */
const PRICE: Record<PlanId, string> = { free: "$0", pro: "$19", studio: "$49" };

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
 * Pro opens Paddle's overlay checkout. The button grants nothing on its own —
 * the plan changes only when Paddle's signed webhook confirms a payment — so a
 * closed overlay or a forged callback leaves the account exactly where it was.
 * Studio has no Paddle price yet and stays an honest pending state rather than
 * a button that cannot work.
 */
export default async function PricingPage() {
  const t = await getTranslations("pricing");
  const tc = await getTranslations("common");

  // Who is looking, and whether checkout can be offered at all. Both are read
  // once: the button below is a link to sign-in for a visitor, a real checkout
  // for a signed-in account, and a pending state when billing is unconfigured.
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const currentPlan = user ? await getUserPlan(supabase, user.id) : "free";
  const paddle = paddleClientConfig();

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
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-5 sm:px-6 sm:py-8">
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
              <p className="v-title">
                {name[plan]}
              </p>
              <p className="mt-3 flex items-baseline gap-1">
                <span className="text-[30px] font-semibold leading-none tracking-[-0.02em] text-ink">
                  {PRICE[plan]}
                </span>
                {plan !== "free" && (
                  <span className="v-meta">{t("perMonth")}</span>
                )}
              </p>
              <p className="v-body mt-2">{tagline[plan]}</p>

              <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                {features(plan).map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-[14.5px] leading-[1.55] text-ink">
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
                ) : plan === currentPlan ? (
                  <p className="v-tap flex items-center justify-center rounded-[10px] border border-border px-4 py-2.5 text-center text-[14.5px] font-semibold text-ink-muted">
                    {t("currentPlan")}
                  </p>
                ) : plan === "pro" && paddle && user ? (
                  <UpgradeButton
                    clientToken={paddle.clientToken}
                    environment={paddle.environment}
                    priceId={paddle.priceId}
                    userId={user.id}
                    email={user.email ?? undefined}
                    label={cta.pro}
                    className="inline-flex w-full items-center justify-center rounded-xl bg-ink px-4 py-2.5 text-[14px] font-semibold text-surface transition-opacity hover:opacity-90 disabled:opacity-60"
                  />
                ) : plan === "pro" && paddle && !user ? (
                  /* Checkout needs an account to attach the subscription to. */
                  <Link
                    href="/login?next=%2Fpricing"
                    className="inline-flex w-full items-center justify-center rounded-xl bg-ink px-4 py-2.5 text-[14px] font-semibold text-surface transition-opacity hover:opacity-90"
                  >
                    {cta.pro}
                  </Link>
                ) : (
                  /*
                    Studio has no Paddle price yet, and Pro has none when billing
                    is unconfigured. A stated pending state, never a button that
                    could look like it subscribed someone.
                  */
                  <button
                    type="button"
                    disabled
                    aria-describedby="billing-note"
                    className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-xl border border-border px-4 py-2.5 text-[14px] font-semibold text-ink-muted"
                  >
                    {cta[plan]} — {t("billingPending")}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <p id="billing-note" className="v-meta">
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
