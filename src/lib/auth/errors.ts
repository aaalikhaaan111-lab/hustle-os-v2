/**
 * Supabase auth failures, reduced to a closed set Ventrio has copy for.
 *
 * WHY THIS EXISTS. Every auth action used to return `error.message` straight
 * from Supabase when it did not recognise the failure. That put strings like
 * "Password should be at least 6 characters." in front of a person who was told
 * eight — Supabase's rule, not Ventrio's — and, less visibly, made the interface
 * depend on wording that changes between releases of a service we do not own.
 *
 * A closed set fixes both. The mapping is by `error.code` first, which is a
 * stable machine identifier, then by status, then by message text as a last
 * resort for older responses that carry no code. Anything unrecognised becomes
 * `unavailable` — a true statement that says nothing we are not sure of.
 *
 * Deliberately separate from the actions so it can be tested directly against
 * the shapes the service really returns.
 */

/** The failures the interface has something to say about. */
export type AuthFailure =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "rate_limited"
  | "invalid_email"
  | "weak_password"
  | "signup_disabled"
  | "unavailable";

export interface MappedAuthError {
  code: AuthFailure;
  /**
   * Seconds until another attempt is permitted, when the backend said so.
   *
   * Null when it did not. The interface must not invent one: a countdown that
   * disagrees with the server re-enables a button that will fail again, which
   * is how a person ends up clicking four times and believing four emails are
   * coming.
   */
  retryAfterSeconds: number | null;
}

/** The shape of a Supabase auth error, without depending on its class. */
export interface AuthErrorLike {
  status?: number;
  code?: string;
  message?: string;
}

/**
 * Supabase's own rate-limit sentence carries the number of seconds.
 *
 * "For security purposes, you can only request this after 47 seconds." It is
 * the only place the real interval is available — there is no Retry-After on
 * the client — so it is read rather than guessed. Bounded because it is used to
 * disable a control: a malformed or hostile value must not be able to disable
 * the resend button for an hour.
 */
export function parseRetryAfterSeconds(message: string | undefined): number | null {
  if (!message) return null;
  const match = /after (\d+) seconds?/i.exec(message);
  if (!match) return null;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.min(seconds, 600);
}

/** Codes Supabase returns for "too many requests", across versions. */
const RATE_LIMIT_CODES = new Set([
  "over_email_send_rate_limit",
  "over_request_rate_limit",
  "over_sms_send_rate_limit",
]);

const CODE_MAP: Record<string, AuthFailure> = {
  invalid_credentials: "invalid_credentials",
  email_not_confirmed: "email_not_confirmed",
  email_address_invalid: "invalid_email",
  validation_failed: "invalid_email",
  weak_password: "weak_password",
  signup_disabled: "signup_disabled",
  email_provider_disabled: "signup_disabled",
};

export function mapAuthError(error: AuthErrorLike | null | undefined): MappedAuthError {
  if (!error) return { code: "unavailable", retryAfterSeconds: null };

  const message = error.message ?? "";
  const retryAfterSeconds = parseRetryAfterSeconds(message);

  // 1. The machine code, which is what Supabase asks callers to branch on.
  if (error.code && RATE_LIMIT_CODES.has(error.code)) {
    return { code: "rate_limited", retryAfterSeconds };
  }
  if (error.code && CODE_MAP[error.code]) {
    return { code: CODE_MAP[error.code], retryAfterSeconds };
  }

  // 2. The status. 429 is a rate limit whatever else the body says.
  if (error.status === 429) return { code: "rate_limited", retryAfterSeconds };

  // 3. The text, for responses old enough to carry no code. Narrow on purpose:
  //    matching loosely here is how a wrong, confident message reaches a user.
  const text = message.toLowerCase();
  if (text.includes("for security purposes") || text.includes("rate limit")) {
    return { code: "rate_limited", retryAfterSeconds };
  }
  if (text.includes("email not confirmed")) {
    return { code: "email_not_confirmed", retryAfterSeconds: null };
  }
  if (text.includes("invalid login credentials")) {
    return { code: "invalid_credentials", retryAfterSeconds: null };
  }

  return { code: "unavailable", retryAfterSeconds };
}

/**
 * Whether a signUp response describes an address that already has an account.
 *
 * WHAT SUPABASE DOES, verified against the live project rather than assumed:
 * with email confirmation on, signing up with an address that already exists
 * returns NO error, a synthetic user carrying a freshly generated id that
 * matches no real account, `session: null`, and — the one reliable signal — an
 * empty `identities` array. No email is sent.
 *
 * That is what made the interface lie. Ventrio read "no error" as success and
 * showed "we sent a confirmation link" for a message that was never going to
 * arrive, which is exactly the report from beta.
 *
 * IMPORTANT: the answer is for the server's benefit, not the browser's. Supabase
 * shapes that response the way it does so that a stranger cannot use signup to
 * discover which addresses have accounts, and returning this to the client would
 * hand back exactly that. It is used to decide what NOT to claim, never to tell
 * anyone an account exists — see `signupAction`, which returns an identical
 * state either way.
 */
export function signUpFoundExistingAccount(user: { identities?: unknown[] | null } | null): boolean {
  return !!user && Array.isArray(user.identities) && user.identities.length === 0;
}
