/**
 * From "the generation finished" to "you are looking at it".
 *
 *   npx tsx --conditions=react-server scripts/generation-handoff.test.mts
 *
 * THE BUG, TWICE. A generation completed on a real iPhone and the workspace did
 * not show the result; the person had to reopen the project from Projects. The
 * first fix did not work, and the reason is the reason this file is written the
 * way it is.
 *
 * That fix carried the arrival in a `sessionStorage` marker read through
 * `useSyncExternalStore`. A snapshot must be pure and stable, and reading
 * consumed the marker — so the read was cached in a module-level Map. But
 * `BuildScreen` is rendered from the first render by `PreOutputWorkspace`, long
 * before any generation finishes: the snapshot ran, found nothing, cached
 * `false`, and returned that for the life of the page. The generation then
 * completed, wrote its marker, and nothing ever re-read it.
 *
 * The tests passed. Every one of them asserted the SHAPE of that code — that a
 * marker was written, that a snapshot was read, that the names lined up — and
 * shape is exactly what was correct. So this file drives the store instead:
 * subscribe, announce, and check what a subscriber actually observes. A store
 * that never notifies fails here.
 *
 * Offline. Real-device behaviour is a real-device claim and is not asserted.
 */

import { readFileSync } from "node:fs";
import {
  chooseWorkspaceMode,
  chosenWorkspaceMode,
  resetWorkspaceModes,
  showGeneratedResult,
  subscribeWorkspaceMode,
} from "../src/lib/workspace/workspaceMode";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

/* ── 1. the store behaves, driven rather than described ──────────────────── */

const P = "project-1";
const OTHER = "project-2";

resetWorkspaceModes();
check("with no choice made, the store says so", chosenWorkspaceMode(P) === null);

/**
 * THE REGRESSION THAT MATTERS. A subscriber that reads before anything has
 * happened — which is what `BuildScreen` does on its first render — must still
 * see the arrival when it comes. The previous implementation cached that first
 * read and never changed its answer.
 */
{
  resetWorkspaceModes();
  let notifications = 0;
  const seen: Array<string | null> = [];
  const unsubscribe = subscribeWorkspaceMode(() => { notifications += 1; seen.push(chosenWorkspaceMode(P)); });

  // The first render, long before any generation finishes.
  const firstRead = chosenWorkspaceMode(P);
  check("the first read is empty, as it is on a fresh workspace", firstRead === null);

  showGeneratedResult(P);

  check("a subscriber is notified when the generation lands", notifications === 1, `${notifications} notifications`);
  check("and the value it then reads is preview", chosenWorkspaceMode(P) === "preview",
    "this is the exact assertion the cached snapshot failed");
  check("the notification carried the new value", seen[0] === "preview");
  unsubscribe();
}

/* ── 2. reading does not consume ─────────────────────────────────────────── */

{
  resetWorkspaceModes();
  showGeneratedResult(P);
  check("reading twice gives the same answer",
    chosenWorkspaceMode(P) === "preview" && chosenWorkspaceMode(P) === "preview",
    "a snapshot React calls repeatedly, twice per render under StrictMode, must be stable");
}

/* ── 3. an explicit switch still wins, in both directions ────────────────── */

{
  resetWorkspaceModes();
  showGeneratedResult(P);
  chooseWorkspaceMode(P, "chat");
  check("the person can go back to the conversation", chosenWorkspaceMode(P) === "chat");
  chooseWorkspaceMode(P, "preview");
  check("and forward again", chosenWorkspaceMode(P) === "preview");
}

/**
 * A generation that just landed overrides an earlier "chat". Someone who closed
 * the preview did not thereby ask to be kept from the result they then waited
 * three minutes for — and on a phone closing it is simply how you reach the
 * conversation.
 */
{
  resetWorkspaceModes();
  chooseWorkspaceMode(P, "chat");
  showGeneratedResult(P);
  check("an arrival beats a stale 'chat' choice", chosenWorkspaceMode(P) === "preview");
}

/* ── 4. choices do not leak between projects ─────────────────────────────── */

{
  resetWorkspaceModes();
  showGeneratedResult(P);
  check("another project is unaffected", chosenWorkspaceMode(OTHER) === null,
    "a finished generation must not open the preview on a project opened in the meantime");
}

/* ── 5. no redundant notifications ───────────────────────────────────────── */

{
  resetWorkspaceModes();
  let notifications = 0;
  const unsubscribe = subscribeWorkspaceMode(() => { notifications += 1; });
  chooseWorkspaceMode(P, "preview");
  chooseWorkspaceMode(P, "preview");
  check("setting the same mode twice notifies once", notifications === 1, `${notifications}`);
  unsubscribe();
  chooseWorkspaceMode(P, "chat");
  check("an unsubscribed listener stops hearing", notifications === 1, `${notifications}`);
}

/* ── 6. the wiring, which behaviour alone cannot show ────────────────────── */

const preOutput = code(read("src/components/build/PreOutputWorkspace.tsx"));
const buildScreen = code(read("src/components/workspace/BuildScreen.tsx"));
const hook = code(read("src/lib/workspace/useFirstVersionJob.ts"));

check("the screen that sees the job succeed announces it", /showGeneratedResult\(projectId\)/.test(preOutput));
check("before the refresh that unmounts it",
  preOutput.indexOf("showGeneratedResult") < preOutput.indexOf("router.refresh"));
check("the dead marker module is gone",
  !/generationHandoff/.test(preOutput) && !/generationHandoff/.test(buildScreen));

check("the panel subscribes to the store", /subscribeWorkspaceMode/.test(buildScreen));
check("and derives the panel from it", /chosen !== null/.test(buildScreen));
check("a phone shows the result by default once there is one",
  /hasOutput && \(narrow \|\| storedOpen\)/.test(buildScreen),
  "on desktop both surfaces are visible, so the remembered preference still decides");

/* ── 7. the tab still catches up after iOS suspends it ───────────────────── */

check("the poll recovers on visibility", /visibilitychange/.test(hook));
check("and after a bfcache restore", /pageshow/.test(hook));
check("the arrival refresh retries, bounded", /MAX_ARRIVAL_REFRESHES/.test(preOutput));

/* ── 8. the mode is stated, not implied ──────────────────────────────────── */

check("a phone gets a Chat/Preview switch", /<ModeSwitch/.test(buildScreen));
check("it is mobile only", /narrow && hasOutput && \(/.test(buildScreen));
check("it is a tablist to assistive tech", /role="tablist"/.test(buildScreen) && /role="tab"/.test(buildScreen));
check("with the active mode announced", /aria-selected=\{mode === value\}/.test(buildScreen));
for (const locale of ["en", "ru"]) {
  const messages = JSON.parse(read(`messages/${locale}.json`)) as { workspace: Record<string, string> };
  check(`${locale}: both mode labels exist`,
    !!messages.workspace.modeChat?.trim() && !!messages.workspace.modePreview?.trim());
}

/* ── report ──────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} failed, ${passed} passed\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`✓ generation handoff: ${passed} checks passed`);
