// Canonical production origin for building auth redirect URLs (email
// confirmation links, OAuth callbacks). Must exactly match a URL in the
// Supabase Dashboard's Authentication > URL Configuration > Redirect URLs
// allowlist, or Supabase silently falls back to its configured Site URL
// instead of honoring `emailRedirectTo` — which is what caused confirmed
// users to land back on the marketing/login page instead of the app.
const PRODUCTION_ORIGIN = "https://ventrio-one.vercel.app";

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
