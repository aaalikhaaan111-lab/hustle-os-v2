/**
 * The landing prompt's journey through authentication.
 *
 *   npx tsx scripts/auth-seed.test.mts
 *
 * The OAuth hop itself cannot be exercised from here — it needs a real Google
 * consent screen — so everything around it is pinned instead: the prompt is
 * held before authentication, read exactly once after it, and the project,
 * conversation and message it produces are all derived rather than random, so
 * a callback that runs twice cannot create a second of anything.
 *
 * The seed functions are executed. The idempotency rules live inside a
 * `"use server"` module, which may only export async functions, so they are
 * asserted against the source — each assertion names the exact identifier that
 * makes the guarantee true.
 */

import { readFileSync } from "node:fs";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

/* ── 1. the prompt is held across the auth round trip ───────────────────── */

// sessionStorage is the only thing seed.ts touches; a map stands in for it.
const store = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
  sessionStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
};

const { writeSeed, takeSeed, clearSeed } = await import("../src/lib/create/seed");

writeSeed("сделай сайт про домашние растения", null);
check("the prompt is persisted before authentication", store.size === 1);

// It has to survive the trip: nothing clears it on the way to the provider.
const first = takeSeed();
check("it is readable after authentication", first?.message === "сделай сайт про домашние растения");

// Consume-once is what stops a re-run of the callback replaying the prompt.
const second = takeSeed();
check("a second read finds nothing", second === null);
check("and the store is empty", store.size === 0);

// A stale seed is not replayed weeks later.
store.set("ventrio:create-seed", JSON.stringify({
  message: "old idea", startingPoint: null, ts: Date.now() - 31 * 60 * 1000,
}));
check("an expired seed is discarded", takeSeed() === null);

// Malformed storage must not throw into the auth flow.
store.set("ventrio:create-seed", "{not json");
check("malformed storage is ignored", takeSeed() === null);
writeSeed("   ", null);
check("an empty prompt is never stored", store.size === 0);
writeSeed("keep", null);
clearSeed();
check("clearSeed removes it", store.size === 0);

/* ── 2. the callback sends the person to the conversation, not Overview ─── */

const callback = read("src/app/auth/callback/route.ts");
const landing = read("src/components/landing/LandingComposer.tsx");
const signupForm = read("src/components/auth/SignupForm.tsx");
const authActions = read("src/lib/actions/auth.ts");

check("the landing composer asks to return to /create", /next=\$\{encodeURIComponent\("\/create"\)\}/.test(landing));
check("the signup form reads that destination", /searchParams\.get\("next"\)/.test(signupForm));
check("and hands it to the OAuth call", /next=\{next\}/.test(signupForm));
check("the callback honours it", /const safeNext = isSafeRedirectPath\(requestedNext\)/.test(callback));
check("Overview is only the fallback", /safeNext \?\? "\/dashboard"/.test(callback));
// An open redirect here would send the prompt to someone else's origin.
check("only local paths are accepted", /isSafeRedirectPath/.test(callback));
// The email path never lands on Overview either.
check("email sign-up also returns to /create", /emailRedirectTo: buildRedirectUrl\("\/auth\/callback\?next=\/create"\)/.test(authActions));

/* ── 3. running the callback twice cannot duplicate anything ────────────── */

const creation = read("src/lib/actions/creation.ts");
const createExperience = read("src/components/create/CreateExperience.tsx");

// The project id is a hash of (user, session), not a random uuid, so a second
// run of the same session resolves to the same row.
check(
  "the project id is derived from the session",
  /const projectId = stableUuid\(`\$\{user\.id\}:ventrio-creation:\$\{sessionId\}`\)/.test(creation),
);
check(
  "the conversation id is derived from the project",
  /const conversationId = stableUuid\(`\$\{projectId\}:creation-conversation-v1`\)/.test(creation),
);
// A duplicate insert is expected, not an error.
check(
  "a duplicate project insert is tolerated",
  /if \(error && error\.code !== "23505"\) return fail/.test(creation),
);
check(
  "a duplicate assistant message is tolerated",
  /if \(assistantError && assistantError\.code !== "23505"\)/.test(creation),
);
// The turn itself is replay-safe: the same request id returns the stored turn
// instead of calling the model again.
check(
  "a replayed turn returns the stored result",
  /if \(stage3\.lastRequestId === requestId && stage3\.turn\)/.test(creation),
);
check(
  "message ids are derived from the request id",
  /stableUuid\(`\$\{conversationId\}:user:\$\{requestId\}`\)/.test(creation),
);

/* ── 4. the prompt is submitted exactly once ────────────────────────────── */

check(
  "the seed is consumed once per mount",
  /seedConsumedRef\.current = true;/.test(createExperience),
);
check(
  "and it is always started, never left in the composer",
  /queueMicrotask\(\(\) => startFromSeed\(seed\.message, seed\.startingPoint\)\);/.test(createExperience),
);
// The old behaviour: with a draft in progress the seed was only pre-filled, so
// the prompt was never sent and the person landed in someone else's thread.
check(
  "a draft in progress no longer swallows the prompt",
  !/if \(initialDraft\?\.messages\?\.length\)[\s\S]{0,120}setInput\(seed\.message\)/.test(createExperience),
);
// A seed opens its own session, so it is its own project and conversation.
check(
  "a seed starts a fresh session",
  /const freshSession = crypto\.randomUUID\(\)/.test(createExperience),
);
check(
  "which is passed explicitly, not read back from state",
  /runTurn\(message, point, requestId, freshSession\)/.test(createExperience),
);

/* ── report ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`FAILED ${failures.length} of ${passed + failures.length}`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`auth seed: ${passed} checks passed`);
