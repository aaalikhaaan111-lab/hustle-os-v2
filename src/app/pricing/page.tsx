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

  /* A capability whose three answers are identical is not a comparison. */
  const sameOnEveryPlan = (row: { value: (plan: PlanId) => string }) => {
    const values = ORDER.map((plan) => row.value(plan));
    return values.every((value) => value === values[0]);
  };
  const DIFFERING = ROWS.filter((row) => !sameOnEveryPlan(row));
  const SHARED = ROWS.filter(sameOnEveryPlan);

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
        <Link href="/create?fresh=1" className="s-btn s-btn--secondary w-full">
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
      /* THE BUTTON NAMES THE PLAN, NOT THE ROADMAP.
         It used to read "Upgrade to Pro (not open yet)" — a call to action
         advertising its own implementation status, which makes the whole page
         read as unfinished. The state is unchanged: it is still disabled and
         still described by the note below, which is where "why" belongs. */
      <button type="button" disabled aria-describedby="billing-note" className="s-btn s-btn--primary w-full">
        {cta[plan]}
      </button>
    );
  };

  return (
    <>
      {/* PRICING AS THREE PLANS, READ ONCE.

          The table before this made a reader scan a 3x5 grid and diff cells to
          answer "which one do I want", and it left a third of the page empty
          where rows collapsed. Plans are cards again — but not the three equal
          brochures that preceded the table. Each card states the price, one
          sentence of what the plan is for, its own capability list, and its
          own call to action, so a decision can be made from one column without
          reading the other two. Pro is the recommended plan and looks it: a
          filled surface, a label, and a raised edge.

          Nothing about entitlements changed. Every line still reads from
          `PLANS`, the same object the quota resolver and the publish action
          enforce against. */}
      <section className="px-5 pb-10 pt-10 sm:px-10 sm:pt-16">
        <div className="mx-auto w-full max-w-[1080px]">
          <p className="s-eyebrow mb-3">{t("pageTitle")}</p>
          <h1 className="s-display max-w-[16ch]">{t("lead")}</h1>
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1080px] px-5 pb-20 sm:px-10">
        <div className="grid gap-5 md:grid-cols-3 md:items-start">
          {ORDER.map((plan) => {
            const recommended = plan === "pro";
            return (
              <section
                key={plan}
                aria-labelledby={`plan-${plan}`}
                className={`flex flex-col rounded-[var(--r-lg)] border p-6 ${
                  recommended
                    ? "bg-muted/60 shadow-[var(--shadow-soft)] md:-mt-3 md:pb-8 md:pt-8"
                    : "bg-background"
                }`}
                style={recommended ? { borderColor: "var(--color-ink)" } : undefined}
              >
                <div className="flex items-center gap-2">
                  <h2 id={`plan-${plan}`} className="s-eyebrow">{name[plan]}</h2>
                  {recommended && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[11.5px] font-medium"
                      style={{ background: "var(--color-ink)", color: "var(--color-canvas)" }}
                    >
                      {t("mostPeople")}
                    </span>
                  )}
                </div>

                <p className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-[40px] font-medium leading-none tracking-[-0.03em]">
                    {PRICE[plan]}
                  </span>
                  {plan !== "free" && <span className="s-meta">{t("perMonth")}</span>}
                </p>

                <p className="s-body mt-3 min-h-[2.75rem]">{tagline[plan]}</p>

                {/* The CTA sits with the price, because that is where the
                    decision is made — it used to be the last row of a table
                    five capability rows further down. */}
                <div className="mt-6">{action(plan)}</div>

                {/* ONLY WHAT CHANGES. Two of the five capabilities are
                    identical on every plan, and printing them in all three
                    columns filled the cards with text a reader has to check
                    before discovering it says nothing. They move to one line
                    under the plans; what is left here is the difference. */}
                <ul className="mt-7 flex flex-col gap-3">
                  {DIFFERING.map((row) => (
                    <li
                      key={row.label}
                      className="flex items-start gap-2.5 text-[14.5px] leading-snug"
                      style={{ color: "var(--color-ink)" }}
                    >
                      <span
                        aria-hidden
                        className="mt-[7px] h-[3px] w-[3px] shrink-0 rounded-full"
                        style={{ background: "var(--color-ink-muted)" }}
                      />
                      {row.value(plan)}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <section className="mt-8 rounded-[var(--r-lg)] border bg-muted/40 px-6 py-5">
          <h2 className="s-eyebrow">{t("sharedTitle")}</h2>
          <ul className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-10">
            {SHARED.map((row) => (
              <li
                key={row.label}
                className="flex items-start gap-2.5 text-[14.5px] leading-snug"
                style={{ color: "var(--color-ink)" }}
              >
                <span
                  aria-hidden
                  className="mt-[7px] h-[3px] w-[3px] shrink-0 rounded-full"
                  style={{ background: "var(--color-ink-muted)" }}
                />
                {row.value("free")}
              </li>
            ))}
          </ul>
        </section>

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
