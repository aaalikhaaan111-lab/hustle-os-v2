import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  localeFromAcceptLanguage,
  type Locale,
} from "@/i18n/locale";

// Locale resolution priority for a given request:
//   1. NEXT_LOCALE cookie — set on manual switch, and best-effort synced
//      from the user's saved profile preference right after login (see
//      src/lib/actions/auth.ts). A manual choice always wins from here on.
//   2. Accept-Language header (ru/kk -> ru, en -> en, else -> en).
// localStorage is client-only and cannot be read during server rendering;
// it is used purely as a client-side fallback (see LanguageSwitcher).
async function resolveLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) return cookieLocale;

  const headerList = await headers();
  return localeFromAcceptLanguage(headerList.get("accept-language"));
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale().catch(() => DEFAULT_LOCALE);

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
