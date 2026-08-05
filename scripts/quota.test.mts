/**
 * Regression tests for the free generation allowance.
 *
 *   npx tsx scripts/quota.test.mts
 *
 * The old limit was one first-version generation per account, for life. It was
 * enforced and refunded correctly — the defect was the number and its
 * permanence: generate once and that account could never generate again, so
 * the only way to try Ventrio twice was to make a second account. It is now a
 * per-day allowance.
 *
 * The counter arithmetic itself lives in Postgres and is not reachable from
 * here. What these tests pin is the part that moved into application code: the
 * ledger key, the configured limit and its validation, and the rules that stop
 * a failed attempt from costing the user anything.
 */

import { readFileSync } from "node:fs";
import { AI_USAGE_LIMITS, isDailyMetric, usageKeyFor } from "../src/lib/ai/usageLimits";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const usage = read("src/lib/ai/usage.ts") + read("src/lib/ai/usageLimits.ts");
const jobs = read("src/lib/jobs/generationJobs.ts");
const workspaceUsage = read("src/lib/workspace/usage.ts");
const stage3 = read("src/lib/actions/stage3.ts");

const day1 = new Date("2026-08-06T10:00:00Z");
const day2 = new Date("2026-08-07T10:00:00Z");

/* ── 1. the allowance refills, and is not unlimited ─────────────────────── */

// From usageLimits, not usage: the latter is `server-only` and throws the
// moment a test touches it. The split exists so this arithmetic is reachable.

// Every allowance refills. Leaving any of them on a lifetime counter would
// just move the wall: a person out of discovery turns cannot start another
// conversation, however many generations they have left.
check("first-version generation refills daily", isDailyMetric("first_version_generation"));
check("editing an existing version refills too", isDailyMetric("project_edit"));
check("so do discovery turns", isDailyMetric("discovery_turn"));
check(
  "generating and editing remain separate allowances",
  usageKeyFor("first_version_generation", day1) !== usageKeyFor("project_edit", day1),
);

const limit = AI_USAGE_LIMITS.first_version_generation;
check("the default allowance is more than one", limit > 1, String(limit));
check("and is not unlimited", Number.isFinite(limit) && limit <= 25, String(limit));

// The number must come from configuration, not from a literal in the code —
// and never from a temporary value someone left behind.
check("the limit is read from the environment", /VENTRIO_FREE_GENERATIONS_PER_DAY/.test(usage));
check("no temporary 99 was committed", !/first_version_generation:\s*99/.test(usage));
check("there is a hard ceiling on the configured value", /MAX_FREE_GENERATIONS_PER_DAY/.test(usage));
check(
  "a bad value falls back rather than disabling metering",
  /!Number\.isFinite\(parsed\) \|\| parsed < 1/.test(usage),
);

/* ── 2. a day is a distinct ledger key ──────────────────────────────────── */

check("a daily metric is keyed by day", usageKeyFor("first_version_generation", day1).endsWith("2026-08-06"));
check(
  "a different day is a different key",
  usageKeyFor("first_version_generation", day1) !== usageKeyFor("first_version_generation", day2),
);
check(
  "the same day is the same key regardless of time",
  usageKeyFor("first_version_generation", new Date("2026-08-06T23:59:59Z"))
    === usageKeyFor("first_version_generation", day1),
);
check(
  "the key carries the day, not just the metric name",
  usageKeyFor("project_edit", day1) === `project_edit:2026-08-06`,
);

/* ── 3. a failed generation must not cost anything ──────────────────────── */

// Every failure branch releases; success never does. The SQL enforces the
// second half, this pins the first.
check("failures release the reservation", /releaseUsage\(job!\.id, "first_version_generation"\)/.test(stage3));
check(
  "the reservation is taken only after the job is claimed",
  stage3.indexOf("claimJob(") < stage3.indexOf("reserveUsage("),
);
check(
  "and before the provider is called",
  stage3.indexOf("reserveUsage(") < stage3.indexOf("messages: [{ role: \"user\""),
);
// A derived request id is what stops a replayed click creating a second job,
// a second charge and a second version.
check("the request id is derived, not random", /const requestId = `first-version:\$\{/.test(stage3));

/* ── 4. a refund lands on the day it was taken from ─────────────────────── */

// A job that reserves before midnight and fails after it must credit the day
// it took from. Crediting today would hand back a unit the previous day still
// holds — the user gains a generation and yesterday's counter stays stuck.
check(
  "release reads the reservation's own timestamp",
  /usage_reserved_at/.test(jobs) && /usageKeyFor\(metric, reservedAt\)/.test(jobs),
);
check("the reservation itself uses today's key", /p_metric: usageKeyFor\(metric\),/.test(jobs));

/* ── 5. what the user is told ───────────────────────────────────────────── */

const messages = Object.fromEntries(
  ["en", "ru"].map((locale) => [locale, JSON.parse(read(`messages/${locale}.json`)) as {
    stage3: Record<string, string>;
  }])
);
for (const locale of ["en", "ru"]) {
  const copy = messages[locale].stage3.firstVersionLimitReached;
  check(`${locale}: the limit message exists`, typeof copy === "string" && copy.length > 0);
  // It must state the number rather than hard-coding "one", and must say the
  // allowance comes back — the old copy said neither, which is what made it
  // read as a permanent wall.
  check(`${locale}: it states the actual limit`, /\{limit\}/.test(copy), copy);
  check(
    `${locale}: it says the allowance returns`,
    locale === "en" ? /resets|tomorrow/i.test(copy) : /обнов|завтра/i.test(copy),
    copy,
  );
  check(
    `${locale}: it no longer claims a single lifetime generation`,
    locale === "en" ? !/one free project generation/i.test(copy) : !/единственную/i.test(copy),
    copy,
  );
}

// The number shown has to be the number enforced, so it is passed from the
// server's own reservation result rather than re-derived in the client.
const preOutput = read("src/components/build/PreOutputWorkspace.tsx");
const create = read("src/components/create/CreateExperience.tsx");
check(
  "the message is given the server's limit",
  /firstVersionLimitReached", \{ limit: result\.limitReached\.limit \}/.test(preOutput)
    && /firstVersionLimitReached", \{ limit: generation\.limitReached\.limit \}/.test(create),
);

/* ── 6. the usage popover reads what the enforcer writes ────────────────── */

check(
  "the counter is read under the windowed key",
  /byMetric\.get\(usageKeyFor\(metric\)\)/.test(workspaceUsage),
);

/* ── 7. enforcement stays on the server ─────────────────────────────────── */

check("usage.ts is server-only", /import "server-only"/.test(usage));
check(
  "the counter is still moved through the service role",
  /createServiceClient\(\)/.test(usage) && /consume_ai_usage/.test(usage),
);
check(
  "a broken quota check still fails closed",
  /Fail closed/.test(usage) && /checkFailed: true/.test(usage),
);

/* ── report ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`FAILED ${failures.length} of ${passed + failures.length}`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`quota: ${passed} checks passed`);
