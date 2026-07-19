import type { Locale } from "@/i18n/locale";

// Shared shape for static content (video/challenge/quiz/lesson copy) that needs
// both an English and a Russian version, without pulling every string into the
// next-intl message files — those are for short, fixed UI labels, not long-form
// educational content.
export interface Localized<T = string> {
  en: T;
  ru: T;
}

export function pick<T>(value: Localized<T>, locale: Locale | string): T {
  return locale === "ru" ? value.ru : value.en;
}
