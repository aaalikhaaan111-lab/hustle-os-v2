import { readFileSync } from "node:fs";

/**
 * The burst limiter, proved against the real database.
 *
 * Quota caps a month; this caps a minute. The distinction matters because an
 * account with thirty generations remaining can start all thirty in ten
 * seconds, and every one is minutes of provider time.
 *
 * The structural half runs anywhere. The live half needs Supabase credentials
 * and skips without them, so the offline suite stays runnable.
 */
let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const helper = read("src/lib/security/rateLimit.ts");
const migration = read("supabase/migrations/20260820140000_add_rate_limits.sql");
const stage3 = read("src/lib/actions/stage3.ts");
const publishing = read("src/lib/actions/publishing.ts");

/* ── 1. it cannot be an in-process counter ───────────────────────────────── */

/**
 * Vercel gives every request its own isolate, so a Map in module scope limits
 * one lambda and the next concurrent request lands somewhere else and passes.
 */
check("the counter lives in Postgres, not in the process",
  /consume_rate_limit/.test(helper) && !/new Map\(|globalThis\.__/.test(helper),
  "an in-memory limiter does not limit anything on serverless");
check("and the count and the insert are atomic",
  /pg_advisory_xact_lock/.test(migration),
  "without a lock two concurrent requests both read 4-of-5 and both proceed");

/* ── 2. it cannot become a surveillance table ────────────────────────────── */

check("anonymous subjects are hashed, not stored raw",
  /createHmac\("sha256", secret\)/.test(helper) && /ip:\$\{createHmac/.test(helper));
check("the table is unreachable by the API roles",
  /enable row level security/.test(migration) &&
  /revoke all on public\.rate_limit_events from anon, authenticated/.test(migration) &&
  /revoke all on function public\.consume_rate_limit/.test(migration));

/* ── 3. it fails open, and says so ───────────────────────────────────────── */

/**
 * A limiter that takes the product down when the database hiccups has turned a
 * defence into an outage. Everything behind it is also protected by quota,
 * ownership and RLS.
 */
check("a limiter failure allows the request rather than breaking it",
  /return ALLOW;/.test(helper) && /limiter_unavailable/.test(helper) && /limiter_threw/.test(helper));

/* ── 4. the expensive paths are actually guarded ─────────────────────────── */

check("generation is burst-limited per account",
  /enforceRateLimit\("generation", rateLimitSubject\(user\.id\)\)/.test(stage3) &&
  /errorTooFast/.test(stage3),
  "the per-project ceilings do not stop twenty projects starting at once");
check("publishing is burst-limited",
  (publishing.match(/enforceRateLimit\("publish"/g) ?? []).length >= 3,
  "publish, update and unpublish all flip public routing");
check("a denied caller is told when to return",
  /Retry-After/.test(helper) && /status: 429/.test(helper));

/* ── 5. live behaviour ───────────────────────────────────────────────────── */

if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
  const { enforceRateLimit, RATE_LIMITS } = await import("../src/lib/security/rateLimit");
  const subject = `test:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const { limit } = RATE_LIMITS.generation;

  const verdicts = [];
  for (let i = 0; i < limit + 2; i++) verdicts.push(await enforceRateLimit("generation", subject));

  check("exactly the ceiling is allowed",
    verdicts.filter((v) => v.allowed).length === limit,
    `allowed ${verdicts.filter((v) => v.allowed).length} of ${limit}`);
  check("everything past it is denied",
    verdicts.slice(limit).every((v) => !v.allowed));
  check("and the denial carries a real retry window",
    verdicts.slice(limit).every((v) => v.retryAfter > 0 && v.retryAfter <= RATE_LIMITS.generation.windowSeconds));
  check("a different subject is unaffected",
    (await enforceRateLimit("generation", `${subject}:other`)).allowed,
    "limits must be per-subject, not global");
} else {
  console.log("  (live limiter checks skipped: no Supabase credentials)");
}

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} failed, ${passed} passed\n`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`✓ rate limits: ${passed} checks passed`);
