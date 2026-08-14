/**
 * Where a published project lives.
 *
 * `[slug].ventrio.org` is the public address; `/p/[slug]` still resolves and
 * always will, because links people already shared must not rot. The subdomain
 * is the canonical one, so search engines and share sheets converge on it.
 *
 * ONE DEPLOYMENT, ONE DNS RECORD. A wildcard `*.ventrio.org` points at the same
 * Vercel project, and the proxy rewrites `sat-prep.ventrio.org/` to
 * `/p/sat-prep` internally. Nothing is created per project — no deployment, no
 * DNS record, no build — so publishing stays a database write.
 *
 * The slug is reused exactly as stored. `PUBLIC_SLUG_PATTERN` already produces
 * a valid DNS label (lowercase alphanumerics, internal hyphens, no leading or
 * trailing hyphen), which is why this needs no second identifier and no
 * migration of existing rows.
 */

import { isPublicSlug, RESERVED_SLUGS } from "@/lib/publishing/slug";
import { getSiteUrl } from "@/lib/site";

/**
 * The reserved names, under the name this module talks about them by.
 *
 * One set, defined in `slug.ts` because that is where slugs are minted and
 * validated. Two lists would drift, and the drift would be invisible until a
 * project claimed `www`.
 */
export const RESERVED_SUBDOMAINS = RESERVED_SLUGS;

/**
 * A DNS label is capped at 63 characters.
 *
 * The slug column allows up to 63 for exactly this reason. A longer slug would
 * be a perfectly good path segment and an unreachable hostname, which is the
 * kind of bug that only appears once someone names a project carefully.
 */
export const MAX_DNS_LABEL = 63;

/** Whether a slug can be published as `[slug].ventrio.org`. */
export function isPublishableSubdomain(slug: string): boolean {
  return isPublicSlug(slug)
    && slug.length <= MAX_DNS_LABEL
    && !RESERVED_SUBDOMAINS.has(slug);
}

/** The apex Ventrio runs on, without scheme or port — e.g. `ventrio.org`. */
export function rootHost(): string {
  return new URL(getSiteUrl()).host;
}

/**
 * The slug a hostname is asking for, or null when it is not a project host.
 *
 * Returns null for the apex itself, for `www`, for every other reserved name,
 * for anything that is not a direct child of the root, and for local
 * development hosts — which have no wildcard and must keep using `/p/[slug]`.
 *
 * Port-tolerant, because `localhost:3000` and preview hosts carry one.
 */
export function slugFromHost(host: string | null | undefined): string | null {
  if (!host) return null;
  const hostname = host.split(":")[0]!.toLowerCase();
  const root = rootHost().split(":")[0]!.toLowerCase();

  if (hostname === root) return null;
  if (!hostname.endsWith(`.${root}`)) return null;

  const label = hostname.slice(0, -(root.length + 1));
  // Only a direct child. `a.b.ventrio.org` is not a project.
  if (label.includes(".")) return null;
  if (!isPublishableSubdomain(label)) return null;
  return label;
}

/**
 * The address to show, copy and share for a published project.
 *
 * The subdomain when the slug can be one, the path form otherwise — a slug
 * that is reserved or too long is still perfectly publishable, it just keeps
 * the address it already had.
 */
export function publicProjectUrl(slug: string): string {
  const site = getSiteUrl();
  if (!isPublishableSubdomain(slug)) return `${site}/p/${slug}`;
  const url = new URL(site);
  return `${url.protocol}//${slug}.${url.host}`;
}

/** The canonical URL for `<link rel="canonical">` and Open Graph. */
export function canonicalProjectUrl(slug: string): string {
  return publicProjectUrl(slug);
}
