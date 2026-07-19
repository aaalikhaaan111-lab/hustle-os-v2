"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { ConfirmEmailPending } from "@/components/auth/ConfirmEmailPending";
import { signupAction, type SignupActionState } from "@/lib/actions/auth";

const initialState: SignupActionState = { error: null, success: false, email: null };

export function SignupForm() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const [state, formAction, isPending] = useActionState(signupAction, initialState);
  const [consent, setConsent] = useState(false);
  const [showConsentNotice, setShowConsentNotice] = useState(false);
  const consentCheckboxRef = useRef<HTMLInputElement>(null);

  if (state.success && state.email) {
    return <ConfirmEmailPending email={state.email} />;
  }

  function handleConsentMissing() {
    setShowConsentNotice(true);
    consentCheckboxRef.current?.focus();
  }

  const consentLabel = (
    <span>
      {t("consentPrefix")}{" "}
      <Link href="/terms" target="_blank" className="font-medium text-accent hover:text-accent-hover">
        {t("termsOfUse")}
      </Link>{" "}
      {t("and")}{" "}
      <Link href="/privacy" target="_blank" className="font-medium text-accent hover:text-accent-hover">
        {t("privacyPolicy")}
      </Link>
    </span>
  );

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-8 py-12 sm:py-20">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{t("signupTitle")}</h1>
        <p className="text-sm text-ink-secondary">{t("signupSubtitle")}</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-5 py-5">
          <div className="flex flex-col gap-2">
            <GoogleSignInButton
              label={t("signUpWithGoogle")}
              requireConsent
              consentGiven={consent}
              onConsentMissing={handleConsentMissing}
            />
            <p className="text-center text-[11px] leading-relaxed text-ink-muted">
              {t("googleConsentNotice")}
            </p>
            {showConsentNotice && !consent && (
              <p className="text-center text-xs font-medium text-danger">
                {t("googleConsentValidation")}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium text-ink-muted">{tCommon("or")}</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form action={formAction} className="flex flex-col gap-4">
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
            <Field label={t("password")} htmlFor="password" required hint={t("passwordHint")}>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="••••••••"
              />
            </Field>

            <label className="flex items-start gap-2.5 text-xs leading-relaxed text-ink-secondary">
              <input
                ref={consentCheckboxRef}
                type="checkbox"
                name="consent"
                checked={consent}
                onChange={(event) => {
                  setConsent(event.target.checked);
                  if (event.target.checked) setShowConsentNotice(false);
                }}
                className={`mt-0.5 h-4 w-4 shrink-0 rounded border-border-strong text-accent focus:ring-2 focus:ring-accent/40 ${
                  showConsentNotice && !consent ? "ring-2 ring-danger" : ""
                }`}
              />
              {consentLabel}
            </label>

            {state.error && <p className="text-sm text-danger">{state.error}</p>}
            <Button type="submit" disabled={isPending || !consent} className="mt-1">
              {isPending ? t("creatingAccount") : t("createAccount")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-ink-secondary">
        {t("alreadyHaveAccount")}{" "}
        <Link href="/login" className="font-medium text-accent hover:text-accent-hover">
          {t("logIn")}
        </Link>
      </p>
    </div>
  );
}
