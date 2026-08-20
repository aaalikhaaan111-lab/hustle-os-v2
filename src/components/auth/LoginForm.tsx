"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { ConfirmEmailPending } from "@/components/auth/ConfirmEmailPending";
import { loginAction, type AuthActionState } from "@/lib/actions/auth";

const initialState: AuthActionState = { error: null, code: null };

export function LoginForm() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const [state, formAction, isPending] = useActionState(loginAction, initialState);
  const searchParams = useSearchParams();
  const oauthErrorCode = searchParams.get("error");
  const oauthError = oauthErrorCode ? t("googleSignInFailed") : null;
  const displayError = state.error || oauthError;

  /**
   * An unconfirmed address is no longer a dead end: it used to be a red line
   * saying "not confirmed" with no way to request another link, shown to
   * precisely the person who never received the first one.
   *
   * The address comes back from the ACTION rather than from client state. State
   * here would have to track an input a password manager can fill without React
   * hearing about it, and React resets the form after the action anyway — so the
   * one value guaranteed to be right is the one the server was given.
   */
  if (state.code === "email_not_confirmed" && state.email) {
    return <ConfirmEmailPending email={state.email} reason="unconfirmed_login" />;
  }
  // Set by the proxy when an auth-required page redirected here — carried
  // through both sign-in paths so a successful login returns the visitor to
  // where they were headed instead of always landing on the default home.
  const next = searchParams.get("next") ?? undefined;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-8 py-12 sm:py-20">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="s-greet">{t("loginTitle")}</h1>
        <p className="s-body">{t("loginSubtitle")}</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-5 py-5">
          <div className="flex flex-col gap-2">
            <GoogleSignInButton label={t("continueWithGoogle")} next={next} />
            <p className="s-meta text-center">{t("googleConsentNotice")}</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium text-ink-muted">{tCommon("or")}</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form action={formAction} className="flex flex-col gap-4">
            {next && <input type="hidden" name="next" value={next} />}
            <Field label={t("email")} htmlFor="email" required>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder={t("emailPlaceholder")}
              />
            </Field>
            <Field label={t("password")} htmlFor="password" required>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
              />
            </Field>
            {displayError && (
              <p role="alert" className="text-[0.9375rem] text-danger">
                {displayError}
              </p>
            )}
            <Button type="submit" pending={isPending} className="mt-1">
              {t("loginTitle")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="s-body text-center">
        {t("noAccount")}{" "}
        <Link href="/signup" className="s-link">
          {t("signUp")}
        </Link>
      </p>
    </div>
  );
}
