/**
 * From "the generation finished" to "you are looking at it".
 *
 *   npx tsx --conditions=react-server scripts/generation-handoff.test.mts
 *
 * THE BUG. On a real iPhone a generation completed and the workspace did not
 * show the result. The person went to Projects, opened the project again, and
 * only then saw the preview — for the thing they had just waited three minutes
 * for. That is the core loop failing at its most important moment.
 *
 * Three causes, and all three had to be fixed for the transition to be
 * deterministic:
 *
 *   1. NOTHING RECOVERED A SUSPENDED TAB. The poll was a bare setInterval.
 *      Generation takes two to four minutes, nobody watches that, and iOS
 *      throttles a backgrounded tab's timers to nothing — or restores the page
 *      from bfcache, where effects do not re-run at all.
 *   2. THE REFRESH WAS ONE SHOT. Guarded by project id, fired once per mount.
 *      The worker writes the application and finishes the job row separately, so
 *      a refresh landing in that gap came back with nothing — and nothing ever
 *      tried again.
 *   3. THE PANEL HONOURED A STALE PREFERENCE. `previewOpen` fell back to a
 *      stored flag, which on a phone is very often "closed", because there the
 *      preview replaces the conversation.
 *
 * Offline. Real-device behaviour is a real-device claim and is not asserted.
 */

import { readFileSync } from "node:fs";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const hook = code(read("src/lib/workspace/useFirstVersionJob.ts"));
const preOutput = code(read("src/components/build/PreOutputWorkspace.tsx"));
const buildScreen = code(read("src/components/workspace/BuildScreen.tsx"));
const handoff = read("src/lib/workspace/generationHandoff.ts");
const handoffCode = code(handoff);

/* ── 1. a suspended tab catches up ───────────────────────────────────────── */

check("the poll still runs while a job is in flight", /setInterval\(refresh/.test(hook));
check("the tab catches up when it becomes visible again",
  /visibilitychange/.test(hook),
  "iOS throttles a backgrounded tab's timers to nothing for minutes at a time");
check("and after a back/forward cache restore",
  /pageshow/.test(hook),
  "visibilitychange does not fire for a bfcache restore, where effects never re-run");
check("and on focus", /"focus"/.test(hook));
check("catching up is not gated on this tab's idea of being in flight",
  !/if \(!inFlight\) return;[\s\S]{0,200}visibilitychange/.test(hook),
  "that idea can be minutes stale, which is the whole problem");
check("it only asks while there is no result yet", /if \(hasOutput\) return;[\s\S]{0,400}visibilitychange/.test(hook));

/* ── 2. the arrival refresh is retried, and bounded ──────────────────────── */

check("the refresh is no longer one shot per project",
  !/refreshedForJob/.test(preOutput),
  "a single refresh that lands in the worker's write gap was terminal");
check("it retries a bounded number of times", /MAX_ARRIVAL_REFRESHES/.test(preOutput));
check("with a gap between attempts", /ARRIVAL_RETRY_MS/.test(preOutput));
check("and still stops, so the failure path cannot loop",
  /refreshAttempts\.current >= MAX_ARRIVAL_REFRESHES/.test(preOutput));
check("the first attempt is immediate", /attempt === 0 \? 0 : ARRIVAL_RETRY_MS/.test(preOutput));

/* ── 3. the preview opens, exactly once ──────────────────────────────────── */

check("the arrival is recorded before the refresh unmounts the screen",
  /markGenerationArrived\(projectId\)/.test(preOutput));
check("and the marker is set before router.refresh is scheduled",
  preOutput.indexOf("markGenerationArrived") < preOutput.indexOf("router.refresh"));

check("the panel reads the marker", /generationArrivedSnapshot\(projectId\)/.test(buildScreen));
check("a just-arrived generation opens the panel",
  /override \?\? \(justGenerated \|\| \(hasOutput && storedOpen\)\)/.test(buildScreen),
  "otherwise a stored 'closed' preference hides the result the person waited for");
check("an explicit toggle still wins", /override \?\?/.test(buildScreen));
check("the marker is per project", /KEY_PREFIX/.test(handoff) && /\$\{KEY_PREFIX\}\$\{projectId\}/.test(handoff));

/**
 * Exactly once is the requirement. Reading consumes, and the cache means React
 * calling the snapshot repeatedly — twice per render under StrictMode — cannot
 * consume twice or answer differently within a session.
 */
check("reading the marker consumes it", /removeItem\(key\(projectId\)\)/.test(handoff));
check("and the answer is stable once decided", /decided\.set\(projectId, found\)/.test(handoff));
check("the snapshot returns the cached answer on later calls",
  /const known = decided\.get\(projectId\);[\s\S]{0,120}if \(known !== undefined\) return known;/.test(handoff));

/**
 * `sessionStorage`, not `localStorage`. A marker that outlived the tab would
 * open the preview on some unrelated future visit — a different wrong behaviour
 * from the one being fixed.
 */
// Comments stripped: the file explains why it is not localStorage, and matching
// that sentence would pass the check by describing it.
check("the marker is scoped to the tab",
  /sessionStorage/.test(handoffCode) && !/localStorage/.test(handoffCode));
check("the server never claims a generation just arrived",
  /\(\) => false,/.test(buildScreen),
  "session storage does not exist there, and this tab is what witnessed the arrival");

/* ── 4. storage being unavailable degrades, never breaks ─────────────────── */

check("a refused write is survivable", /catch \{[\s\S]{0,200}\}/.test(handoff));
check("a refused read answers false", /catch \{\s*return false;/.test(handoff));

/* ── report ──────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} failed, ${passed} passed\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`✓ generation handoff: ${passed} checks passed`);
