/**
 * Paddle billing: the signature, the events, and what may change a plan.
 *
 *   npx tsx --conditions=react-server scripts/paddle-billing.test.mts
 *
 * The rule this file exists to protect: NOTHING grants a plan except a verified
 * webhook. A checkout button that could upgrade an account, a success redirect
 * that trusted a query parameter, or a signature check that could be skipped
 * would each turn a paid feature into a free one for anyone who reads
 * JavaScript.
 *
 * Offline. Real HMACs over real payload shapes; no network, no Paddle.
 */

import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  HANDLED_EVENTS,
  WEBHOOK_MAX_AGE_MS,
  isHandledEvent,
  outcomeFromEvent,
  paddleClientConfig,
  parsePaddleSignature,
  verifyPaddleSignature,
} from "../src/lib/billing/paddle";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const SECRET = "pdl_ntfset_01_secret_value_for_tests_only";
const NOW = 1_760_000_000_000;
const sign = (body: string, secret = SECRET, atMs = NOW) => {
  const ts = Math.floor(atMs / 1000);
  const h1 = createHmac("sha256", secret).update(`${ts}:${body}`).digest("hex");
  return `ts=${ts};h1=${h1}`;
};

/* ── 1. signature verification ───────────────────────────────────────────── */

const body = JSON.stringify({ event_type: "subscription.created", data: { id: "sub_1" } });

check("a genuine signature verifies", verifyPaddleSignature(body, sign(body), SECRET, NOW));
check("a tampered body does not", verifyPaddleSignature(body + " ", sign(body), SECRET, NOW) === false);
check("a wrong secret does not", verifyPaddleSignature(body, sign(body, "other"), SECRET, NOW) === false);
check("a missing header does not", verifyPaddleSignature(body, null, SECRET, NOW) === false);
check("a malformed header does not", verifyPaddleSignature(body, "garbage", SECRET, NOW) === false);
check("an absent secret refuses everything", verifyPaddleSignature(body, sign(body), undefined, NOW) === false);

// Replay is bounded by the timestamp, not just the digest.
const stale = NOW - WEBHOOK_MAX_AGE_MS - 1000;
check("a stale signature is refused", verifyPaddleSignature(body, sign(body, SECRET, stale), SECRET, NOW) === false);
check("a recent one is accepted", verifyPaddleSignature(body, sign(body, SECRET, NOW - 1000), SECRET, NOW));

check("the header parser reads ts and h1", parsePaddleSignature(sign(body))?.ts !== undefined);
check("and rejects a non-hex digest", parsePaddleSignature("ts=1;h1=zz") === null);

/* ── 2. events map to plans ──────────────────────────────────────────────── */

const withData = (eventType: string, data: Record<string, unknown>) =>
  outcomeFromEvent({ event_type: eventType, data: { custom_data: { user_id: "user-1" }, ...data } });

check("every documented event is handled", HANDLED_EVENTS.length === 4);
for (const e of ["transaction.completed", "subscription.created", "subscription.updated", "subscription.canceled"]) {
  check(`${e} is handled`, isHandledEvent(e));
}
check("an unrelated event is not", !isHandledEvent("subscription.paused"));
check("and produces no outcome", withData("subscription.paused", { status: "paused" }) === null);

check("a completed transaction grants pro",
  withData("transaction.completed", { subscription_id: "sub_1" })?.plan === "pro");
check("an active subscription grants pro",
  withData("subscription.created", { id: "sub_1", status: "active" })?.plan === "pro");
check("a trialing subscription grants pro",
  withData("subscription.updated", { id: "sub_1", status: "trialing" })?.plan === "pro");
// Dunning is not cancellation: taking the product away mid-retry punishes a
// failed card rather than a decision.
check("past_due keeps pro", withData("subscription.updated", { id: "sub_1", status: "past_due" })?.plan === "pro");
check("cancellation returns to free",
  withData("subscription.canceled", { id: "sub_1", status: "canceled" })?.plan === "free");
check("and an unknown status is free, not pro",
  withData("subscription.updated", { id: "sub_1", status: "something_new" })?.plan === "free");

check("the subscription id is carried",
  withData("subscription.created", { id: "sub_1", status: "active" })?.subscriptionId === "sub_1");
