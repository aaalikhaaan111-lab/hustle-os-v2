"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { syncLocaleCookieAfterLogin } from "@/lib/actions/locale";

export interface AuthActionState {
  error: string | null;
}

export interface SignupActionState extends AuthActionState {
  success: boolean;
}

function readCredentials(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  return { email, password };
}

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const t = await getTranslations("auth");
  const { email, password } = readCredentials(formData);

  if (!email || !password) {
    return { error: t("enterEmailPassword") };
  }

  const supabase = await createClient();
  const { error, data } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("id", data.user.id)
    .maybeSingle();

  await syncLocaleCookieAfterLogin(supabase, data.user.id);

  redirect(profile?.onboarding_completed_at ? "/dashboard" : "/onboarding");
}

export async function signupAction(
  _prevState: SignupActionState,
  formData: FormData
): Promise<SignupActionState> {
  const t = await getTranslations("auth");
  const { email, password } = readCredentials(formData);
  const consent = formData.get("consent") === "on";

  if (!email || !password) {
    return { error: t("enterEmailPassword"), success: false };
  }
  if (password.length < 8) {
    return { error: t("passwordTooShort"), success: false };
  }
  if (!consent) {
    return { error: t("consentRequired"), success: false };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: error.message, success: false };
  }

  if (data.session && data.user) {
    await syncLocaleCookieAfterLogin(supabase, data.user.id);
    redirect("/onboarding");
  }

  return { error: null, success: true };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function devAutoLoginAction(): Promise<AuthActionState> {
  if (process.env.NODE_ENV !== "development" || process.env.DEV_AUTO_LOGIN_ENABLED !== "true") {
    return { error: "Dev auto-login недоступен." };
  }

  const email = process.env.DEV_TEST_EMAIL;
  const password = process.env.DEV_TEST_PASSWORD;

  if (!email || !password) {
    return { error: "Задай DEV_TEST_EMAIL и DEV_TEST_PASSWORD в .env.local." };
  }

  const supabase = await createClient();
  const { error, data } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("id", data.user.id)
    .maybeSingle();

  await syncLocaleCookieAfterLogin(supabase, data.user.id);

  redirect(profile?.onboarding_completed_at ? "/dashboard" : "/onboarding");
}
