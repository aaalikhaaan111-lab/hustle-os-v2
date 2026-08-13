/**
 * One retry for a provider that said it was unavailable.
 *
 *   npx tsx --conditions=react-server scripts/v2/discovery-retry.test.mts
 *
 * On 2026-08-13 a first discovery turn failed with
 * `server_error:Gemini is unavailable (503).` and the Retry the person pressed
 * 3.7 seconds later hit the same degraded window. Nothing in this path retried,
 * so one transient 503 read as "the creation assistant is unavailable" — while
 * a direct probe with the same key returned 200, slowly.
 *
 * The transport runs for real against a scripted `fetch`, so what is asserted
 * is the number of requests actually issued and the reason actually returned.
 *
 * Offline. No network, no database, no provider.
 */

import { readFileSync } from "node:fs";
import { requestDiscoveryTurn } from "../../src/lib/v2/gemini/discovery";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

process.env.GEMINI_API_KEY = "AIzaSyFAKEKEYFAKEKEYFAKEKEYFAKEKEY0000000";
const realFetch = globalThis.fetch;

const geminiSaying = (text: string) => ({
  candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }],
  usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 40 },
  modelVersion: "gemini-3.6-flash-001",
});

/** Answers each call from a script, and counts how many were made. */
function scripted(responses: Array<{ status: number; payload: unknown }>) {
  const calls: number[] = [];
  globalThis.fetch = (async () => {
    const next = responses[Math.min(calls.length, responses.length - 1)];
    calls.push(next.status);
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      json: async () => next.payload,
      text: async () => JSON.stringify(next.payload),
    } as Response;
  }) as typeof globalThis.fetch;
  return calls;
}

const ask = () => requestDiscoveryTurn({
  system: "You are Ventrio's creation guide.",
  history: [{ role: "user", content: "привет. сгенерируй лендинг для инновационного банка Future" }],
});

const GOOD = geminiSaying(JSON.stringify({ phase: "ask", message: "Что именно?" }));

/* ── 1. 503 then success ─────────────────────────────────────────────────── */

{
  const calls = scripted([
    { status: 503, payload: { error: "unavailable" } },
    { status: 200, payload: GOOD },
  ]);
  const result = await ask();

  check("a 503 is retried", calls.length === 2, `${calls.length} request(s): ${calls.join(",")}`);
  check("and the second attempt is the answer", result.ok === true, result.ok ? "" : result.reason);
  check("the caller gets the model's value", result.ok && typeof result.value === "object");
}

/* ── 2. 503 twice: exactly one retry, then the fallback's reason ─────────── */

{
  const calls = scripted([
    { status: 503, payload: { error: "unavailable" } },
    { status: 503, payload: { error: "unavailable" } },
    { status: 200, payload: GOOD },
  ]);
  const result = await ask();

  check("it retries exactly once, never twice", calls.length === 2, `${calls.length} requests`);
  check("and reports the failure", result.ok === false);
  check(
    "with the reason the fallback path reads",
    !result.ok && result.reason.startsWith("server_error"),
    result.ok ? "" : result.reason,
  );
}

/* ── 3. answers, not accidents, are not retried ──────────────────────────── */

for (const [status, expected, why] of [
  [429, "rate_limited", "the account is over its allowance; asking again makes it worse"],
  [400, "client_error", "the request is wrong and will be wrong again"],
  [401, "client_error", "credentials do not become valid by repeating"],
  [403, "client_error", "neither does authorisation"],
] as const) {
  const calls = scripted([
    { status, payload: { error: String(status) } },
    { status: 200, payload: GOOD },
  ]);
  const result = await ask();

  check(`${status} is not retried`, calls.length === 1, `${why} — made ${calls.length} requests`);
  check(`${status} reports ${expected}`, !result.ok && result.reason.startsWith(expected), result.ok ? "" : result.reason);
}

/* ── 4. a 500 is transient too, and a good first call is not retried ─────── */

{
  const calls = scripted([{ status: 500, payload: {} }, { status: 200, payload: GOOD }]);
  const result = await ask();
  check("500 is retried like 503", calls.length === 2);
  check("and recovers", result.ok === true);
}
{
  const calls = scripted([{ status: 200, payload: GOOD }]);
  const result = await ask();
  check("a first-time success makes one request", calls.length === 1, `${calls.length}`);
  check("and succeeds", result.ok === true);
}

/* ── 5. quota is the caller's, and one turn stays one turn ───────────────── */

/**
 * The reservation happens in `generateCreationTurnAction` before this function
 * is entered, so a retry inside it cannot charge twice. Pinned at the source,
 * because the ordering is the guarantee.
 */
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const creation = read("src/lib/actions/creation.ts");
check(
  "the discovery turn is reserved before the provider is called",
  creation.indexOf('consumeAiUsage(user.id, "discovery_turn")') < creation.indexOf("requestDiscoveryTurn({"),
);
check(
  "and released once on failure",
  (creation.match(/releaseAiUsage\(user!\.id, "discovery_turn"\)/g) ?? []).length === 1,
);
check(
  "the retry lives below that boundary",
  !/consumeAiUsage|releaseAiUsage/.test(read("src/lib/v2/gemini/discovery.ts")),
  "discovery reaches into quota, so a retry could charge twice",
);

globalThis.fetch = realFetch;

if (failures.length > 0) {
  console.error(`discovery-retry: ${failures.length} failed, ${passed} passed`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`discovery-retry: ${passed} checks passed`);
