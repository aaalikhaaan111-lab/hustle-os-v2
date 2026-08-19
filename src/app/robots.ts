import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

/**
 * What crawlers may read.
 *
 * DELIBERATELY PERMISSIVE ABOUT WHO. There is no user-agent blocklist here —
 * not for AI crawlers, not for anyone. Ventrio wants to be found, and a
 * blocklist assembled from a blog post is how a site quietly disappears from
 * an index somebody actually cared about.
 *
 * WHAT IS DISALLOWED is only the paths that are useless or harmful to index:
 *
 *   /api, /auth        machine endpoints; a crawler following them gets an
 *                      error page at best and burns crawl budget
 *   /dashboard, /projects, /create, /build, /settings, /profile,
 *   /delete-account    the signed-in product. These already redirect an
 *                      anonymous visitor to /login, so a crawler indexes a
 *                      login page under a dozen different URLs — duplicate
 *                      content pointing at nothing
 *   the app-document   the raw generated-app document under a published slug.
 *                      It is served as inert `text/plain` with
 *                      `X-Robots-Tag: noindex` already; disallowing it here
 *                      says the same thing one step earlier, so it is never
 *                      fetched at all
 *   /v2-gallery        a development surface that 404s in production
 *
 * Published projects (`/p/<slug>`) are NOT disallowed. They are public pages
 * their owners chose to put on the internet, and being findable is the point.
 */
export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/auth/",
          "/dashboard",
          "/projects",
          "/create",
          "/build",
          "/settings",
          "/profile",
          "/delete-account",
          "/v2-gallery",
          "/intake-preview",
          "/output-preview",
          "/p/*/app-document",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
