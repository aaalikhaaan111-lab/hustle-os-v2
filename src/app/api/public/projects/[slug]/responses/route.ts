import { createHmac } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getUncachedPublicProject } from "@/lib/publishing/queries";
import { isPublicSlug } from "@/lib/publishing/slug";
import { validatePublicResponse } from "@/lib/publishing/validation";
import { createServiceClient } from "@/lib/supabase/public";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 16_000;

function response(status: string, httpStatus: number) {
  return NextResponse.json(
    { status },
    {
      status: httpStatus,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

function hasSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    return !!forwardedHost && new URL(origin).host === forwardedHost;
  } catch {
    return false;
  }
}

function trustedVisitorContext(request: NextRequest): string {
  // Vercel overwrites x-forwarded-for to prevent client IP spoofing and exposes
  // the same value as x-vercel-forwarded-for. Local development falls back to
  // x-real-ip, then a non-identifying placeholder.
  const ip = (
    request.headers.get("x-vercel-forwarded-for")
    ?? request.headers.get("x-forwarded-for")
    ?? request.headers.get("x-real-ip")
    ?? "unknown"
  ).trim().slice(0, 128);
  const userAgent = (request.headers.get("user-agent") ?? "unknown").trim().slice(0, 256);
  return `${ip}\n${userAgent}`;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  if (!hasSameOrigin(request)) return response("invalid", 403);
  const { slug } = await context.params;
  if (!isPublicSlug(slug)) return response("not_found", 404);

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return response("invalid", 413);
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_REQUEST_BYTES) return response("invalid", 413);
    body = JSON.parse(raw);
  } catch {
    return response("invalid", 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) return response("invalid", 400);
  const envelope = body as Record<string, unknown>;
  if (typeof envelope.website === "string" && envelope.website.trim()) {
    // Honeypot submissions receive a neutral success response.
    return response("accepted", 200);
  }

  let publication;
  try {
    publication = await getUncachedPublicProject(slug);
  } catch {
    return response("unavailable", 503);
  }
  if (!publication) return response("not_found", 404);
  const payload = validatePublicResponse(publication.output, envelope.values);
  if (!payload) return response("invalid", 400);

  const secret = process.env.SUBMISSION_RATE_LIMIT_SECRET;
  if (!secret || secret.length < 32 || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[public-response] Missing server-only submission configuration.");
    return response("unavailable", 503);
  }

  const submitterHash = createHmac("sha256", secret)
    .update(`${slug}\n${trustedVisitorContext(request)}`)
    .digest("hex");

  try {
    const service = createServiceClient();
    const { data, error } = await service.rpc("submit_public_project_response", {
      p_slug: slug,
      p_payload: payload,
      p_server_submitter_hash: submitterHash,
    });
    if (error) {
      console.error("[public-response] Database submission failed", { code: error.code });
      return response("unavailable", 503);
    }
    if (data === "accepted") return response("accepted", 200);
    if (data === "rate_limited") return response("rate_limited", 429);
    if (data === "not_found") return response("not_found", 404);
    return response("invalid", 400);
  } catch (error) {
    console.error("[public-response] Submission failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return response("unavailable", 503);
  }
}
