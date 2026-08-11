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
  response.headers.set(
    "Content-Security-Policy",
    buildCspHeader(nonce, isProd, request.nextUrl.pathname),
  );
  return response;
}

/**
 * `.well-known/workflow/` is excluded deliberately.
 *
 * Those routes belong to the durable workflow runtime, which calls them
 * server-to-server to advance a run. Passing them through here would attach a
 * Supabase session refresh and a per-request CSP to machine traffic that has
 * neither a browser nor a user behind it, and `updateSession` would rewrite
 * cookies for a request that carries none.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|auth/callback|\\.well-known/workflow/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