check("a transaction points at its subscription",
  withData("transaction.completed", { subscription_id: "sub_9" })?.subscriptionId === "sub_9");
check("the user comes from custom_data",
  withData("subscription.created", { id: "s", status: "active" })?.userId === "user-1");
check("and is null when checkout attached none",
  outcomeFromEvent({ event_type: "subscription.created", data: { id: "s", status: "active" } })?.userId === null);
check("a non-object payload is refused", outcomeFromEvent("nope") === null);

/* ── 3. only the webhook may change a plan ───────────────────────────────── */

const route = read("src/app/api/webhooks/paddle/route.ts");
check("the route verifies before doing anything",
  route.indexOf("verifyPaddleSignature") < route.indexOf('.from("profiles")'));
check("an unverified request is refused with 401", /status: 401/.test(route));
check("it reads the raw body, never request.json()",
  /await request\.text\(\)/.test(route) && !/request\.json\(\)/.test(route));
check("it runs on the Node runtime for node:crypto", /runtime = "nodejs"/.test(route));

// The whole security property: no other file writes `plan`.
const writers = ["src/lib/actions/publishing.ts", "src/lib/actions/stage3.ts", "src/app/pricing/page.tsx",
  "src/components/billing/UpgradeButton.tsx", "src/lib/billing/userPlan.ts"];
for (const file of writers) {
  const src = read(file);
  check(`${file} never writes a plan`, !/\.update\(\s*\{[^}]*\bplan\b/.test(src));
}
check("the checkout button grants nothing itself",
  !/plan/.test(read("src/components/billing/UpgradeButton.tsx").replace(/\/\*[\s\S]*?\*\//g, "")));

// The webhook must not be wrapped in session middleware.
check("webhooks are excluded from the proxy matcher", /api\/webhooks\//.test(read("src/proxy.ts")));

/* ── 4. configuration ────────────────────────────────────────────────────── */

check("billing is off without a token",
  paddleClientConfig({ PADDLE_PRICE_ID: "pri_1" } as unknown as NodeJS.ProcessEnv) === null);
check("and off without a price",
  paddleClientConfig({ PADDLE_CLIENT_TOKEN: "live_x" } as unknown as NodeJS.ProcessEnv) === null);
check("a test token selects sandbox",
  paddleClientConfig({ PADDLE_CLIENT_TOKEN: "test_abc", PADDLE_PRICE_ID: "pri_1" } as unknown as NodeJS.ProcessEnv)?.environment === "sandbox");
check("a live token selects production",
  paddleClientConfig({ PADDLE_CLIENT_TOKEN: "live_abc", PADDLE_PRICE_ID: "pri_1" } as unknown as NodeJS.ProcessEnv)?.environment === "production");

// The server secret must never reach the browser.
check("the API key is not referenced client-side",
  !/PADDLE_API_KEY/.test(read("src/components/billing/UpgradeButton.tsx") + read("src/app/pricing/page.tsx")));
check("nor is the webhook secret",
  !/PADDLE_WEBHOOK_SECRET/.test(read("src/components/billing/UpgradeButton.tsx") + read("src/app/pricing/page.tsx")));

/* ── 5. the advertised price matches what is charged ─────────────────────── */

const pricing = read("src/app/pricing/page.tsx");
check("Pro advertises $19", /pro: "\$19"/.test(pricing));
check("Paddle checkout is only offered for Pro", /plan === "pro" && paddle/.test(pricing));
/*
 * Studio still has no checkout, which is what matters. The button used to say
 * so in its own label — "Upgrade to Studio (not open yet)" — and a call to
 * action advertising its implementation status makes the page read as
 * unfinished, so the reason moved to the note it points at. The state itself
 * is unchanged: disabled, and described by that note.
 */
check("Studio stays a pending state",
  /<button type="button" disabled aria-describedby="billing-note"/.test(pricing));
check("and the reason is still stated on the page",
  /id="billing-note"/.test(pricing) && /billingSoon/.test(pricing));

/* ── report ──────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`paddle billing: ${failures.length} failed, ${passed} passed`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`paddle billing: ${passed} checks passed`);
