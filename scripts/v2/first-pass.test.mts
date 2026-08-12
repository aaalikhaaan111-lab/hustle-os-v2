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
import { SANDBOX_ATTRIBUTE } from "../../src/lib/v2/app/sandbox";

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

/* ── 3. the validator refuses unambiguous global access ─────────────────── */

/**
 * NARROWED, AND THE ARGUMENT IS THE RUNTIME.
 *
 * The rule used to match a bare `parent.` / `top.` / `opener.` member access.
 * That refused three production generations, and those are ordinary variable
 * names — `const parent = node.parentElement` is not an escape. Telling a local
 * from the global needs scope analysis, and this layer is not what makes the
 * sandbox safe. Section 3b pins the boundary that is.
 *
 * What is left is the form no local can take: an explicitly global access.
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

function frameIssue(files: Record<string, string>): string | null {
  const result = validateGeneratedApp(app(files) as never);
  if (result.ok) return null;
  return result.issues.find((issue) => issue.code === "frame_escape")?.detail ?? null;
}
const escapes = (files: Record<string, string>) => frameIssue(files) !== null;

const REAL_ESCAPES: Array<[string, string]> = [
  ["window.parent", "export const d = window.parent.document;"],
  ["window.top", "export const t = window.top!.location.href;"],
  ["window.opener", "export const o = window.opener;"],
  ["globalThis.parent", "export const p = globalThis.parent.postMessage;"],
  ["self.top", "export const s = self.top;"],
  ["a spaced global access", "export const d = window . parent;"],
];
for (const [name, source] of REAL_ESCAPES) {
  check(`still refused: ${name}`, escapes({ "src/x.ts": source }), source);
}
check("still refused inside a JSX expression",
  escapes({ "src/x.tsx": "export default () => <div>{window.parent.location.href}</div>;" }));
check("and when safe locals share the file",
  escapes({ "src/x.ts": "export function f(n: any){ const parent = n.parentElement; parent.append(''); return window.top; }" }));

/* ── 3a. ordinary identifiers are not escapes ────────────────────────────── */

/**
 * Every one of these is a name a normal React component uses. The rule refused
 * three production generations for exactly this class.
 */
const LOCALS: Array<[string, string]> = [
  ["a local `parent` holding a DOM node",
    "export function f(node: any){ const parent = node.parentElement; parent.appendChild(node); }"],
  ["a local `top` holding a number",
    "export function f(rect: any){ const top = rect.top; return top.toFixed(1); }"],
  ["a local `opener`", "export function f(o: any){ const opener = o.open; return opener.call(null); }"],
  ["a destructured `parent`", "export function f({ parent }: any){ return parent.name; }"],
  ["a tree walk over the app's own data", "export const v = (n: any) => n.parent.value;"],
];
for (const [name, source] of LOCALS) {
  check(`not an escape: ${name}`, !escapes({ "src/x.ts": source }), source);
}

/* ── 4. prose is prose, wherever it sits ─────────────────────────────────── */

const PROSE: Array<[string, string, string]> = [
  ["a sentence ending in 'the top.'", "src/data/m.ts", 'export const tips = ["Clamp the board to the top."];'],
  ["a template literal", "src/data/m.ts", "export const t = `Sand the top. Then check the edge.`;"],
  ["a comment", "src/data/m.ts", "// always measure from the top.\nexport const x = 1;"],
  ["JSX text: 'the top.'", "src/x.tsx", "export default () => <p>Measure from the top. Then score.</p>;"],
  ["JSX text: 'the parent.'", "src/x.tsx", "export default () => <p>Ask the parent. Then wait.</p>;"],
  ["JSX text: 'Parent company'", "src/x.tsx", "export default () => <div>Parent company information</div>;"],
  // Even naming the forbidden thing in copy is copy.
  ["a string mentioning window.parent", "src/data/m.ts", 'export const s = ["Never use window.parent here."];'],
  ["a comment mentioning window.top", "src/data/m.ts", "// do not use window.top\nexport const x = 1;"],
];
for (const [name, path, source] of PROSE) {
  check(`no longer refused: ${name}`, !escapes({ [path]: source }), source);
}

