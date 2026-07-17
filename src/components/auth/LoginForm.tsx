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
import { loginAction, type AuthActionState } from "@/lib/actions/auth";

const initialState: AuthActionState = { error: null };

export function LoginForm() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const [state, formAction, isPending] = useActionState(loginAction, initialState);
  const searchParams = useSearchParams();
  const oauthErrorCode = searchParams.get("error");
  const oauthError = oauthErrorCode ? t("googleSignInFailed") : null;
  const displayError = state.error || oauthError;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-8 py-12 sm:py-20">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{t("loginTitle")}</h1>
        <p className="text-sm text-ink-secondary">{t("loginSubtitle")}</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-5 py-5">
          <div className="flex flex-col gap-2">
            <GoogleSignInButton label={t("continueWithGoogle")} />
            <p className="text-center text-[11px] leading-relaxed text-ink-muted">
              {t("googleConsentNotice")}
            </p>
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
            {displayError && <p className="text-sm text-danger">{displayError}</p>}
            <Button type="submit" disabled={isPending} className="mt-1">
              {isPending ? t("loggingIn") : t("loginTitle")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-ink-secondary">
        {t("noAccount")}{" "}
        <Link href="/signup" className="font-medium text-accent hover:text-accent-hover">
          {t("signUp")}
        </Link>
      </p>
    </div>
  );
}
