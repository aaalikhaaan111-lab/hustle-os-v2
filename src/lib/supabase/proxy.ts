import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/supabase";

const PROTECTED_PREFIXES = [
  "/create",
  "/projects",
  "/dashboard",
  "/challenges",
  "/courses",
  "/build",
  "/workshops",
  "/onboarding",
  "/first-session",
  "/profile",
];
const AUTH_ROUTES = ["/login", "/signup"];

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected = matchesPrefix(pathname, PROTECTED_PREFIXES);
  const isAuthRoute = matchesPrefix(pathname, AUTH_ROUTES);

  if (!user && isProtected) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && isAuthRoute) {
    // Returning users land on their collection; first-time users enter the
    // canonical AI creation flow instead of the retired learning onboarding.
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed_at")
      .eq("id", user.id)
      .maybeSingle();
    const destination = profile?.onboarding_completed_at ? "/projects" : "/create";
    return NextResponse.redirect(new URL(destination, request.url));
  }

  // Forward the identity this fresh, network-validated getUser() call just
  // confirmed via request headers, so protected Server Components can read
  // it instead of re-running their own getUser() — the same auth check,
  // just not repeated a second time per navigation. Rebuilt on top of
  // `request` (carrying the new headers) while preserving any cookies the
  // Supabase client already queued via setAll above.
  if (user) {
    request.headers.set("x-user-id", user.id);
    if (user.email) request.headers.set("x-user-email", user.email);
    const responseWithUser = NextResponse.next({ request });
    for (const cookie of supabaseResponse.cookies.getAll()) {
      responseWithUser.cookies.set(cookie);
    }
    supabaseResponse = responseWithUser;
  }

  return supabaseResponse;
}
