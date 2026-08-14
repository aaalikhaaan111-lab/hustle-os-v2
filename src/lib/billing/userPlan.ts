import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { entitlementsFor, planFrom, type PlanEntitlements, type PlanId } from "@/lib/billing/plans";

/**
 * Which plan an account is on, read from the one column that says so.
 *
 * `profiles.plan` is the entire billing state. Stripe's job, when it arrives,
 * is to keep this column correct — nothing else in the product needs to learn
 * about subscriptions, invoices or periods, because nothing else asks about
 * them.
 *
 * Fails closed. A missing profile, a read error or an unrecognised value all
 * resolve to free: the cost of being wrong in that direction is a person who
 * paid seeing a limit, which they will tell us about immediately. The other
 * direction gives away paid capacity silently.
 */
export async function getUserPlan(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<PlanId> {
  const { data } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .maybeSingle();
  return planFrom((data as { plan?: unknown } | null)?.plan);
}

/** The same read, already resolved to what the account may do. */
export async function getUserEntitlements(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<PlanEntitlements> {
  return entitlementsFor(await getUserPlan(supabase, userId));
}
