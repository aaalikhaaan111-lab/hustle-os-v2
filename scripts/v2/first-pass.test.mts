/**
 * One provider request, and the two contract rules that kept costing it.
 *
 *   npx tsx --conditions=react-server scripts/v2/first-pass.test.mts
 *
 * V1 makes exactly one Gemini request per attempt. The repair stage is
 * implemented and tested, but it runs in a second queue invocation, and that
 * invocation has twice stopped executing altogether — heartbeats, the provider
 * abort and the consumer's own deadline all ceasing in the same instant until
 * the platform killed it. So the shipping configuration is one shot, and the
 * value of the run now rests entirely on the first pass being accepted.
 *
 * Which makes the gate's own accuracy the thing to protect. Two failures are
 * covered here:
 *
 *   frame_escape   the last production run was refused for it in a file of
 *                  woodworking advice strings. The rule reads `top.` at the end
 *                  of "measure from the top." as a frame escape. That is the
 *                  validator misreading prose, and no instruction to the model
 *                  can answer it.
 *   marker paths   a run before it opened src/data/checksData.ts and closed
 *                  src/data/woodData.ts.
 *
 * Offline.
 */

import { readFileSync } from "node:fs";
import { appSystemPrompt } from "../../src/lib/v2/app/prompt";
import { validateGeneratedApp } from "../../src/lib/v2/app/validate";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const generation = appSystemPrompt("react-spa");
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

/* ── 1. the prompt forbids reaching out of the frame ─────────────────────── */

check("the prompt has a section about the frame", /THE APP IS ALONE IN ITS FRAME/.test(generation));
for (const token of ["window.parent", "window.top", "window.opener", "parent.document", "top.document", "parent.postMessage"]) {
  check(`it names ${token}`, generation.includes(token), token);
}
check("it forbids message passing in either direction",
  /postMessage to any frame, or a listener for messages from one/.test(generation));
check("and says plainly that there is no approved API for it",
  /There is no approved API for\s+talking to it/.test(generation));
check("it explains the consequence", /is refused/.test(generation));

/* ── 2. the frame markers are illustrated, not just described ────────────── */

check("the prompt still states the closing-marker rule",
  /closing marker repeats the same path as the opening one/.test(generation));
// The rule was already there in prose when a run closed the wrong path, so it
// is now shown as a matched pair and a mismatched one.
check("it shows a correct pair", /CORRECT/.test(generation));
check("using the same path twice", (generation.match(/src\/data\/checksData\.ts/g) ?? []).length >= 3);
check("it shows the mismatch that was actually made",
  /WRONG — closes a different path than it opened/.test(generation) && generation.includes("src/data/woodData.ts"));

/* ── 3. the validator still refuses every real escape ────────────────────── */

/**
 * The change to `frame_escape` is what it *reads*, not what it forbids: string
 * literals and comments are blanked first, so prose is no longer mistaken for
 * code. Every genuine escape below must still be caught, or this is a hole
 * rather than a fix.
 */
const app = (files: Record<string, string>) => ({
  schemaVersion: "app-1",
  metadata: { name: "T", description: "d", locale: "en" },
  runtime: { template: "react-spa", dependencies: [] },
  routes: [{ path: "/", module: "src/App.tsx", title: "T" }],
  files: {
    "src/App.tsx": "export default function A(){return null;}",
    "src/styles.css": ".a{color:red}",
    ...files,
  },
});

function escapes(files: Record<string, string>): boolean {
  const result = validateGeneratedApp(app(files) as never);
  return !result.ok && result.issues.some((issue) => issue.code === "frame_escape");
}

const REAL_ESCAPES: Array<[string, string]> = [
  ["window.parent.document", "export const d = window.parent.document;"],
  ["window.top", "export const t = window.top.location.href;"],
  ["window.opener", "export const o = window.opener;"],
  ["bare parent.postMessage", "export function f(){ parent.postMessage(1, '*'); }"],
  ["bare top.document", "export const t = top.document.title;"],
  ["opener member access", "export const x = opener.closed;"],
];
for (const [name, source] of REAL_ESCAPES) {
  check(`still refused: ${name}`, escapes({ "src/x.ts": source }), source);
}
// Code is still code even when prose sits beside it.
check("still refused when prose shares the file",
  escapes({ "src/x.ts": 'export const s = "measure from the top."; export const d = window.top.location;' }));

/* ── 4. and no longer refuses prose that merely reads like it ────────────── */

const PROSE: Array<[string, string]> = [
  ["a sentence ending in 'the top.'", 'export const tips = ["Clamp the board to the top."];'],
  ["the same in a template literal", "export const t = `Sand the top. Then check the edge.`;"],
  ["the same in a comment", "// always measure from the top.\nexport const x = 1;"],
  ["'the parent.' in copy", 'export const c = ["Ask the parent. Then proceed."];'],
];
for (const [name, source] of PROSE) {
  check(`no longer refused: ${name}`, !escapes({ "src/data/m.ts": source }), source);
}
// The pre-existing exclusion must survive: walking your own data is not escape.
check("an ordinary tree walk still passes",
  !escapes({ "src/x.ts": "export const p = (n: { parent: { v: number } }) => n.parent.v;" }));

/* ── 5. every other source rule is untouched ─────────────────────────────── */

/**
 * Only `frame_escape` opts into reading code alone. If a future edit marks
 * `network` or `storage` the same way, a project could hide `localStorage` in a
 * string and this would stop noticing.
 */
const validator = read("src/lib/v2/app/validate.ts");
check("exactly one rule reads code only", (validator.match(/codeOnly: true/g) ?? []).length === 1);
check("and it is the frame-escape rule",
  /code: "frame_escape",[\s\S]{0,400}?codeOnly: true/.test(validator));

for (const [name, source, code] of [
  ["storage", "export const x = localStorage.getItem('a');", "storage"],
  ["network", "export const f = () => fetch('/a');", "network"],
  ["cookies", "export const c = document.cookie;", "cookies"],
  ["require", "export const r = require('fs');", "require"],
] as const) {
  const result = validateGeneratedApp(app({ "src/x.ts": source }) as never);
  check(`${name} is still refused`, !result.ok && result.issues.some((i) => i.code === code), source);
}

/* ── 6. one provider request per attempt ─────────────────────────────────── */

const run = read("src/lib/v2/app/runGeneration.ts");
const render = read("src/lib/v2/app/renderProject.ts");

check("a repair is only queued when the deploy allows one",
  /if \(verdict\.plan && appRepairEnabled\(\)\)/.test(run));
check("the flag is off unless explicitly set", /VENTRIO_APP_REPAIR === "1"/.test(render));
check("and the reason it is off is written down",
  /stop executing entirely|has twice been observed/.test(render + run));
// The repair code is kept, not deleted: it is the obvious thing to re-enable.
check("the repair stage still exists", /export async function runRepairPhase/.test(run));
check("and still claims its own provider request", /REPAIR_EXPECTS/.test(run));

/* ── report ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`FAILED ${failures.length} of ${passed + failures.length}`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`first pass: ${passed} checks passed`);
