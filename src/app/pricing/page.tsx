import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
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

  // Who is looking, and whether checkout can be offered at all. Both are read
  // once: the button below is a link to sign-in for a visitor, a real checkout
  // for a signed-in account, and a pending state when billing is unconfigured.
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const currentPlan = user ? await getUserPlan(supabase, user.id) : "free";
  const paddle = paddleClientConfig();

  /**
   * The comparison, as rows rather than three repeated lists.
   *
   * Every value still comes from `PLANS` — the same object the quota resolver
   * and the publish action enforce against — so there is no second list of
   * limits to fall out of date. What changed is only that a capability is now
   * stated once with three answers, instead of three times with one answer
   * each, which is what makes the differences visible without re-reading.
   */
  const ROWS: { label: string; value: (plan: PlanId) => string }[] = [
    {
      label: t("rowGenerations"),
      value: (plan) => t("featureGenerations", { count: PLANS[plan].generationsPerMonth }),
    },
    {
      label: t("rowPublished"),
      value: (plan) =>
        PLANS[plan].maxPublishedProjects === null ? t("featurePublishMany") : t("featurePublishOne"),
    },
    {
      label: t("rowBranding"),
      value: (plan) => (PLANS[plan].canRemoveBranding ? t("featureBrandingOff") : t("featureBrandingOn")),
    },
    { label: t("rowSubdomain"), value: () => t("featureSubdomain") },
    { label: t("rowDiscovery"), value: () => t("featureDiscovery") },
  ];

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

  /**
   * The call to action for a plan.
   *
   * The BRANCHES ARE UNCHANGED — this is the same billing logic, moved into one
   * function so the table and the stacked mobile layout cannot drift apart.
   * Pro opens Paddle's overlay checkout and grants nothing on its own; the plan
   * changes only when Paddle's signed webhook confirms a payment. Studio has no
   * Paddle price yet and stays a stated pending state rather than a button that
   * cannot work.
   */
  const action = (plan: PlanId) => {
    if (plan === "free") {
      return (
        <Link href="/create" className="s-btn s-btn--secondary w-full">
          {cta.free}
        </Link>
      );
    }
    if (plan === currentPlan) {
      return (
        <p className="s-meta flex min-h-[2.375rem] items-center justify-center">{t("currentPlan")}</p>
      );
    }
    if (plan === "pro" && paddle && user) {
      return (
        <UpgradeButton
          clientToken={paddle.clientToken}
          environment={paddle.environment}
          priceId={paddle.priceId}
          userId={user.id}
          email={user.email ?? undefined}
          label={cta.pro}
          className="s-btn s-btn--primary w-full"
        />
      );
    }
    if (plan === "pro" && paddle && !user) {
      // Checkout needs an account to attach the subscription to.
      return (
        <Link href="/login?next=%2Fpricing" className="s-btn s-btn--primary w-full">
          {cta.pro}
        </Link>
      );
    }
    return (
      <button type="button" disabled aria-describedby="billing-note" className="s-btn s-btn--secondary w-full">
        {cta[plan]} — {t("billingPending")}
      </button>
    );
  };

  return (
    <>
      {/* PRICING, AS A COMPARISON RATHER THAN THREE BROCHURES.

          It was three equal bordered cards side by side, each repeating the
          same five feature lines with its own tick marks — so the one thing a
          person actually wants (what changes between plans) had to be found by
          reading the same list three times and diffing it by eye. Pro was
          "highlighted" with a 40%-opacity accent border, which at that opacity
          is not a highlight.

          It is now one table. The plans are columns, the capabilities are rows,
          and the differences line up horizontally where they can be read. Pro
          is marked by tone and a label rather than by a border nobody sees. */}
      <div className="mx-auto w-full max-w-[1080px] px-5 pb-20 pt-14 sm:px-8">
        <header className="max-w-2xl">
          <p className="s-eyebrow mb-3">{t("pageTitle")}</p>
          <h1 className="s-display">{t("lead")}</h1>
        </header>

        {/* Wide: a real table. Narrow: the same data as three stacked blocks,
            because a three-column table on a phone is a horizontal scroll. */}
        <div className="mt-14 hidden md:block">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                <th className="w-[26%] pb-6 align-bottom" />
                {ORDER.map((plan) => (
                  <th key={plan} className="w-[24.6%] pb-6 pl-6 align-bottom">
                    <span className="s-eyebrow block">{name[plan]}</span>
                    <span className="mt-3 flex items-baseline gap-1.5">
                      <span className="text-[34px] font-medium leading-none tracking-[-0.035em]">
                        {PRICE[plan]}
                      </span>
                      {plan !== "free" && <span className="s-meta">{t("perMonth")}</span>}
                    </span>
                    <span className="s-meta mt-2.5 block font-normal">{tagline[plan]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label} className="border-t" style={{ borderColor: "var(--color-border)" }}>
                  <th scope="row" className="py-4 pr-6 text-[14px] font-normal align-top"
                      style={{ color: "var(--color-ink-muted)" }}>
                    {row.label}
                  </th>
                  {ORDER.map((plan) => (
                    <td key={plan} className="py-4 pl-6 align-top text-[15px]"
                        style={{ color: "var(--color-ink)" }}>
                      {row.value(plan)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t" style={{ borderColor: "var(--color-border)" }}>
                <td />
                {ORDER.map((plan) => (
                  <td key={plan} className="pl-6 pt-8">
                    {action(plan)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-12 flex flex-col gap-10 md:hidden">
          {ORDER.map((plan) => (
            <section key={plan} className="border-t pt-6" style={{ borderColor: "var(--color-border)" }}>
              <p className="s-eyebrow">{name[plan]}</p>
              <p className="mt-3 flex items-baseline gap-1.5">
                <span className="text-[32px] font-medium leading-none tracking-[-0.035em]">{PRICE[plan]}</span>
                {plan !== "free" && <span className="s-meta">{t("perMonth")}</span>}
              </p>
              <p className="s-body mt-2">{tagline[plan]}</p>
              {/* The VALUES only, with no row label beside them.
                  These strings are full sentences — "1 published project",
                  "Ventrio branding on published projects" — written for a
                  bullet list, so pairing each with its own noun as a label read
                  as the same thing said twice down the whole column. The labels
                  earn their place in the desktop table, where they are the row
                  headers that make three columns comparable; on one column
                  there is nothing to compare and the sentence is enough. */}
              <ul className="mt-6 flex flex-col gap-2.5">
                {ROWS.map((row) => (
                  <li key={row.label} className="flex items-start gap-2.5 text-[15px]"
                      style={{ color: "var(--color-ink)" }}>
                    <span aria-hidden className="mt-[9px] h-[3px] w-[3px] shrink-0 rounded-full"
                          style={{ background: "var(--color-ink-muted)" }} />
                    {row.value(plan)}
                  </li>
                ))}
              </ul>
              <div className="mt-7">{action(plan)}</div>
            </section>
          ))}
        </div>

        <p id="billing-note" className="s-meta mt-14 max-w-2xl">
          {t("billingSoon")}
        </p>
        <p className="s-meta mt-2 max-w-2xl">{t("note")}</p>
      </div>
      <div className="mx-auto w-[min(100%-2rem,1080px)]">
        <PublicFooter />
      </div>
    </>
  );
}
