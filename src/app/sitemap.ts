import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";
import { PUBLIC_SHELL_ROUTES } from "@/components/public/routes";

/**
 * The public pages, derived from the list that already decides which routes
 * ARE public.
 *
 * `PUBLIC_SHELL_ROUTES` is the same constant `AppShell` reads to decide whether
 * to stand down, so a page cannot become public without appearing here — the
 * alternative is a second hand-written list of URLs that silently stops
 * matching the site.
 *
 * The two auth routes are dropped: /login and /signup are public in the sense
 * that anyone may reach them, but a sign-in form is not a destination anyone
 * should arrive at from a search result.
 *
 * PUBLISHED PROJECTS ARE NOT LISTED HERE, deliberately. They are crawlable —
 * `robots.ts` does not disallow `/p/<slug>` — but enumerating every customer's
 * published slug in a machine-readable file at a fixed URL publishes a
 * directory of them, which is a different decision from "each page is public"
 * and is the owner's to make, not the platform's.
 */
const EXCLUDED = new Set<string>(["/login", "/signup"]);

/** How often each page genuinely changes, rather than a uniform guess. */
const CHANGE: Record<string, MetadataRoute.Sitemap[number]["changeFrequency"]> = {
  "/": "weekly",
  "/pricing": "monthly",
};

const PRIORITY: Record<string, number> = {
  "/": 1,
  "/pricing": 0.9,
  "/about": 0.7,
  "/who-its-for": 0.7,
  "/faq": 0.7,
  "/contact": 0.5,
};

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const now = new Date();

  return PUBLIC_SHELL_ROUTES.filter((route) => !EXCLUDED.has(route)).map((route) => ({
    url: route === "/" ? base : `${base}${route}`,
    lastModified: now,
    changeFrequency: CHANGE[route] ?? "yearly",
    priority: PRIORITY[route] ?? 0.3,
  }));
}
