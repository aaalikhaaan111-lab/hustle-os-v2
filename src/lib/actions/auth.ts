"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { syncLocaleCookieAfterLogin } from "@/lib/actions/locale";
import { buildRedirectUrl, isSafeRedirectPath } from "@/lib/site";
import {
  mapAuthError,
  signUpFoundExistingAccount,
  RESEND_COOLDOWN_SECONDS,
  type AuthFailure,
} from "@/lib/auth/errors";

export interface AuthActionState {
  error: string | null;
  /** The closed-set reason, so the interface can act on it, not just print it. */
  code: AuthFailure | null;
  /**
   * The address the attempt used, returned ONLY for `email_not_confirmed`.
   *
   * So the form can offer a new confirmation link without depending on client
   * state staying in step with the input — which it does not when a password
   * manager fills the field, and which React then wipes when it resets the form
   * after the action.
   *
   * Not an enumeration channel: this code is reached only when the credentials
   * were correct, and the value is the one the person just typed.
   */
  email?: string | null;
}

export interface SignupActionState extends AuthActionState {
  /**
   * `awaiting_confirmation` rather than `success`, because what happened is that
   * Ventrio asked Supabase to create an account — not that an email was
   * delivered. The old boolean was read as the second thing and the screen said
   * so.
   */
  status: "idle" | "awaiting_confirmation";
  email: string | null;
}

export interface ResendActionState {
  /**
   * `requested`, never `sent`.
   *
   * Verified against the live project: `auth.resend` returns no error for an
   * address that is already confirmed AND for one that does not exist, and
   * sends nothing in either case. Supabase does that deliberately, so that
   * resend cannot be used to discover which addresses have accounts. The
   * consequence is that a success here means "the request was accepted", and
   * there is no response Ventrio could inspect that would justify the word
   * "sent". So it does not use it.
   */
  status: "idle" | "requested" | "error";
  error: string | null;
  code: AuthFailure | null;
  /**
   * How long before another attempt is allowed, decided by the server.
   *
   * Present on failure as well as success — a rate-limited attempt is exactly
   * when the interface most needs to stop offering the button, and the previous
   * version left it live because it only restarted its timer on success.
   */
  retryAfterSeconds: number | null;
  /**
   * Increments on every dispatch.
   *
   * The client uses it to tell one result from the next, so a success message
   * from an earlier attempt cannot still be on screen while a later one is in
   * flight. Identity comparison on the state object happens to work today; a
   * counter says what is meant.
   */
  attempt: number;
}

function readCredentials(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  return { email, password };
}

/**
 * A failure code turned into something a person should read.
 *
 * Every branch goes through here, which is the point: there is no path from a
 * Supabase string to the screen.
 */
async function describeFailure(code: AuthFailure): Promise<string> {
  const t = await getTranslations("auth");
  switch (code) {
    case "invalid_credentials": return t("errorInvalidCredentials");
    case "email_not_confirmed": return t("errorEmailNotConfirmed");
    case "rate_limited": return t("errorRateLimited");
    case "invalid_email": return t("errorInvalidEmail");
    case "weak_password": return t("passwordTooShort");
    case "signup_disabled": return t("errorSignupDisabled");
    case "unavailable": return t("errorUnavailable");
  }
}

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const t = await getTranslations("auth");
  const { email, password } = readCredentials(formData);

  if (!email || !password) {
    return { error: t("enterEmailPassword"), code: null };
  }

  const supabase = await createClient();
  const { error, data } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // `code` travels with the message so the form can do more than print it —
    // an unconfirmed address is a dead end without a route to a new link, which
    // is the state a beta user reaches after never receiving the first one.
    const { code } = mapAuthError(error);
    return {
      error: await describeFailure(code),
      code,
      email: code === "email_not_confirmed" ? email : null,
    };
  }

  await syncLocaleCookieAfterLogin(supabase, data.user.id);

  // Return to whatever protected page sent the visitor to /login; otherwise
  // land on Overview, the authenticated home. It shows real work where there
  // is any and a first-project state where there is not, so nobody is pushed
  // into /create every time they sign in.
  const requestedNext = String(formData.get("next") ?? "");
  redirect(isSafeRedirectPath(requestedNext) ? requestedNext : "/dashboard");
}

