import { createHash, randomBytes } from "node:crypto";

export const PUBLIC_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Names a published project may never take.
 *
 * Two populations, both load-bearing. Route names (`app`, `login`, `dashboard`)
 * would collide with Ventrio's own surfaces. Infrastructure names (`www`,
 * `mail`, `mx`, `ns1`, `cdn`, `vercel`) matter because a slug is now also a
 * subdomain — `www.ventrio.org` serving a stranger's application is the worst
 * of them, and it was claimable before this list grew.
 *
 * Mirrored by a CHECK constraint on `project_publications.slug`. The database
 * is the one that cannot be bypassed; this gives a better error, earlier.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  // Ventrio's own surfaces
  "admin", "api", "app", "auth", "account", "billing", "blog", "build",
  "challenges", "contact", "cookies", "courses", "create", "dashboard",
  "delete-account", "docs", "first-session", "help", "login", "onboarding",
  "p", "pay", "pricing", "privacy", "profile", "projects", "settings",
  "signup", "status", "support", "terms", "workshops",
  // Infrastructure and hosting
  "assets", "cdn", "dev", "ftp", "imap", "mail", "mx", "ns1", "ns2", "pop",
  "smtp", "staging", "static", "test", "vercel", "www",
]);

const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh",
  з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts",
  ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

const UNUSABLE_NAMES = new Set([
  "untitled project",
  "new project",
  "project",
  "проект без названия",
  "новый проект",
]);

export function hasUsableProjectName(name: string): boolean {
  const normalized = name.trim().toLocaleLowerCase();
  return normalized.length >= 2 && !UNUSABLE_NAMES.has(normalized);
}

export function slugifyProjectName(name: string): string {
  const transliterated = Array.from(name.trim().toLocaleLowerCase())
    .map((character) => CYRILLIC[character] ?? character)
    .join("");

  let slug = transliterated
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, 56)
    .replace(/-+$/g, "");

  if (slug.length < 2) slug = "project";
  if (RESERVED_SLUGS.has(slug)) slug = `${slug}-project`;
  return slug;
}

export function slugCollisionCandidate(base: string, projectId: string, attempt: number): string {
  const suffix = attempt === 0
    ? createHash("sha256").update(projectId).digest("hex").slice(0, 4)
    : randomBytes(2).toString("hex");
  return `${base.slice(0, Math.max(2, 59 - suffix.length)).replace(/-+$/g, "")}-${suffix}`;
}

/**
 * A published slug is also a DNS label, so 63 is the ceiling, not 64.
 *
 * `[slug].ventrio.org` reuses this exact string (see publicUrl.ts). A 64-character
 * slug is a fine path segment and an unreachable hostname.
 */
export function isPublicSlug(value: string): boolean {
  return value.length >= 2
    && value.length <= 63
    && PUBLIC_SLUG_PATTERN.test(value)
    && !RESERVED_SLUGS.has(value);
}
