import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

function supabaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  return value;
}

export function createPublicClient() {
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!publishableKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");

  return createClient<Database>(supabaseUrl(), publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

export function createServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");

  return createClient<Database>(supabaseUrl(), serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
