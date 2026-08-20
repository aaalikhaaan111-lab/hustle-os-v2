"use client";

import { useRef, useState } from "react";
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
import { signupAction, type SignupActionState } from "@/lib/actions/auth";

const initialState: SignupActionState = { error: null, code: null, status: "idle", email: null };

export function SignupForm() {
  const t = useTranslations("auth");
  // Where to go once the account exists. The landing composer sets this to
  // /create so the idea the visitor already typed is picked up on arrival;
  // without it Google sign-in ended on Overview and the idea was never read.
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? undefined;
  const tCommon = useTranslations("common");
  const [state, formAction, isPending] = useActionState(signupAction, initialState);
  const [consent, setConsent] = useState(false);
  const [showConsentNotice, setShowConsentNotice] = useState(false);
  const consentCheckboxRef = useRef<HTMLInputElement>(null);

  if (state.status === "awaiting_confirmation" && state.email) {
    return <ConfirmEmailPending email={state.email} />;
  }

  function handleConsentMissing() {
    setShowConsentNotice(true);
    consentCheckboxRef.current?.focus();
  }

  const consentLabel = (
    <span>
      {t("consentPrefix")}{" "}
      <Link href="/terms" target="_blank" className="s-link">
        {t("termsOfUse")}
      </Link>{" "}
      {t("and")}{" "}
      <Link href="/privacy" target="_blank" className="s-link">
        {t("privacyPolicy")}
      </Link>
    </span>
  );

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-8 py-12 sm:py-20">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="s-greet">{t("signupTitle")}</h1>
        <p className="s-body">{t("signupSubtitle")}</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-5 py-5">
          <div className="flex flex-col gap-2">
            <GoogleSignInButton
              label={t("signUpWithGoogle")}
              next={next}
              requireConsent
              consentGiven={consent}
              onConsentMissing={handleConsentMissing}
            />
            {/* 11px was the smallest text in the product, and it was being
                used for the notice that says what agreeing to Google sign-in
                means. Consent text is the last thing that should be hard to
                read. This is the `s-meta` size, like every other aside. */}
            <p className="s-meta text-center">{t("googleConsentNotice")}</p>
            {showConsentNotice && !consent && (
              <p role="alert" className="text-center text-[0.8125rem] font-medium text-danger">
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

            {/* The whole row is the target, not the box: `min-h-[44px]` and
                `py-2` give a thumb somewhere to land, since a 16px checkbox
                never was one. */}
            <label className="flex min-h-[44px] items-start gap-3 py-2 text-[0.8125rem] leading-relaxed text-ink-secondary">
              <input
                ref={consentCheckboxRef}
                type="checkbox"
                name="consent"
                checked={consent}
                onChange={(event) => {
                  setConsent(event.target.checked);
                  if (event.target.checked) setShowConsentNotice(false);
                }}
                className={`mt-0.5 h-5 w-5 shrink-0 rounded-[6px] border-border-strong text-accent focus:ring-2 focus:ring-accent/50 ${
                  showConsentNotice && !consent ? "ring-2 ring-danger" : ""
                }`}
              />
              {consentLabel}
            </label>

            {state.error && (
              <p role="alert" className="text-[0.9375rem] text-danger">
                {state.error}
              </p>
            )}
            <Button type="submit" pending={isPending} disabled={!consent} className="mt-1">
              {t("createAccount")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="s-body text-center">
        {t("alreadyHaveAccount")}{" "}
        <Link href="/login" className="s-link">
          {t("logIn")}
        </Link>
      </p>
    </div>
  );
}
