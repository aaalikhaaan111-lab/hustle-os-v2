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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  return { id: user.id, email: user.email ?? null };
}
