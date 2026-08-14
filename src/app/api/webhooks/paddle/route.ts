import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/public";
import { outcomeFromEvent, verifyPaddleSignature } from "@/lib/billing/paddle";

/**
 * Paddle's webhook. The only thing that may change an account's plan.
 *
 * Nothing in the product writes `profiles.plan` except this route — not the
 * checkout button, not a success redirect, not the pricing page. A client can
 * be lied to; a signed webhook from Paddle cannot, and making it the single
 * writer means "did they actually pay" has exactly one answer.
 *
 * RAW BODY, NOT JSON. The signature covers the bytes Paddle sent. Parsing and
 * re-serialising reorders keys and normalises whitespace, and the signature
 * then fails in a way indistinguishable from an attack — so the body is read as
 * text, verified, and only then parsed.
 *
 * Node runtime because verification uses `node:crypto`, and excluded from the
 * proxy matcher because this is server-to-server traffic with no session, no
 * cookies and no CSP to attach.
 *
 * ALWAYS 200 ONCE VERIFIED. Paddle retries non-2xx responses. A payload we
 * verified but cannot act on — an unknown user, an event we do not handle — is
 * logged and acknowledged, because retrying it will not make it actionable and
 * a retry storm helps nobody. Only an unverified request is refused.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function log(event: string, fields: Record<string, unknown> = {}): void {
  // Ids, statuses and codes only — never the body, never the signature.
  console.log("[ventrio-paddle]", JSON.stringify({ event, at: new Date().toISOString(), ...fields }));
}

export async function POST(request: NextRequest) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) {
    log("not_configured");
    return NextResponse.json({ error: "billing not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  if (!verifyPaddleSignature(rawBody, request.headers.get("paddle-signature"), secret)) {
    log("rejected_signature");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    log("unparseable_body");
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const eventType = (payload as { event_type?: string })?.event_type;
  const outcome = outcomeFromEvent(payload);
  if (!outcome) {
    // Verified, but not an event this deploy acts on. Paddle sends many.
    log("ignored_event", { eventType });
    return NextResponse.json({ received: true }, { status: 200 });
  }

  if (!outcome.userId) {
    // Checkout attaches `custom_data.user_id`; without it there is nothing to
    // apply this to. Loud, because it means a checkout was opened wrongly.
    log("no_user_reference", { eventType, subscriptionId: outcome.subscriptionId });
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const service = createServiceClient();
  const { error } = await service
    .from("profiles")
    .update({
      plan: outcome.plan,
      subscription_status: outcome.status,
      paddle_subscription_id: outcome.subscriptionId,
      paddle_customer_id: outcome.customerId,
    })
    .eq("id", outcome.userId);

  if (error) {
    // The one case worth a retry: we know what to do and could not do it.
    log("update_failed", { eventType, userId: outcome.userId, code: error.code });
    return NextResponse.json({ error: "could not apply" }, { status: 500 });
  }

  log("applied", {
    eventType,
    userId: outcome.userId,
    plan: outcome.plan,
    status: outcome.status,
  });
  return NextResponse.json({ received: true }, { status: 200 });
}
