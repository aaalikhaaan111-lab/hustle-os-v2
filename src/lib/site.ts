// Canonical production origin for building auth redirect URLs (email
// confirmation links, OAuth callbacks). Must exactly match a URL in the
// Supabase Dashboard's Authentication > URL Configuration > Redirect URLs
// allowlist, or Supabase silently falls back to its configured Site URL
// instead of honoring `emailRedirectTo` — which is what caused confirmed
// users to land back on the marketing/login page instead of the app.
//
// This origin MUST also match the origin the browser actually loaded the
// app from when the OAuth flow starts. The PKCE code verifier is written
// to a cookie scoped to that origin by the browser client; if `redirectTo`
// then points the Google round-trip at a *different* origin, the callback
// request never carries that cookie and `exchangeCodeForSession` fails
// with "PKCE code verifier not found in storage". Keep this in sync with
// whichever domain is actually live in production.
//
// If the ventrio.org domain migration isn't finished yet, override via
// NEXT_PUBLIC_SITE_URL=https://ventrio-one.vercel.app instead of editing
// this constant.
const PRODUCTION_ORIGIN = "https://ventrio.org";

export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") return PRODUCTION_ORIGIN;
  return "http://localhost:3000";
}

export function buildRedirectUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getSiteUrl()}${normalizedPath}`;
}

// Guards the `next` param on /auth/callback so it can only ever point back
// into this app — never to an external host, which would turn it into an
// open-redirect vector.
export function isSafeRedirectPath(path: string | null): path is string {
  if (!path) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.includes("://")) return false;
  return true;
}
