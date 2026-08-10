/**
 * The E2E environment guard.
 *
 *   npx tsx --conditions=react-server scripts/e2e-guard.test.mts
 *
 * An end-to-end run writes real rows — a user, a project, a job, a usage
 * reservation. Against production that is damage rather than a test, and the
 * only thing between the two is which URL was in the environment. Every case
 * below is a way that goes wrong.
 *
 * Offline.
 */

import { checkE2ETarget, requireE2ETarget, supabaseRefFromUrl } from "../src/lib/e2e/guard";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const STAGING = "https://ventriostaging1.supabase.co";
const OTHER = "https://bggkxahxogcdidbrnutx.supabase.co";

const env = (over: Record<string, string | undefined>): NodeJS.ProcessEnv => ({ ...over }) as NodeJS.ProcessEnv;

/* ── the ref parser ──────────────────────────────────────────────────────── */

check("reads a project ref from a Supabase URL", supabaseRefFromUrl(STAGING) === "ventriostaging1");
check("tolerates a trailing slash", supabaseRefFromUrl(`${STAGING}/`) === "ventriostaging1");
check("tolerates whitespace", supabaseRefFromUrl(`  ${STAGING}  `) === "ventriostaging1");
check("refuses a non-Supabase URL", supabaseRefFromUrl("https://example.com") === null);
check("refuses a lookalike host", supabaseRefFromUrl("https://evil.supabase.co.attacker.test") === null);
check("refuses http", supabaseRefFromUrl("http://ventriostaging1.supabase.co") === null);
check("refuses undefined", supabaseRefFromUrl(undefined) === null);

/* ── every way a run must be refused ─────────────────────────────────────── */

const REFUSED: Array<[string, NodeJS.ProcessEnv]> = [
  ["no opt-in at all", env({ NEXT_PUBLIC_SUPABASE_URL: STAGING, VENTRIO_E2E_SUPABASE_REF: "ventriostaging1" })],
  ["opt-in set to something else", env({ VENTRIO_E2E: "true", NEXT_PUBLIC_SUPABASE_URL: STAGING, VENTRIO_E2E_SUPABASE_REF: "ventriostaging1" })],
  ["no named target", env({ VENTRIO_E2E: "1", NEXT_PUBLIC_SUPABASE_URL: STAGING })],
  ["an empty named target", env({ VENTRIO_E2E: "1", NEXT_PUBLIC_SUPABASE_URL: STAGING, VENTRIO_E2E_SUPABASE_REF: "   " })],
  ["no Supabase configured", env({ VENTRIO_E2E: "1", VENTRIO_E2E_SUPABASE_REF: "ventriostaging1" })],
  ["a Supabase URL that is not one", env({ VENTRIO_E2E: "1", NEXT_PUBLIC_SUPABASE_URL: "https://example.com", VENTRIO_E2E_SUPABASE_REF: "ventriostaging1" })],
  // The mistake this exists for: staging named, a different project configured.
  ["staging named but another project configured", env({ VENTRIO_E2E: "1", NEXT_PUBLIC_SUPABASE_URL: OTHER, VENTRIO_E2E_SUPABASE_REF: "ventriostaging1" })],
];

for (const [name, e] of REFUSED) {
  const result = checkE2ETarget(e);
  check(`refused: ${name}`, !result.ok);
  check(`  with a reason`, !result.ok && result.reason.length > 20);
}

/* the mismatch message must name both, or "wrong database" is unactionable */
{
  const result = checkE2ETarget(env({ VENTRIO_E2E: "1", NEXT_PUBLIC_SUPABASE_URL: OTHER, VENTRIO_E2E_SUPABASE_REF: "ventriostaging1" }));
  check("the mismatch names the configured project", !result.ok && result.reason.includes("bggkxahxogcdidbrnutx"));
  check("and the expected one", !result.ok && result.reason.includes("ventriostaging1"));
}

/* ── the one way it is allowed ───────────────────────────────────────────── */

{
  const result = checkE2ETarget(env({ VENTRIO_E2E: "1", NEXT_PUBLIC_SUPABASE_URL: STAGING, VENTRIO_E2E_SUPABASE_REF: "ventriostaging1" }));
  check("allowed when opted in and matching", result.ok);
  check("and reports which project", result.ok && result.ref === "ventriostaging1");
}

check("the throwing form throws on a mismatch", (() => {
  try {
    requireE2ETarget(env({ VENTRIO_E2E: "1", NEXT_PUBLIC_SUPABASE_URL: OTHER, VENTRIO_E2E_SUPABASE_REF: "ventriostaging1" }));
    return false;
  } catch { return true; }
})());

/* ── it must never handle a secret ───────────────────────────────────────── */

{
  const source = (await import("node:fs")).readFileSync(new URL("../src/lib/e2e/guard.ts", import.meta.url), "utf8");
  check("the guard never reads a key", !/SERVICE_ROLE|PUBLISHABLE_KEY|API_KEY/.test(source));
  const result = checkE2ETarget(env({
    VENTRIO_E2E: "1", NEXT_PUBLIC_SUPABASE_URL: OTHER, VENTRIO_E2E_SUPABASE_REF: "ventriostaging1",
    SUPABASE_SERVICE_ROLE_KEY: "super-secret-value", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "another-secret",
  }));
  check("and no secret reaches the refusal message",
    !result.ok && !result.reason.includes("super-secret-value") && !result.reason.includes("another-secret"));
}

/* ── report ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`FAILED ${failures.length} of ${passed + failures.length}`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`e2e guard: ${passed} checks passed`);
