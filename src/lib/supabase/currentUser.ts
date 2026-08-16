import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

export interface CurrentUser {
  id: string;
  email: string | null;
}

// Middleware already ran a fresh, network-validated auth.getUser() check for
// every request to a protected route and forwards the result via headers —
// reading it here avoids repeating that same round-trip a second time per
// navigation. If the header is ever absent (route reached outside the normal
// middleware matcher, for instance) this falls back to the original
// getUser() call, so security is identical either way, never weaker.
export async function getCurrentUser(
  supabase: SupabaseClient<Database>
): Promise<CurrentUser | null> {
  const headerList = await headers();
  const headerUserId = headerList.get("x-user-id");

  if (headerUserId) {
    return { id: headerUserId, email: headerList.get("x-user-email") };
  }

  /**
   * Fails closed, the way `getUserPlan` already does.
   *
   * This fallback is a live network call to Supabase, and an anonymous visitor
   * always reaches it — the header exists only once middleware has identified
   * someone. An unhandled rejection here does not degrade the page, it takes
   * the whole render down with a 500, which reads to a person as "this page
   * didn't load" and works when they try again.
   *
   * That matches a real report: Pricing failed once on a phone and loaded on
   * the second attempt. It was NOT reproducible — twenty production requests
   * passed and the route is only ~150 ms slower than a fully public one — so
   * this is hardening against a transient dependency, not a fix for a diagnosed
   * failure, and it is recorded as such rather than claimed as a cure.
   *
   * It cannot weaken anything. `null` means "treated as signed out", which is
   * the restrictive answer; access control belongs to the proxy and is enforced
   * before a request reaches any page, never here.
   */
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;
    return { id: user.id, email: user.email ?? null };
  } catch (error) {
    console.warn("[ventrio-auth]", JSON.stringify({
      event: "current_user_lookup_failed",
      at: new Date().toISOString(),
      error: error instanceof Error ? error.name : "unknown",
    }));
    return null;
  }
}
