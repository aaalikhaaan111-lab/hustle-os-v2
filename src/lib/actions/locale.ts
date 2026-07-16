"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { LOCALE_COOKIE, isLocale, type Locale } from "@/i18n/locale";
import type { Database } from "@/types/supabase";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// Called right after a successful login (see src/lib/actions/auth.ts). If
// this browser already has a locale cookie — from a manual switch or a
// previous visit — that choice wins and this is a no-op. Otherwise, on a
// fresh device/browser, this honors the user's saved profile preference so
// their language follows them across devices. Entirely isolated from the
// caller's own profile query (e.g. onboarding_completed_at): any failure
// here — most likely the migration not being applied yet — is caught
// locally and can never affect the login redirect it's called alongside.
export async function syncLocaleCookieAfterLogin(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<void> {
  const cookieStore = await cookies();
  if (isLocale(cookieStore.get(LOCALE_COOKIE)?.value)) return;

  try {
    const { data } = await supabase
      .from("profiles")
      .select("locale")
      .eq("id", userId)
      .maybeSingle();

    if (data && isLocale(data.locale)) {
      cookieStore.set(LOCALE_COOKIE, data.locale, {
        maxAge: ONE_YEAR_SECONDS,
        path: "/",
        sameSite: "lax",
      });
    }
  } catch {
    // profiles.locale doesn't exist yet (migration not applied) — ignore.
  }
}

// A manual choice always wins from here on — this is the only place a
// locale cookie is written outside of the one-time post-login sync in
// src/lib/actions/auth.ts, and that sync only ever fires when no cookie is
// present yet, so it can never clobber a manual selection made here.
export async function setLocaleAction(locale: string): Promise<void> {
  if (!isLocale(locale)) return;

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    maxAge: ONE_YEAR_SECONDS,
    path: "/",
    sameSite: "lax",
  });

  await syncLocaleToProfile(locale);
  revalidatePath("/", "layout");
}

// Best-effort: the `profiles.locale` column only exists once the additive
// migration (supabase/migrations/*_add_profile_locale.sql) has been applied.
// Until then this silently no-ops instead of breaking the language switch.
async function syncLocaleToProfile(locale: Locale): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("profiles").update({ locale }).eq("id", user.id);
  } catch {
    // Column not present yet, or user not authenticated — safe to ignore.
  }
}