export async function signupAction(
  _prevState: SignupActionState,
  formData: FormData
): Promise<SignupActionState> {
  const t = await getTranslations("auth");
  const { email, password } = readCredentials(formData);
  const consent = formData.get("consent") === "on";

  const idle = { status: "idle" as const, email: null };
  if (!email || !password) {
    return { error: t("enterEmailPassword"), code: null, ...idle };
  }
  if (password.length < 8) {
    return { error: t("passwordTooShort"), code: null, ...idle };
  }
  if (!consent) {
    return { error: t("consentRequired"), code: null, ...idle };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: buildRedirectUrl("/auth/callback?next=/create"),
    },
  });

  if (error) {
    const { code } = mapAuthError(error);
    return { error: await describeFailure(code), code, ...idle };
  }

  // Confirmation is off, or the address was already confirmed and the password
  // matched: there is a session, so there is nothing to wait for.
  if (data.session && data.user) {
    await syncLocaleCookieAfterLogin(supabase, data.user.id);
    redirect("/create");
  }

  /**
   * From here the two possible situations are deliberately indistinguishable.
   *
   * Either a new account was created and a confirmation link is on its way, or
   * the address already had an account — in which case Supabase returned no
   * error, a synthetic user with an empty `identities` array, and sent nothing
   * at all. Ventrio used to treat both as success and tell the person an email
   * had been sent. For the second case that was simply false, and it is the
   * report that came back from beta: "it says it sent one, nothing arrives".
   *
   * The fix is NOT to say which happened. Supabase withholds that distinction
   * so that signup cannot be used to discover which addresses have accounts,
   * and reporting it here would hand that back to anyone who asked. So the
   * state returned is identical either way, and the screen carries the honesty:
   * it states the condition rather than asserting a send, and it always offers
   * the way out for someone who already has an account.
   */
  if (data.user && signUpFoundExistingAccount(data.user)) {
    // Recorded for operators, never returned. Without this, "no email arrives"
    // is indistinguishable in the logs from a delivery failure.
    console.info("[ventrio-auth]", JSON.stringify({
      event: "signup_existing_address",
      at: new Date().toISOString(),
    }));
  }

  return { error: null, code: null, status: "awaiting_confirmation", email };
}

export async function resendConfirmationEmailAction(
  prevState: ResendActionState,
  formData: FormData
): Promise<ResendActionState> {
  const t = await getTranslations("auth");
  const email = String(formData.get("email") ?? "").trim();
  const attempt = (prevState?.attempt ?? 0) + 1;

  if (!email) {
    return {
      status: "error", error: t("enterEmailPassword"), code: null,
      retryAfterSeconds: null, attempt,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: buildRedirectUrl("/auth/callback?next=/create"),
    },
  });

  if (error) {
    const { code, retryAfterSeconds } = mapAuthError(error);
    return {
      status: "error",
      error: await describeFailure(code),
      code,
      /**
       * A rate-limited attempt still returns an interval, and the client seeds
       * its countdown from it. The previous version restarted the countdown
       * only on success, so a 429 left the button live and the person could
       * hammer it — every click failing, every click looking like it worked.
       *
       * Supabase's own interval when it gave one; the floor otherwise, because
       * re-enabling early is the failure mode that matters here.
       */
      retryAfterSeconds: code === "rate_limited"
        ? (retryAfterSeconds ?? RESEND_COOLDOWN_SECONDS)
        : retryAfterSeconds,
      attempt,
    };
  }

  /**
   * `requested`, and the copy says "if that address still needs confirming".
   *
   * Probed against the live project: resend returns no error for an address that
   * is already confirmed, and no error for one that has never existed. It sends
   * nothing in either case. There is therefore no response Ventrio can inspect
   * that would make "we sent you an email" a true sentence, so it does not say
   * it. The old green "Email resent." was wrong more often than it was right.
   */
  return {
    status: "requested",
    error: null,
    code: null,
    retryAfterSeconds: RESEND_COOLDOWN_SECONDS,
    attempt,
  };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function devAutoLoginAction(): Promise<AuthActionState> {
  if (process.env.NODE_ENV !== "development" || process.env.DEV_AUTO_LOGIN_ENABLED !== "true") {
    return { error: "Dev auto-login недоступен.", code: null };
  }

  const email = process.env.DEV_TEST_EMAIL;
  const password = process.env.DEV_TEST_PASSWORD;

  if (!email || !password) {
    return { error: "Задай DEV_TEST_EMAIL и DEV_TEST_PASSWORD в .env.local.", code: null };
  }

  const supabase = await createClient();
  const { error, data } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Development only, and the operator is the developer — but it goes through
    // the same mapping so there is exactly one path from a Supabase error to a
    // rendered string, and no second one to forget about.
    const { code } = mapAuthError(error);
    return { error: await describeFailure(code), code };
  }

  await syncLocaleCookieAfterLogin(supabase, data.user.id);

  redirect("/");
}
