import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/supabase";
import { getSiteUrl, isSafeRedirectPath } from "@/lib/site";
import { slugFromHost } from "@/lib/publishing/publicUrl";

const PROTECTED_PREFIXES = ["/create", "/projects", "/build", "/profile", "/dashboard", "/settings"];
const AUTH_ROUTES = ["/login", "/signup"];

/**
 * Pages whose content is identical for everyone, signed in or not.
 *
 * None of these routes reads the visitor's identity: they render from the
 * message bundle and `legal.ts` alone, which is why the session refresh below
 * — a network-validated `getUser()`, measured at 400–500 ms — buys them
 * nothing. Skipping it is the whole optimisation.
 *
 * `/` is deliberately NOT here. The landing page calls `getCurrentUser` itself
 * to route an already-signed-in visitor onward, so skipping the proxy's call
 * would only move the same round trip into the page.
 *
 * A route joins this list only when it reads no identity. If one later needs
 * the user, remove it here rather than reading the hint header below.
 */
const PUBLIC_CONTENT_ROUTES = [
  "/privacy",
  "/terms",
  "/cookies",
  "/ai-policy",
  "/about",
  "/faq",
  "/who-its-for",
  "/contact",
  "/delete-account",
  "/refund-policy",
];

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Whether a Supabase auth cookie is present — not whether it is valid.
 *
 * Used for one thing: picking which links the nav shows on the routes above.
 * It is never an authorisation input, which is why it is reported under its own
 * header and never as `x-user-id` (the header `getCurrentUser` trusts as
 * identity). Presence is cheap and local; validity costs the round trip this
 * function exists to avoid.
 */
function hasAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some(({ name }) => /^sb-.+-auth-token(\.\d+)?$/.test(name));
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /**
   * `sat-prep.ventrio.org` is `/p/sat-prep`, served by the same deployment.
   *
   * A rewrite, not a redirect: the visitor keeps the subdomain in the address
   * bar and the existing `/p/[slug]` route does the rendering, so there is one
   * page, one sandbox and one set of security headers rather than two that can
   * drift apart. Nothing is created per project — one wildcard DNS record and
   * one Vercel domain cover every publication that will ever exist.
   *
   * It runs before the Supabase branch below, and returns without touching
   * cookies, so a project host never carries a session. That is the point:
   * auth cookies stay host-only to the apex and are never sent to a subdomain
   * serving a stranger's application. `slugFromHost` rejects the apex, `www`,
   * every other reserved name, nested labels and non-production hosts.
   */
  const projectSlug = slugFromHost(request.headers.get("host"));
  if (projectSlug && !pathname.startsWith("/p/")) {
    /**
     * A project subdomain serves ONE thing: that project, at its root.
     *
     * This used to rewrite every path, so `watch-party-club.ventrio.org/pricing`
     * answered 200 with the application instead of the pricing page — measured,
     * 19 kB of app shell where the apex returns 113 kB of pricing. Any link on a
     * published page that resolved relatively was silently served the app back,
     * and nothing said so.
     *
     * Anything that is not this project belongs to the apex and is sent there
     * with its path intact, rather than quietly answered with the wrong page.
     * That also makes the "Made with Ventrio" badge robust: whether its link is
     * absolute or relative, Pricing now resolves to Pricing.
     */
    if (pathname.startsWith("/_next") || pathname.startsWith("/api")) {
      // The page that asked for these is on this host. Redirecting them
      // cross-origin would break the page that is already rendering.
      return NextResponse.next({ request });
    }

    if (pathname !== "/") {
      const apex = new URL(`${pathname}${request.nextUrl.search}`, getSiteUrl());
      return NextResponse.redirect(apex, 308);
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-ventrio-public-route", "1");
    const url = request.nextUrl.clone();
    url.pathname = `/p/${projectSlug}`;
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }

  // Public project pages are deliberately outside the authenticated product.
  // Skip the Supabase session refresh and mark the request so the root layout
  // can omit the dashboard shell and its client-side providers.
  if (pathname.startsWith("/p/")) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-ventrio-public-route", "1");
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (pathname.startsWith("/api/public/")) {
    return NextResponse.next({ request });
  }

  // Public content: no session needed, so no session is fetched. The identity
  // headers are stripped rather than trusted — a client may send anything, and
  // on this branch nothing has validated it.
  if (matchesPrefix(pathname, PUBLIC_CONTENT_ROUTES)) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.delete("x-user-id");
    requestHeaders.delete("x-user-email");
    requestHeaders.delete("x-ventrio-public-route");
    requestHeaders.delete("x-ventrio-session-hint");
    if (hasAuthCookie(request)) requestHeaders.set("x-ventrio-session-hint", "1");
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Google OAuth's PKCE code verifier is written to a cookie scoped to
  // whatever origin /login or /signup was actually loaded from, but
  // `redirectTo` always points at the one canonical origin (lib/site.ts).
  // If those two origins differ, exchangeCodeForSession fails silently and
  // the visitor lands back on /login with no visible error — requiring a
  // second attempt, which only succeeds because by then they're on the
  // canonical origin. Canonicalizing the auth pages up front removes the
  // mismatch instead of relying on a retry to fix it.
  if (matchesPrefix(pathname, AUTH_ROUTES) && process.env.NODE_ENV === "production") {
    const canonicalHost = new URL(getSiteUrl()).host;
    if (request.nextUrl.host !== canonicalHost) {
      const canonicalUrl = new URL(`${pathname}${request.nextUrl.search}`, getSiteUrl());
      return NextResponse.redirect(canonicalUrl, 308);
    }
  }

  // Never trust a client-supplied shell marker on authenticated routes. Only
  // the public-path branches above are allowed to set these.
  request.headers.delete("x-ventrio-public-route");
  request.headers.delete("x-ventrio-session-hint");

  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = matchesPrefix(pathname, PROTECTED_PREFIXES);
  const isAuthRoute = matchesPrefix(pathname, AUTH_ROUTES);

  if (!user && isProtected) {
    // Preserve where the visitor was headed so a successful login can return
    // them there instead of always dropping them on the default home.
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isAuthRoute) {
    // An already-authenticated visitor landing on an auth page (stale
    // bookmark, back button) is sent to Overview — the same place a fresh
    // sign-in lands, so the two never disagree — or to their preserved
    // destination when a protected route sent them here.
    const requestedNext = request.nextUrl.searchParams.get("next");
    const destination = isSafeRedirectPath(requestedNext) ? requestedNext : "/dashboard";
    return NextResponse.redirect(new URL(destination, request.url));
  }

  // Forward the identity this fresh, network-validated getUser() call just
  // confirmed via request headers, so protected Server Components can read
  // it instead of re-running their own getUser() — the same auth check,
  // just not repeated a second time per navigation. Rebuilt on top of
  // `request` (carrying the new headers) while preserving any cookies the
  // Supabase client already queued via setAll above.
  if (user) {
    request.headers.set("x-user-id", user.id);
    if (user.email) request.headers.set("x-user-email", user.email);
    const responseWithUser = NextResponse.next({ request });
    for (const cookie of supabaseResponse.cookies.getAll()) {
      responseWithUser.cookies.set(cookie);
    }
    supabaseResponse = responseWithUser;
  }

  return supabaseResponse;
}
