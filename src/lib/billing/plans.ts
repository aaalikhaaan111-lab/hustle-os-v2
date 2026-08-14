/**
 * What each plan is allowed to do.
 *
 * The seam Stripe will attach to. Everything in the product asks this module a
 * question — how many generations, may they publish another project, may the
 * badge come off — and never asks "is this user paying". When billing lands it
 * has one job: keep `profiles.plan` correct. No UI, no quota code and no
 * publishing code should need to change again.
 *
 * Deliberately not a billing system. There are no subscription records, no
 * prices, no periods and no webhooks here — those belong to Stripe, and
 * inventing our own now would mean two sources of truth for the same fact.
 * `profiles.plan` is the whole of the state, because it is the whole of what
 * the product needs to answer with.
 *
 * The numbers below are the ones the product actually enforces. Free is three
 * generations a month because that is what `AI_USAGE_LIMITS` grants and what
 * the free tier costs (~$0.35 of provider spend each). If a number changes it
 * changes here, and the quota resolver and the pricing page both follow.
 */

export const PLAN_IDS = ["free", "pro", "studio"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export interface PlanEntitlements {
  /** First-version generations per UTC month. */
  generationsPerMonth: number;
  /**
   * How many projects may be published at once. `null` is unlimited.
   *
   * Enforced server-side in the publish action, not only in the UI — a limit
   * that lives in a button is not a limit.
   */
  maxPublishedProjects: number | null;
  /** Whether "Made with Ventrio" may be turned off on published projects. */
  canRemoveBranding: boolean;
  /** Whether published projects get their own `[slug].ventrio.org` address. */
  projectSubdomains: boolean;
}

/**
 * Every plan, in one place.
 *
 * Free is the fallback for anything unrecognised, so a bad value in the column
 * grants the least rather than the most.
 */
export const PLANS: Record<PlanId, PlanEntitlements> = {
  free: {
    generationsPerMonth: 3,
    maxPublishedProjects: 1,
    canRemoveBranding: false,
    projectSubdomains: true,
  },
  pro: {
    generationsPerMonth: 30,
    maxPublishedProjects: null,
    canRemoveBranding: true,
    projectSubdomains: true,
  },
  studio: {
    generationsPerMonth: 100,
    maxPublishedProjects: null,
    canRemoveBranding: true,
    projectSubdomains: true,
  },
};

/** Narrows an unknown value — a database column, a header — to a plan. */
export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && (PLAN_IDS as readonly string[]).includes(value);
}

/**
 * The plan a value names, or free.
 *
 * Fails closed on purpose: a null column, a typo, a plan this deploy does not
 * know about yet — all of them are free. The failure mode of the alternative is
 * giving away paid capacity to a bad string.
 */
export function planFrom(value: unknown): PlanId {
  return isPlanId(value) ? value : "free";
}

/** The entitlements for a value that may or may not be a plan. */
export function entitlementsFor(value: unknown): PlanEntitlements {
  return PLANS[planFrom(value)];
}
