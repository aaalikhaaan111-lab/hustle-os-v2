export const LOCALES = ["ru", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

// ru -> Russian, kk -> Russian (Kazakh translation not available yet),
// en -> English, anything else -> English.
export function localeFromLanguageTag(tag: string): Locale {
  const primary = tag.toLowerCase().split("-")[0];
  if (primary === "ru" || primary === "kk") return "ru";
  return "en";
}

// Parses an Accept-Language header ("ru-RU,ru;q=0.9,en;q=0.8") into the
// highest-quality supported locale, falling back to DEFAULT_LOCALE.
export function localeFromAcceptLanguage(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;

  const tags = header
    .split(",")
    .map((part) => {
      const [tag, qPart] = part.trim().split(";q=");
      return { tag: tag.trim(), quality: qPart ? parseFloat(qPart) : 1 };
    })
    .filter((entry) => entry.tag)
    .sort((a, b) => b.quality - a.quality);

  for (const { tag } of tags) {
    if (tag === "*") continue;
    return localeFromLanguageTag(tag);
  }

  return DEFAULT_LOCALE;
}
