import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncLocaleCookieAfterLogin } from "@/lib/actions/locale";
import { isSafeRedirectPath } from "@/lib/site";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const requestedNext = searchParams.get("next");
  const oauthError = searchParams.get("error_description") ?? searchParams.get("error");

  if (oauthError) {
    console.error("Auth callback: provider returned an error:", oauthError);
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }

  if (!code) {
    console.error("Auth callback: no `code` param on the request:", request.url);
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    // Technical detail (e.g. "PKCE code verifier not found in storage")
    // stays server-side only — the login page shows a localized generic
    // message keyed off `error=oauth_failed` instead.
    console.error("Auth callback: exchangeCodeForSession failed:", error?.message);
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("id", data.user.id)
    .maybeSingle();

  await syncLocaleCookieAfterLogin(supabase, data.user.id);

  // A completed user always lands on the dashboard, regardless of `next` —
  // that param only exists to route brand-new signups into onboarding, and
  // trusting it unconditionally would let a stale confirmation link send an
  // already-onboarded user back into onboarding.
  const safeNext = isSafeRedirectPath(requestedNext) ? requestedNext : null;
  const destination = profile?.onboarding_completed_at ? "/dashboard" : (safeNext ?? "/onboarding");
  return NextResponse.redirect(`${origin}${destination}`);
}
