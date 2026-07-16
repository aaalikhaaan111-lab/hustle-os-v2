"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { buildRedirectUrl } from "@/lib/site";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47c-.28 1.5-1.13 2.78-2.4 3.63v3.02h3.89c2.27-2.09 3.58-5.17 3.58-8.84Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.89-3.02c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.94H1.27v3.11C3.25 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.29A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.29V6.6H1.27A11.98 11.98 0 0 0 0 12c0 1.94.46 3.77 1.27 5.4l4.01-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.35.61 4.6 1.8l3.45-3.45C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.27 6.6l4.01 3.11C6.23 6.88 8.88 4.77 12 4.77Z"
      />
    </svg>
  );
}

interface GoogleSignInButtonProps {
  label?: string;
  /** On signup, first-time Google sign-in still requires Terms/Privacy
   * consent — but instead of disabling the button outright (which read as
   * a broken, permanently-greyed-out control to real users), we let it stay
   * clickable and surface a validation message via onConsentMissing. */
  requireConsent?: boolean;
  consentGiven?: boolean;
  onConsentMissing?: () => void;
}

export function GoogleSignInButton({
  label,
  requireConsent,
  consentGiven,
  onConsentMissing,
}: GoogleSignInButtonProps) {
  const t = useTranslations("auth");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (requireConsent && !consentGiven) {
      onConsentMissing?.();
      return;
    }

    setError(null);
    setIsPending(true);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Deliberately NOT window.location.origin — Vercel preview
        // deployments each get a unique hash-based origin that can never
        // all be added to Supabase's Redirect URLs allowlist. Using an
        // unlisted origin makes Supabase silently fall back to its
        // configured Site URL instead of honoring `redirectTo`, which is
        // what stranded OAuth users on the landing page. The canonical
        // origin is always allowlisted, regardless of which URL the app
        // was actually opened from.
        redirectTo: buildRedirectUrl("/auth/callback"),
      },
    });

    if (error) {
      setError(error.message);
      setIsPending(false);
      return;
    }
    // On success, Supabase redirects the browser to Google's consent screen —
    // there's nothing more to do here, and isPending stays true until that
    // navigation happens.
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={handleClick}
        disabled={isPending}
        className="w-full"
      >
        <GoogleIcon />
        {isPending ? t("redirectingToGoogle") : (label ?? t("continueWithGoogle"))}
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
