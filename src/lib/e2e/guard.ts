import "server-only";

/**
 * The guard between an end-to-end run and the wrong database.
 *
 * E2E writes real rows: a user, a project, a generation job, a usage
 * reservation. Against production that is not a test, it is damage, and the
 * only thing standing between the two is which URL happened to be in the
 * environment when the run started. A default is exactly the wrong shape of
 * safety here, so there isn't one.
 *
 * THREE CONDITIONS, all required, none inferred:
 *
 *   1. `VENTRIO_E2E=1` — the operator says this is a test run.
 *   2. `VENTRIO_E2E_SUPABASE_REF` — the operator names the project ref they
 *      expect to be talking to.
 *   3. The configured `NEXT_PUBLIC_SUPABASE_URL` actually resolves to that
 *      ref. Naming a target is not the same as pointing at one; this is the
 *      condition that catches the real mistake, which is an .env left over
 *      from something else.
 *
 * There is deliberately no fallback. A missing or mismatched ref fails the
 * run, and never quietly proceeds against whatever Supabase is configured.
 */

export type E2EGuard =
  | { ok: true; ref: string }
  | { ok: false; reason: string };

/** `https://abcdefgh.supabase.co` → `abcdefgh`. Null when it is not one. */
export function supabaseRefFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const match = /^https:\/\/([a-z0-9-]+)\.supabase\.(co|in)(?:\/|$)/i.exec(url.trim());
  return match ? match[1] : null;
}

/**
 * Decides whether an E2E run may touch the configured database.
 *
 * Returns the ref rather than any credential: callers need to know *which*
 * project they are on, and never need the key to say so. Nothing here reads,
 * logs or returns a secret.
 */
export function checkE2ETarget(env: NodeJS.ProcessEnv = process.env): E2EGuard {
  if (env.VENTRIO_E2E !== "1") {
    return { ok: false, reason: "VENTRIO_E2E is not set to 1. End-to-end runs must be opted into explicitly." };
  }

  const expected = env.VENTRIO_E2E_SUPABASE_REF?.trim();
  if (!expected) {
    return {
      ok: false,
      reason: "VENTRIO_E2E_SUPABASE_REF is not set. Name the staging project ref this run is allowed to write to.",
    };
  }

  const actual = supabaseRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL);
  if (!actual) {
    return { ok: false, reason: "NEXT_PUBLIC_SUPABASE_URL is missing or is not a Supabase project URL." };
  }

  if (actual !== expected) {
    // The refs are project identifiers, not secrets, and naming both is the
    // whole value of the message: "wrong database" is not actionable.
    return {
      ok: false,
      reason: `Refusing to run: configured Supabase project is "${actual}" but VENTRIO_E2E_SUPABASE_REF names "${expected}".`,
    };
  }

  return { ok: true, ref: actual };
}

/** The throwing form, for a script whose only correct response is to stop. */
export function requireE2ETarget(env: NodeJS.ProcessEnv = process.env): string {
  const result = checkE2ETarget(env);
  if (!result.ok) throw new Error(`[ventrio-e2e] ${result.reason}`);
  return result.ref;
}
