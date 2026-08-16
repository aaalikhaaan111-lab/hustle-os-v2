/**
 * Signup, verification, and the sentences Ventrio is allowed to say.
 *
 *   npx tsx --conditions=react-server scripts/auth-verification.test.mts
 *
 * THE BUG THIS EXISTS FOR. A beta user signs up, the screen says a confirmation
 * link was sent, and no email ever arrives. Probed against the live Supabase
 * project, three responses turned out to be indistinguishable from success:
 *
 *   - signUp on an address that already has an account returns NO error, a
 *     synthetic user with a freshly minted id, `session: null`, and an empty
 *     `identities` array. Nothing is sent.
 *   - resend for an address that is already confirmed returns NO error. Nothing
 *     is sent.
 *   - resend for an address that has never existed returns NO error. Nothing is
 *     sent.
 *
 * Supabase does that deliberately, so neither endpoint can be used to discover
 * which addresses have accounts. The consequence for the interface is that
 * "the backend indicated success" and "an email is coming" are different claims,
 * and only the first one is ever knowable. This file pins the code to the first.
 *
 * Offline. No network, no Supabase, no mail. The response shapes it asserts
 * against were taken from the live project, and are recorded here so a change in
 * them shows up as a failing test rather than as a beta report.
 */

import { readFileSync } from "node:fs";
import {
  mapAuthError,
  parseRetryAfterSeconds,
  signUpFoundExistingAccount,
  type AuthFailure,
} from "../src/lib/auth/errors";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const actions = read("src/lib/actions/auth.ts");
const actionsCode = code(actions);
const pending = read("src/components/auth/ConfirmEmailPending.tsx");
const pendingCode = code(pending);
const signupForm = code(read("src/components/auth/SignupForm.tsx"));
const loginForm = code(read("src/components/auth/LoginForm.tsx"));

/* ── 1. the existing-account response is recognised ──────────────────────── */

/**
 * The exact shape the live project returned. `identities: []` is the only
 * reliable signal — the id is real-looking but synthetic, and every other field
 * is indistinguishable from a genuine new signup.
 */
const EXISTING_ACCOUNT_USER = {
  id: "d47cea45-297e-49b9-bb22-7f9136660ac9",
  identities: [] as unknown[],
  email_confirmed_at: null,
  created_at: "2026-08-16T09:52:44.484059104Z",
};
const NEW_ACCOUNT_USER = {
  id: "1a9ed87c-f05d-4c4b-a3b7-3ca87b68f5b3",
  identities: [{ provider: "email", id: "x" }] as unknown[],
};

check("an empty identities array means the address already exists",
  signUpFoundExistingAccount(EXISTING_ACCOUNT_USER) === true);
check("a real new signup is not mistaken for an existing one",
  signUpFoundExistingAccount(NEW_ACCOUNT_USER) === false);
check("a null user is not an existing account", signUpFoundExistingAccount(null) === false);
check("a user with no identities field at all is not treated as existing",
  signUpFoundExistingAccount({} as { identities?: unknown[] }) === false,
  "guessing from an absent field would invent a state");

/* ── 2. false success is impossible ──────────────────────────────────────── */

/**
 * The word "sent" is not in the resend vocabulary any more, because there is no
 * response that would justify it. This is the check that stops it coming back.
 */
check('the resend state has no "sent" status',
  !/"sent"/.test(actionsCode),
  "a status called sent invites copy that claims a send Supabase never confirms");
check('the resend success status is "requested"', /"requested"/.test(actionsCode));
check("signup no longer reports a boolean success",
  !/success:\s*(true|false)/.test(actionsCode),
  "the old boolean was read as \"an email went out\"");
check('signup reports awaiting_confirmation', /"awaiting_confirmation"/.test(actionsCode));

const en = JSON.parse(read("messages/en.json")) as { auth: Record<string, string> };
const ru = JSON.parse(read("messages/ru.json")) as { auth: Record<string, string> };

check("the old unconditional success line is gone", en.auth.resendSuccess === undefined);
check("the signup screen no longer asserts a send",
  !/^we sent/i.test(en.auth.checkEmailDescription ?? ""),
  en.auth.checkEmailDescription);
check("it states the condition instead",
  /^if /i.test(en.auth.checkEmailDescription ?? ""),
  en.auth.checkEmailDescription);
