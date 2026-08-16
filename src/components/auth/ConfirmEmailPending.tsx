"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { InfoIcon } from "@/components/ui/icons";
import { resendConfirmationEmailAction, type ResendActionState } from "@/lib/actions/auth";
// Not from the action module: that file is "use server" and may export only
// async functions, so a shared constant has to live outside it.
import { RESEND_COOLDOWN_SECONDS } from "@/lib/auth/errors";

/**
 * Waiting for a confirmation link, honestly.
 *
 * THREE THINGS WENT WRONG HERE, all producing the same experience: a person
 * clicking a button that says it worked while no email exists.
 *
 *   1. The screen asserted that an email had been sent. Supabase does not tell
 *      us that — verified against the live project, it returns no error for an
 *      address that is already confirmed and no error for one that never
 *      existed, and sends nothing in either case. It does that deliberately, so
 *      that signup cannot be used to discover which addresses have accounts.
 *      The copy now states the condition rather than the send, and always
 *      offers the way out for someone who already has an account — which is
 *      what most of the "no email arrived" reports actually are.
 *   2. The countdown was a local guess that restarted only on success. A
 *      rate-limited attempt therefore left the button live and the person could
 *      hammer it: every click failing, every click looking like it had worked.
 *      The interval now comes from the server on every result, failures too.
 *   3. A success line from an earlier attempt stayed on screen while the next
 *      attempt was in flight. Messages are derived from the current result only
 *      and hidden while one is pending.
 */

const initialState: ResendActionState = {
  status: "idle",
  error: null,
  code: null,
  retryAfterSeconds: RESEND_COOLDOWN_SECONDS,
  attempt: 0,
};

interface ConfirmEmailPendingProps {
  email: string;
  /**
   * Whether the person arrived from signing up or from a login that failed on
   * an unconfirmed address. Same screen, different first line: someone in the
   * second case definitely has an account, and telling them a link is on its
   * way "if this address doesn't have an account yet" would be nonsense.
   */
  reason?: "signup" | "unconfirmed_login";
}

export function ConfirmEmailPending({ email, reason = "signup" }: ConfirmEmailPendingProps) {
  const t = useTranslations("auth");
  const [state, formAction, isPending] = useActionState(resendConfirmationEmailAction, initialState);

  /**
   * The countdown starts immediately, because a link was just requested on this
   * person's behalf — by the signup itself, or by the login that sent them here.
   */
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SECONDS);

  /**
   * Adjusting state during render: React's sanctioned alternative to an effect
   * for "reset when a value changes". `attempt` increments on every dispatch, so
   * this restarts the countdown for every result — success or failure — from the
   * interval the SERVER returned. That is the fix for a rate limit leaving the
   * button live: the client no longer holds an opinion about the interval.
   */
  const [seenAttempt, setSeenAttempt] = useState(state.attempt);
  if (state.attempt !== seenAttempt) {
    setSeenAttempt(state.attempt);
    setSecondsLeft(state.retryAfterSeconds ?? RESEND_COOLDOWN_SECONDS);
  }

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft((s) => Math.max(s - 1, 0)), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  const canResend = secondsLeft <= 0 && !isPending;

  /**
   * Only the current attempt's result is shown, and nothing while one is in
   * flight. Without the `isPending` guard, "the link is on its way" from the
   * last attempt sits under a button reading "Sending…" for the next one.
   */
  const result = isPending || state.attempt === 0 ? null : state;

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-5 py-16 text-center animate-page-in">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
        <InfoIcon className="h-5 w-5" />
      </div>
      <div>
        <h1 className="text-xl font-semibold text-ink">{t("checkEmailTitle")}</h1>
        <p className="mt-2 text-sm text-ink-secondary">
          {reason === "unconfirmed_login" ? t("errorEmailNotConfirmed") : t("checkEmailDescription")}
        </p>
        <p className="mt-1 text-sm font-semibold break-all text-ink">{email}</p>
      </div>

      <form
        action={formAction}
        className="flex w-full flex-col items-center gap-2"
        onSubmit={(event) => {
          // The button is disabled, but a double tap on a phone can land before
          // React has re-rendered it. Two dispatches would spend the account's
          // rate-limit budget on one intention, and report the second as a
          // failure the person did not cause.
          if (!canResend) event.preventDefault();
        }}
      >
        <input type="hidden" name="email" value={email} />
        <Button type="submit" variant="secondary" disabled={!canResend} className="w-full">
          {isPending
            ? t("resendSending")
            : canResend
              ? t("resendButton")
              : t("resendIn", { seconds: secondsLeft })}
        </Button>
        {result?.status === "requested" && (
          <p className="text-sm text-ink-secondary" role="status">{t("resendRequested")}</p>
        )}
        {result?.status === "error" && result.error && (
          <p className="text-sm text-danger" role="alert">{result.error}</p>
        )}
      </form>

      {/* The way out for someone who already has an account. Offering it costs
          nothing and needs no knowledge of which case this is — which is the
          point, because knowing would mean telling. */}
      <p className="text-xs leading-relaxed text-ink-muted">{t("checkEmailExisting")}</p>

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
