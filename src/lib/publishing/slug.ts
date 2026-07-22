import { createHash, randomBytes } from "node:crypto";

export const PUBLIC_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const RESERVED_SLUGS = new Set([
  "admin", "api", "auth", "build", "challenges", "contact", "cookies",
  "courses", "create", "dashboard", "delete-account", "first-session",
  "login", "onboarding", "p", "privacy", "profile", "projects", "settings",
  "signup", "terms", "workshops",
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

export function isPublicSlug(value: string): boolean {
  return value.length >= 2
    && value.length <= 64
    && PUBLIC_SLUG_PATTERN.test(value)
    && !RESERVED_SLUGS.has(value);
}
