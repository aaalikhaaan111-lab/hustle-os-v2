import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PublicShell } from "@/components/public/PublicShell";
import { PublicPage } from "@/components/public/PublicPage";
import { PLANS, type PlanId } from "@/lib/billing/plans";
import { paddleClientConfig } from "@/lib/billing/paddle";
import { UpgradeButton } from "@/components/billing/UpgradeButton";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { getUserPlan } from "@/lib/billing/userPlan";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pricing");
  const title = t("pageTitle");
  /* Without its own `alternates` this page inherited the root canonical, which
     told crawlers this URL IS the homepage — the one canonical mistake that
     actively removes a page from an index. */
  return {
    title,
    alternates: { canonical: "/pricing" },
    openGraph: { title, url: "/pricing" },
  };
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
        <Link href="/create?fresh=1" className="lp-btn lp-btn--secondary">
          {cta.free}
        </Link>
      );
    }
    if (plan === currentPlan) {
      return (
        <p className="lp-plan-current">{t("currentPlan")}</p>
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
          className="lp-btn lp-btn--primary"
        />
      );
    }
    if (plan === "pro" && paddle && !user) {
      // Checkout needs an account to attach the subscription to.
      return (
        <Link href="/login?next=%2Fpricing" className="lp-btn lp-btn--primary">
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
      <button type="button" disabled aria-describedby="billing-note" className="lp-btn lp-btn--primary">
        {cta[plan]}
      </button>
    );
  };

  return (
    <PublicShell>
      <PublicPage eyebrow={t("pageTitle")} title={t("lead")}>
        {/* PRICING AS THREE PLANS, READ ONCE.

            Nothing about entitlements changed here — every line still reads
            from `PLANS`, the same object the quota resolver and the publish
            action enforce against, and the checkout branches are untouched.
            What changed is the language it is drawn in: this page used the
            application's `.s-*` classes and its own widths, so arriving from
            the homepage meant arriving somewhere else. It is the site's own
            plan card now, the same one the homepage's pricing band uses. */}
        <div className="lp-plans">
          {ORDER.map((plan) => {
            const recommended = plan === "pro";
            return (
              <article
                key={plan}
                aria-labelledby={`plan-${plan}`}
                className="lp-plan"
                data-recommended={recommended ? "true" : undefined}
              >
                <p className="lp-plan-name">
                  <span id={`plan-${plan}`}>{name[plan]}</span>
                  {recommended && <span className="lp-plan-tag">{t("mostPeople")}</span>}
                </p>

                <p className="lp-plan-price">
                  {PRICE[plan]}
                  {plan !== "free" && <span className="lp-plan-per"> {t("perMonth")}</span>}
                </p>

                <p className="lp-plan-line">{tagline[plan]}</p>

                {/* The CTA sits with the price, because that is where the
                    decision is made. */}
                <div className="lp-plan-cta">{action(plan)}</div>

                {/* ONLY WHAT CHANGES. Two of the five capabilities are
                    identical on every plan; printing them in all three columns
                    fills the cards with text that says nothing. They move to
                    one line under the plans. */}
                <ul>
                  {DIFFERING.map((row) => (
                    <li key={row.label}>{row.value(plan)}</li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>

        <section className="lp-shared">
          <h2>{t("sharedTitle")}</h2>
          <ul>
            {SHARED.map((row) => (
              <li key={row.label}>{row.value("free")}</li>
            ))}
          </ul>
        </section>

        <p id="billing-note" className="lp-note">
          {t("billingSoon")}
        </p>
        <p className="lp-note">{t("note")}</p>
      </PublicPage>
    </PublicShell>
  );
}