check("the resend result does not claim delivery",
  !/\bsent\b/i.test(en.auth.resendRequested ?? "") || /if /i.test(en.auth.resendRequested ?? ""),
  en.auth.resendRequested);
check("the screen offers the way out for an existing account",
  typeof en.auth.checkEmailExisting === "string" && /log in/i.test(en.auth.checkEmailExisting));

/* ── 3. account enumeration is not reintroduced ──────────────────────────── */

/**
 * The temptation, having detected the existing account, is to say so. That
 * would undo the protection Supabase provides by withholding it: anyone could
 * then use the signup form to test whether an address has an account.
 *
 * So the detection exists only to decide what NOT to claim. The state returned
 * must be identical in both cases.
 */
check("the existing-account signal never reaches the client",
  !/alreadyRegistered|existingAccount|accountExists/i.test(
    actionsCode.replace(/signUpFoundExistingAccount/g, ""),
  ),
  "returning it would let the signup form be used to enumerate accounts");
check("it is recorded for operators instead",
  /signup_existing_address/.test(actions),
  "otherwise 'no email arrived' is indistinguishable from a delivery failure in the logs");

/* ── 4. no raw Supabase text reaches a person ────────────────────────────── */

check("no action returns a provider message directly",
  !/return\s*\{[^}]*error:\s*error\.message/.test(actionsCode),
  "Supabase wording changes between releases and states rules Ventrio does not have");
