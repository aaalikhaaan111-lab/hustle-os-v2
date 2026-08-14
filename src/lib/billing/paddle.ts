import { createHmac, timingSafeEqual } from "node:crypto";
import { type PlanId } from "@/lib/billing/plans";

/**
 * Paddle Billing, reduced to the three things Ventrio needs.
 *
 * No SDK. Checkout is Paddle.js loaded from their CDN by the client, and the
 * webhook is an HMAC this file verifies with `node:crypto` — a dependency would
 * add a supply-chain surface and a version to keep current for perhaps sixty
 * lines of work.
 *
 * WHAT PADDLE OWNS AND WHAT VENTRIO OWNS. Paddle owns prices, subscriptions,
 * invoices, tax and dunning. Ventrio stores none of that. It stores the answer
 * to one question — which plan is this account on — because that is the only
 * question the product asks (see `plans.ts`). The subscription id and status
 * are kept alongside it for support and reconciliation, never for entitlement
 * decisions.
 */

/** The only paid price wired today. Studio has no Paddle price yet. */
export const PADDLE_PRO_PLAN: PlanId = "pro";

export interface PaddleConfig {
  clientToken: string;
  priceId: string;
  /**
   * Sandbox or production, inferred rather than configured.
   *
   * Paddle prefixes sandbox credentials with `test_`. Inferring means the two
   * environments cannot disagree — a sandbox token with `environment:
   * "production"` fails at checkout with an error that names neither.
   */
  environment: "sandbox" | "production";
}

/** The client-side configuration, or null when billing is not configured. */
export function paddleClientConfig(env: NodeJS.ProcessEnv = process.env): PaddleConfig | null {
  const clientToken = env.PADDLE_CLIENT_TOKEN?.trim();
  const priceId = env.PADDLE_PRICE_ID?.trim();
  if (!clientToken || !priceId) return null;
  return {
    clientToken,
    priceId,
    environment: clientToken.startsWith("test_") ? "sandbox" : "production",
  };
}

/** Whether checkout can be offered at all. */
export function isBillingConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return paddleClientConfig(env) !== null;
}

/* ── webhook verification ─────────────────────────────────────────────────── */

/** How old a signed webhook may be. Bounds replay of a captured request. */
export const WEBHOOK_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * Parses `Paddle-Signature: ts=1700000000;h1=<hex>`.
 *
 * Returns null on anything malformed rather than guessing — a signature header
 * we cannot read is a request we cannot trust.
 */
export function parsePaddleSignature(header: string | null): { ts: string; h1: string } | null {
  if (!header) return null;
  const parts = new Map<string, string>();
  for (const segment of header.split(";")) {
    const index = segment.indexOf("=");
    if (index === -1) continue;
    parts.set(segment.slice(0, index).trim(), segment.slice(index + 1).trim());
  }
  const ts = parts.get("ts");
  const h1 = parts.get("h1");
  if (!ts || !h1 || !/^\d+$/.test(ts) || !/^[a-f0-9]{64}$/i.test(h1)) return null;
  return { ts, h1 };
}

/**
 * Whether this body really came from Paddle.
 *
 * The signed payload is `${ts}:${rawBody}` — the RAW body, byte for byte, which
 * is why the route reads `request.text()` and never `request.json()`. Parsing
 * and re-serialising changes whitespace and key order and the signature stops
 * matching, which looks exactly like an attack.
 *
 * Compared with `timingSafeEqual`, and the timestamp is checked so a captured
 * request cannot be replayed indefinitely.
 */
export function verifyPaddleSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string | undefined,
  now = Date.now(),
): boolean {
  if (!secret) return false;
  const parsed = parsePaddleSignature(signatureHeader);
  if (!parsed) return false;

  const ageMs = Math.abs(now - Number(parsed.ts) * 1000);
  if (!Number.isFinite(ageMs) || ageMs > WEBHOOK_MAX_AGE_MS) return false;

  const expected = createHmac("sha256", secret).update(`${parsed.ts}:${rawBody}`).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(parsed.h1.toLowerCase(), "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/* ── events ──────────────────────────────────────────────────────────────── */

export const HANDLED_EVENTS = [
  "transaction.completed",
  "subscription.created",
  "subscription.updated",
  "subscription.canceled",
] as const;
export type PaddleEventType = (typeof HANDLED_EVENTS)[number];

export function isHandledEvent(value: unknown): value is PaddleEventType {
  return typeof value === "string" && (HANDLED_EVENTS as readonly string[]).includes(value);
}

/**
 * Statuses that mean "this account is currently entitled to Pro".
 *
 * `past_due` is deliberately included: Paddle is still dunning, the person has
 * not cancelled, and taking the product away mid-retry punishes a failed card
 * rather than a decision. Paddle emits `canceled` when it gives up, and that is
 * where access ends.
 */
const ENTITLED_STATUSES = new Set(["active", "trialing", "past_due"]);

export interface SubscriptionOutcome {
  plan: PlanId;
  status: string;
  subscriptionId: string | null;
  customerId: string | null;
  userId: string | null;
}

/**
 * What an event means for the account, or null when it means nothing.
 *
 * The userId comes from `custom_data.user_id`, which checkout attaches. Paddle
 * echoes custom data back on every event for the transaction and subscription
 * it belongs to, so it is the linkage — an email match would break the moment
 * someone pays with a different address than they signed up with.
 */
export function outcomeFromEvent(payload: unknown): SubscriptionOutcome | null {
  if (!payload || typeof payload !== "object") return null;
  const event = payload as { event_type?: unknown; data?: Record<string, unknown> };
  if (!isHandledEvent(event.event_type) || !event.data) return null;

  const data = event.data;
  const custom = (data.custom_data ?? null) as Record<string, unknown> | null;
  const userId = typeof custom?.user_id === "string" ? custom.user_id : null;
  const customerId = typeof data.customer_id === "string" ? data.customer_id : null;

  // `subscription.*` carries its own id; a transaction points at one.
  const subscriptionId =
    typeof data.id === "string" && event.event_type.startsWith("subscription.")
      ? data.id
      : typeof data.subscription_id === "string"
        ? data.subscription_id
        : null;

  if (event.event_type === "subscription.canceled") {
    return { plan: "free", status: "canceled", subscriptionId, customerId, userId };
  }

  if (event.event_type === "transaction.completed") {
    // A completed payment for the subscription price. Paddle sends the
    // subscription events too, but this one arrives first on a fresh checkout
    // and getting someone into their plan promptly matters more than tidiness.
    return { plan: PADDLE_PRO_PLAN, status: "active", subscriptionId, customerId, userId };
  }

  const status = typeof data.status === "string" ? data.status : "unknown";
  return {
    plan: ENTITLED_STATUSES.has(status) ? PADDLE_PRO_PLAN : "free",
    status,
    subscriptionId,
    customerId,
    userId,
  };
}
