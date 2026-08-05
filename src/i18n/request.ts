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

export default getRequestConfig(async ({ requestLocale }) => {
  // An explicitly requested locale wins.
  //
  // This callback used to ignore its argument and always resolve from the
  // cookie, which quietly broke every server-side attempt to render in a
  // project's own language: `getTranslations({ locale: "ru" })` returned
  // English messages, because the config handed back the request's locale
  // regardless of what was asked for. Persisted copy — the "first version is
  // ready" message — was written in the account's language and stayed wrong.
  //
  // next-intl passes the locale through `requestLocale` for exactly this. The
  // cookie/Accept-Language resolution below remains the answer when nothing
  // specific was asked for, which is every ordinary page render.
  const requested = await requestLocale;
  const locale = isLocale(requested)
    ? requested
    : await resolveLocale().catch(() => DEFAULT_LOCALE);

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