check("every failure goes through the shared describer",
  (actionsCode.match(/describeFailure\(/g) ?? []).length >= 4);
check("failures are mapped to a closed set", /mapAuthError\(/.test(actionsCode));

/* ── 5. the mapping itself ───────────────────────────────────────────────── */

const CASES: Array<[string, { status?: number; code?: string; message?: string }, AuthFailure]> = [
  ["invalid credentials, by code", { status: 400, code: "invalid_credentials", message: "Invalid login credentials" }, "invalid_credentials"],
  ["invalid credentials, by text only", { status: 400, message: "Invalid login credentials" }, "invalid_credentials"],
  ["unconfirmed email", { status: 400, code: "email_not_confirmed", message: "Email not confirmed" }, "email_not_confirmed"],
  ["unconfirmed email, by text only", { status: 400, message: "Email not confirmed" }, "email_not_confirmed"],
  ["email send rate limit", { status: 429, code: "over_email_send_rate_limit", message: "For security purposes, you can only request this after 47 seconds." }, "rate_limited"],
  ["request rate limit", { status: 429, code: "over_request_rate_limit", message: "Request rate limit reached" }, "rate_limited"],
  ["a 429 with no code at all", { status: 429, message: "Too many requests" }, "rate_limited"],
  ["the legacy security-purposes wording", { status: 400, message: "For security purposes, you can only request this after 12 seconds." }, "rate_limited"],
  ["weak password", { status: 422, code: "weak_password", message: "Password should be at least 6 characters." }, "weak_password"],
  ["invalid address", { status: 400, code: "email_address_invalid", message: "Unable to validate email address" }, "invalid_email"],
  ["signups closed", { status: 422, code: "signup_disabled", message: "Signups not allowed" }, "signup_disabled"],
  ["something nobody has seen", { status: 500, message: "kaboom" }, "unavailable"],
  ["no error object at all", {}, "unavailable"],
];
for (const [name, error, expected] of CASES) {
  check(`maps ${name}`, mapAuthError(error).code === expected, mapAuthError(error).code);
}
check("a null error is unavailable, not a crash", mapAuthError(null).code === "unavailable");

/* ── 6. the retry interval is the server's, and is bounded ───────────────── */

check("the real interval is read out of the message",
  parseRetryAfterSeconds("For security purposes, you can only request this after 47 seconds.") === 47);
check("a one-second interval parses", parseRetryAfterSeconds("after 1 second") === 1);
check("a message without one yields null", parseRetryAfterSeconds("Too many requests") === null);
check("no message yields null", parseRetryAfterSeconds(undefined) === null);
check("zero is not an interval", parseRetryAfterSeconds("after 0 seconds") === null);
/** It disables a control, so an absurd value must not disable it for an hour. */
check("an absurd interval is capped", parseRetryAfterSeconds("after 999999 seconds") === 600);

check("a rate limit carries its interval through the mapping",
  mapAuthError({ status: 429, message: "For security purposes, you can only request this after 47 seconds." }).retryAfterSeconds === 47);
check("a rate limit without one carries null from the mapping",
  mapAuthError({ status: 429, message: "Too many requests" }).retryAfterSeconds === null);

/* ── 7. the cooldown is honest, and covers failures ──────────────────────── */

check("the action returns an interval on failure too",
  /retryAfterSeconds:\s*code === "rate_limited"/.test(actionsCode),
  "restarting the countdown only on success left the button live after a 429");
check("a rate-limited result falls back to the floor rather than null",
  /retryAfterSeconds \?\? RESEND_COOLDOWN_SECONDS/.test(actionsCode));
check("the client seeds its countdown from the server's number",
  /setSecondsLeft\(state\.retryAfterSeconds/.test(pendingCode),
  "a locally invented countdown can be shorter than what the backend will accept");
check("the client restarts the countdown on every result, not only success",
  /state\.attempt !== seenAttempt/.test(pendingCode));
check("the action increments an attempt counter", /attempt\s*[,:]/.test(actionsCode));

/* ── 8. repeated rapid clicks cannot dispatch twice ──────────────────────── */

check("the button is disabled unless a resend is allowed", /disabled=\{!canResend\}/.test(pendingCode));
check("a resend is not allowed while one is pending", /secondsLeft <= 0 && !isPending/.test(pendingCode));
check("and the form refuses a submit that beats the re-render",
  /onSubmit=\{\(event\) => \{[\s\S]*?if \(!canResend\) event\.preventDefault\(\)/.test(pendingCode),
  "a double tap on a phone can land before React disables the button");

/* ── 9. loading, success and error cannot race ───────────────────────────── */

check("nothing is shown while a result is in flight",
  /isPending \|\| state\.attempt === 0 \? null : state/.test(pendingCode),
  "a success line from the previous attempt sat under a button reading Sending…");
check("the shown result is the current one", /result\?\.status === "requested"/.test(pendingCode));
check("the error shown is the current one", /result\?\.status === "error"/.test(pendingCode));

/* ── 10. an unconfirmed login is no longer a dead end ────────────────────── */

check("the login form recognises an unconfirmed address",
  /state\.code === "email_not_confirmed"/.test(loginForm));
check("and routes to the resend screen", /ConfirmEmailPending/.test(loginForm));
check("carrying the address it was given", /email=\{email\}/.test(loginForm));
check("that screen knows which way the person arrived", /reason="unconfirmed_login"/.test(loginForm));
check("and says something true for that case",
  /reason === "unconfirmed_login"/.test(pendingCode),
  'someone who has an account must not be told "if this address doesn\'t have an account yet"');

/* ── 11. the signup form follows the new state ───────────────────────────── */

check("the signup form waits on awaiting_confirmation",
  /state\.status === "awaiting_confirmation"/.test(signupForm));
check("it no longer reads a success boolean", !/state\.success/.test(signupForm));

/* ── 12. both locales carry every string ─────────────────────────────────── */

const REQUIRED = [
  "checkEmailTitle", "checkEmailDescription", "checkEmailExisting",
  "resendRequested", "resendButton", "resendSending", "resendIn",
  "errorInvalidCredentials", "errorEmailNotConfirmed", "errorRateLimited",
  "errorInvalidEmail", "errorSignupDisabled", "errorUnavailable", "passwordTooShort",
];
for (const key of REQUIRED) {
  check(`en: auth.${key}`, typeof en.auth[key] === "string" && en.auth[key].trim().length > 0);
  check(`ru: auth.${key}`, typeof ru.auth[key] === "string" && ru.auth[key].trim().length > 0);
}
check("the countdown copy interpolates the seconds", (en.auth.resendIn ?? "").includes("{seconds}"));
check("the Russian countdown copy does too", (ru.auth.resendIn ?? "").includes("{seconds}"));

/* ── 13. the authentication architecture is unchanged ────────────────────── */

check("signup still requires consent", /consentRequired/.test(actionsCode));
check("signup still enforces Ventrio's password length", /password\.length < 8/.test(actionsCode));
check("confirmation still redirects through the auth callback",
  /buildRedirectUrl\("\/auth\/callback/.test(actionsCode));
check("login still honours only safe redirect targets", /isSafeRedirectPath/.test(actionsCode));
check("dev auto-login is still gated on the environment",
  /NODE_ENV !== "development"/.test(actionsCode));

/* ── report ──────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} failed, ${passed} passed\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`✓ auth verification: ${passed} checks passed`);
