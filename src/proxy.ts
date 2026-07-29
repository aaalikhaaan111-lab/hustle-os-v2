import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { buildCspHeader } from "@/lib/security/csp";

export async function proxy(request: NextRequest) {
  // Mutated before updateSession runs so its own `NextResponse.next({ request })`
  // calls forward this header to the render — Server Components read it via
  // headers() to apply the same nonce to Next's own inline scripts.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  request.headers.set("x-nonce", nonce);

  const response = await updateSession(request);
  const isProd = process.env.NODE_ENV === "production";
  response.headers.set("Content-Security-Policy", buildCspHeader(nonce, isProd));
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
