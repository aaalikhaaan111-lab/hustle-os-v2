"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { InfoIcon } from "@/components/ui/icons";
import { resendConfirmationEmailAction, type ResendActionState } from "@/lib/actions/auth";

const COOLDOWN_SECONDS = 60;

const initialState: ResendActionState = { status: "idle", error: null };

interface ConfirmEmailPendingProps {
  email: string;
}

export function ConfirmEmailPending({ email }: ConfirmEmailPendingProps) {
  const t = useTranslations("auth");
  const [state, formAction, isPending] = useActionState(resendConfirmationEmailAction, initialState);
  const [secondsLeft, setSecondsLeft] = useState(COOLDOWN_SECONDS);

  // Adjusting state during render (React's sanctioned alternative to an
  // effect for "reset state when a prop/value changes"): useActionState
  // hands back a new `state` object on every dispatch, so comparing against
  // the last-seen one lets us restart the countdown on every successful
  // resend — including back-to-back ones where status stays "sent" — without
  // the cascading-render effect the lint rule flags.
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.status === "sent") {
      setSecondsLeft(COOLDOWN_SECONDS);
    }
  }

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft((s) => Math.max(s - 1, 0)), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  const canResend = secondsLeft <= 0 && !isPending;

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-5 py-16 text-center animate-page-in">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
        <InfoIcon className="h-5 w-5" />
      </div>
      <div>
        <h1 className="text-xl font-semibold text-ink">{t("checkEmailTitle")}</h1>
        <p className="mt-2 text-sm text-ink-secondary">{t("checkEmailDescription")}</p>
        <p className="mt-1 text-sm font-semibold text-ink">{email}</p>
      </div>

      <form action={formAction} className="flex w-full flex-col items-center gap-2">
        <input type="hidden" name="email" value={email} />
        <Button type="submit" variant="secondary" disabled={!canResend} className="w-full">
          {isPending
            ? t("resendSending")
            : canResend
              ? t("resendButton")
              : t("resendIn", { seconds: secondsLeft })}
        </Button>
        {state.status === "sent" && <p className="text-sm text-success">{t("resendSuccess")}</p>}
        {state.status === "error" && state.error && (
          <p className="text-sm text-danger">{state.error}</p>
        )}
      </form>

      <div className="flex flex-col items-center gap-2">
        <Button href="/login" variant="secondary">
          {t("backToLogin")}
        </Button>
        <a href="/signup" className="text-xs font-medium text-ink-muted underline hover:text-ink">
          {t("changeEmail")}
        </a>
      </div>
    </div>
  );
}
