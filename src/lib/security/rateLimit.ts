import "server-only";

import { createHmac } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/public";

/**
 * Burst limiting for the expensive and the abusable.
 *
 * THIS IS NOT QUOTA. `consume_ai_usage` and the plan entitlements cap what an
 * account may spend in a month and they stay exactly as they are — a request
 * has to pass both. What neither of them says anything about is a minute: an
 * account with thirty generations left can start all thirty in ten seconds.
 * That is what this covers.
 *
 * The counter lives in Postgres (`consume_rate_limit`) because Vercel gives
 * every request its own isolate; an in-memory map limits one lambda, not one
 * user, and the second concurrent request lands somewhere else and passes.
 *
 * FAIL-OPEN, DELIBERATELY. If the limiter itself errors the request proceeds.
 * A limiter that takes the product down when the database hiccups has turned a
 * defence into an outage, and every action behind this is ALSO protected by
 * quota, ownership checks and RLS — this is the outermost layer, not the only
 * one. The failure is logged so it cannot be silent.
 */

export interface RateLimitVerdict {
  allowed: boolean;
  /** Whole seconds until a slot frees. Suitable for `Retry-After`. */
  retryAfter: number;
  remaining: number;
}

const ALLOW: RateLimitVerdict = { allowed: true, retryAfter: 0, remaining: -1 };

/**
 * The limits, in one place so they can be read as a policy rather than found
 * scattered through call sites.
 *
 * Every number is a BURST ceiling, chosen to be invisible to a person using the
 * product normally and obstructive to a script. Generation is the most
 * expensive thing Ventrio does, so it is the tightest.
 */
export const RATE_LIMITS = {
  /** Starting a first-version build. Minutes of provider time each. */
  generation: { limit: 5, windowSeconds: 60 * 10 },
  /** Discovery and the project assistant: one provider call per turn. */
  ai_chat: { limit: 30, windowSeconds: 60 * 5 },
  /** Creating a project row. Cheap, but the entry point to everything above. */
  project_create: { limit: 20, windowSeconds: 60 * 10 },
  /** Publishing and unpublishing; hits subdomain routing and caches. */
  publish: { limit: 20, windowSeconds: 60 * 10 },
  /** Owner-side mutations that write rows but cost no provider time. */
  mutation: { limit: 120, windowSeconds: 60 },
} as const;

export type RateLimitAction = keyof typeof RATE_LIMITS;

/**
 * Who is being limited.
 *
 * A user id when there is one, because that survives a changed address and is
 * the thing plans attach to. Otherwise the caller's address, HMAC'd with the
 * same server secret the public submission path already uses — the table then
 * holds an opaque token rather than a log of who did what from where.
 */
export function rateLimitSubject(userId: string | null, ip?: string | null): string {
  if (userId) return `user:${userId}`;
  const secret = process.env.SUBMISSION_RATE_LIMIT_SECRET;
  const address = ip?.trim() || "unknown";
  if (!secret) return `ip:${address}`;
  return `ip:${createHmac("sha256", secret).update(address).digest("hex").slice(0, 32)}`;
}

/** The caller's address, from the proxy headers Vercel sets. */
export function clientAddress(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  return headers.get("x-real-ip");
}

export async function enforceRateLimit(
  action: RateLimitAction,
  subject: string,
): Promise<RateLimitVerdict> {
  const { limit, windowSeconds } = RATE_LIMITS[action];

  try {
    const service = createServiceClient();
    const { data, error } = await service.rpc("consume_rate_limit", {
      p_subject: subject,
      p_action: action,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });

    if (error) {
      console.warn("[ventrio-ratelimit]", JSON.stringify({
        event: "limiter_unavailable", action, code: error.code,
      }));
      return ALLOW;
    }

    const verdict = data as { allowed: boolean; retry_after: number; remaining: number };
    return {
      allowed: Boolean(verdict?.allowed),
      retryAfter: Number(verdict?.retry_after ?? 0),
      remaining: Number(verdict?.remaining ?? 0),
    };
  } catch (error) {
    console.warn("[ventrio-ratelimit]", JSON.stringify({
      event: "limiter_threw", action,
      error: error instanceof Error ? error.name : "unknown",
    }));
    return ALLOW;
  }
}

/** A 429 that tells the caller when to come back, for route handlers. */
export function tooManyRequests(verdict: RateLimitVerdict): Response {
  return new Response(
    JSON.stringify({ error: "rate_limited", retryAfter: verdict.retryAfter }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Retry-After": String(Math.max(1, verdict.retryAfter)),
        "Cache-Control": "no-store",
      },
    },
  );
}