/* ── 4b. the diagnostic says what matched ────────────────────────────────── */

/**
 * Three generations were refused by this rule and not one recorded which
 * characters tripped it, so none could be diagnosed without spending another
 * provider request. Server-side only — the person gets a translated sentence.
 */
{
  const detail = frameIssue({ "src/x.ts": "export const d = window.parent.document;" });
  check("the diagnostic quotes the match", (detail ?? "").includes("window.parent"), String(detail));
  check("with its surrounding context", (detail ?? "").includes("Found:"), String(detail));
  check("and stays bounded", (detail ?? "").length < 400, String((detail ?? "").length));
}
{
  // A long file must not drag its whole contents into the log.
  const filler = "const x = 1;\n".repeat(400);
  const detail = frameIssue({ "src/x.ts": `${filler}export const d = window.top;\n${filler}` });
  check("a long file still yields a short quote", (detail ?? "").length < 400, String((detail ?? "").length));
  check("and the quote contains the match", (detail ?? "").includes("window.top"));
}

/* ── 4c. the runtime boundary is what actually holds ─────────────────────── */

/**
 * The narrowing above is only defensible because none of the privileged
 * behaviours depend on the static rule. Each is pinned here.
 */
{
  const sandbox = read("src/lib/v2/app/sandbox.ts");
  const tokens = SANDBOX_ATTRIBUTE.split(" ").filter(Boolean);
  // Reading the parent DOM or its storage: both need same-origin.
  check("the frame never gets same-origin", !tokens.includes("allow-same-origin"), SANDBOX_ATTRIBUTE);
  // Navigating or controlling the embedder.
  check("and cannot navigate the top frame",
    !tokens.includes("allow-top-navigation") && !tokens.includes("allow-top-navigation-by-user-activation"),
    SANDBOX_ATTRIBUTE);
  check("it may only run scripts and submit its own forms",
    tokens.slice().sort().join(" ") === "allow-forms allow-scripts", SANDBOX_ATTRIBUTE);
  // The network, independently of anything the validator did or did not catch.
  check("the inner policy denies everything by default", /"default-src 'none'"/.test(sandbox));
  check("including every network transport", /"connect-src 'none'"/.test(sandbox));
  check("and any nested frame", /"frame-src 'none'"/.test(sandbox));

  // The one channel that does exist, and what bounds it.
  const protocol = read("src/lib/v2/app/protocol.ts");
  check("the parent checks the message came from that frame",
    /event\.source !== context\.expectedSource/.test(protocol));
  check("and that its origin is the opaque one", /event\.origin !== OPAQUE_ORIGIN/.test(protocol));
  check("and the envelope and protocol version",
    /data\.source !== PREVIEW_SOURCE/.test(protocol) && /data\.version !== PREVIEW_PROTOCOL_VERSION/.test(protocol));
  // Three shapes, none of which grants anything.
  for (const type of ["ready", "runtime-error", "size"]) {
    check(`it accepts "${type}"`, new RegExp(`case "${type}"`).test(protocol));
  }
  check("and nothing else", (protocol.match(/case "/g) ?? []).length === 3);

  // Exactly one listener in the product, and it is that one.
  const preview = read("src/components/workspace/AppPreview.tsx");
  check("the workspace frame validates through it", /parsePreviewMessage\(event/.test(preview));
  const publicView = read("src/components/publishing/PublicAppView.tsx");
  check("and the published view listens for nothing", !/addEventListener/.test(publicView));
}

/* ── 5. every other source rule is untouched ─────────────────────────────── */

/**
 * Only `frame_escape` opts into reading code alone. If a future edit marks
 * `network` or `storage` the same way, a project could hide `localStorage` in a
 * string and this would stop noticing.
 */
const validator = read("src/lib/v2/app/validate.ts");
check("exactly one rule reads code only", (validator.match(/codeOnly: true/g) ?? []).length === 1);
check("and it is the frame-escape rule",
  /code: "frame_escape",[\s\S]{0,1600}?codeOnly: true/.test(validator));

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
