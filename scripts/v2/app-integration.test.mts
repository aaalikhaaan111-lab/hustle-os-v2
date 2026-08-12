/**
 * The app runtime, wired into the real generation action.
 *
 *   npx tsx --conditions=react-server scripts/v2/app-integration.test.mts
 *
 * What this protects is the integration, not the generator: that a generated
 * application survives a round trip through a project row, that reopening a
 * project re-runs the gate rather than trusting the database, and that the
 * action still has exactly one job, one reservation and one refund path.
 *
 * The lifecycle assertions are made against the action's source. They are
 * coarse on purpose — the alternative is a Supabase instance in a unit test,
 * and what actually needs protecting is that nobody adds a second `claimJob`
 * or a second `reserveUsage` to the new branch.
 *
 * Offline. No provider, no database.
 */

import { readFileSync } from "node:fs";
import { APP_STATE_KEY, APP_STATE_VERSION, mergeAppState, parseAppState, readAppState, type AppProjectState } from "../../src/lib/v2/app/projectState";
import { appRuntimeEnabled, composeAppBrief } from "../../src/lib/v2/app/renderProject";
import { TIMELINE_APP } from "../../src/lib/v2/app/fixtures/timeline";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const state: AppProjectState = {
  version: APP_STATE_VERSION,
  kind: "app" as const,
  app: TIMELINE_APP,
  generatedAt: "2026-08-11T10:00:00.000Z",
  model: "gemini-3.6-flash",
};

/* ── 1. a generated application survives the project row ─────────────────── */

{
  const snapshot = mergeAppState({ solution: "kept", audience: "kept" }, state);
  check("merging leaves existing snapshot fields alone",
    snapshot.solution === "kept" && snapshot.audience === "kept");
  check("and stores the state under its own key", APP_STATE_KEY in snapshot);

  // The round trip a reload actually performs: object → JSON → object.
  const reloaded = readAppState(JSON.parse(JSON.stringify(snapshot)));
  check("the state reads back", !!reloaded);
  check("byte-identical source survives",
    JSON.stringify(reloaded?.app.files) === JSON.stringify(TIMELINE_APP.files));
  check("with its metadata", reloaded?.app.metadata.name === TIMELINE_APP.metadata.name);
  check("and the model that made it", reloaded?.model === "gemini-3.6-flash");

  check("merging null does not erase an existing version",
    APP_STATE_KEY in mergeAppState(snapshot, null));
}

/* ── 2. reading re-runs the gate, and fails closed ───────────────────────── */

const REJECTED: Array<[string, unknown]> = [
  ["a non-object", "nope"],
  ["another kind of state", { ...state, kind: "codegen" }],
  ["a future version", { ...state, version: 99 }],
  ["a malformed timestamp", { ...state, generatedAt: "yesterday" }],
  ["no model", { ...state, model: "" }],
  ["a project the validator now refuses", {
    ...state,
    app: {
      ...TIMELINE_APP,
      files: {
        ...TIMELINE_APP.files,
        "src/App.tsx": 'export default function A(){ return <img src="https://images.unsplash.com/x.jpg" />; }',
      },
    },
  }],
  ["a project using storage", {
    ...state,
    app: {
      ...TIMELINE_APP,
      files: { ...TIMELINE_APP.files, "src/App.tsx": 'export default function A(){ localStorage.setItem("a","b"); return null; }' },
    },
  }],
];

for (const [name, value] of REJECTED) {
  check(`refused on read: ${name}`, parseAppState(value) === null);
}

// This is the property that matters most: the stored artifact from the very
// first passing canary carried remote media, and today's gate refuses it. A
// project like that shows the empty state rather than a rendered page.
check("a refusal on read is null, never a throw", parseAppState({ kind: "app", version: 1 }) === null);

/* ── 3. the brief carries what the person actually said ──────────────────── */

{
  const brief = composeAppBrief({
    idea: "A tool for gigging musicians to time a live set.",
    productType: "an interactive tool",
    designDirection: "calm, dense, dark",
    locale: "en",
  });
  check("the idea leads, unedited", brief.startsWith("A tool for gigging musicians"));
  check("the product type is passed on", brief.includes("an interactive tool"));
  check("so is the visual direction", brief.includes("calm, dense, dark"));
  check("and the language of the copy", brief.includes("English"));

  const ru = composeAppBrief({ idea: "Идея", locale: "ru" });
  check("a Russian project asks for Russian copy", ru.includes("Russian"));
  check("intake lines are omitted when there are none", !ru.includes("The person asked for"));
}

/* ── 4. the flag is off unless a deploy turns it on ──────────────────────── */

{
  const saved = process.env.VENTRIO_APP_RUNTIME;
  delete process.env.VENTRIO_APP_RUNTIME;
  check("off by default", !appRuntimeEnabled());
  process.env.VENTRIO_APP_RUNTIME = "1";
  check("on when the deploy says so", appRuntimeEnabled());
  process.env.VENTRIO_APP_RUNTIME = "0";
  check("and only for exactly \"1\"", !appRuntimeEnabled());
  if (saved === undefined) delete process.env.VENTRIO_APP_RUNTIME;
  else process.env.VENTRIO_APP_RUNTIME = saved;
}

/* ── 5. one job, one reservation, one refund ─────────────────────────────── */

const action = readFileSync(new URL("../../src/lib/actions/stage3.ts", import.meta.url), "utf8");

{
  const generateBody = action.slice(
    action.indexOf("export async function generateFirstVersionAction"),
    action.indexOf("export async function editProjectOutputAction"),
  );

  check("the action claims a job exactly once",
    (generateBody.match(/await claimJob\(/g) ?? []).length === 1);
  check("and reserves usage exactly once",
    (generateBody.match(/await reserveUsage\(/g) ?? []).length === 1);
  // Generation runs in an external worker now, but it is still *this* job's
  // work: the payload is written after the claim and after the reservation, so
  // a runnable job can only ever exist for one that was claimed and paid for.
  check("the work is recorded inside that job, not beside it",
    generateBody.indexOf("savePayload") > generateBody.indexOf("await reserveUsage("));
  check("a payload that cannot be written takes the shared refund path",
    /savePayload[\s\S]{0,900}?releaseAndFail\(/.test(generateBody));
  check("the refund releases the reserved unit",
    /async function releaseAndFail[\s\S]{0,400}?releaseUsage\(/.test(action));
  check("and marks the job failed first",
    /async function releaseAndFail[\s\S]{0,400}?finishFailed\([\s\S]{0,200}?releaseUsage\(/.test(action));
  // Success is no longer the action's to report — the work outlives the request
  // that started it, so the queue consumer's own persist stage ends the job.
  const steps = readFileSync(new URL("../../src/lib/v2/app/stages.ts", import.meta.url), "utf8");
  check("success marks the job succeeded, from the step that saved it",
    /finishSucceeded\(ref\.jobId\)/.test(steps));
  // Scoped to the app-runtime branch: the older inline renderers still finish
  // their own jobs in this action, and legitimately so — they return a document.
  const appBranch = generateBody.slice(
    generateBody.indexOf("if (appRuntimeEnabled()) {"),
    generateBody.indexOf("const client = new Anthropic();"),
  );
  check("the app branch was found", appBranch.length > 200);
  check("and it no longer claims to have finished the work",
    !/finishSucceeded/.test(appBranch));
  check("nor to have saved anything", !/mergeAppState/.test(appBranch));

  check("an in-flight job is returned rather than started again",
    /previous\.status === "queued" \|\| previous\.status === "running"/.test(generateBody));
  check("stale holds are cleared before the limit is read",
    generateBody.indexOf("expireStaleForUser") < generateBody.indexOf("await reserveUsage("));
  check("a finished first version never regenerates",
    /if \(baseState\.output\) return \{ error: null, output: baseState\.output/.test(generateBody));
  // An app-runtime project has no `output`, so the old finality guard cannot
  // see it. Without this one, submitting again would claim a second job and
  // reserve a second unit for a project that already has a version.
  check("a project that already has an application never regenerates",
    /if \(readAppState\(project\.snapshot_fields\)\) \{[\s\S]{0,200}?alreadyReady/.test(generateBody));
  check("and that guard runs before the job is claimed",
    generateBody.indexOf("readAppState(project.snapshot_fields)") < generateBody.indexOf("await claimJob("));
  check("the request id is derived, so a replay collides instead of charging",
    /first-version:\$\{\(await jobCountSoFar/.test(generateBody));

  check("the provider guard follows the renderer in force",
    /appRuntimeEnabled\(\) \? process\.env\.GEMINI_API_KEY : process\.env\.ANTHROPIC_API_KEY/.test(generateBody));
  check("the app branch does not fall back to the old renderer",
    !/appRuntimeEnabled\(\)[\s\S]{0,2000}?renderProjectWithCodegen/.test(generateBody));
  check("the generated application is persisted",
    /mergeAppState\(/.test(steps));
}

/* ── 6. the workspace rebuilds from source, never from a stored document ─── */

{
  const props = readFileSync(new URL("../../src/lib/build/workspaceProps.ts", import.meta.url), "utf8");
  check("reopening compiles the stored project", /buildGeneratedApp\(state\.app, \{ nonce \}\)/.test(props));
  // The rebuild carries the request's CSP nonce: a srcdoc frame inherits the
  // page policy, and without it the app loads styled and never mounts.
  check("and passes the request nonce into the rebuild", /const nonce = \(await headers\(\)\)\.get\("x-nonce"\)/.test(props));
  check("and shows nothing when the gate now refuses it", /if \(!built\.ok\) \{[\s\S]{0,400}?return null;/.test(props));
  check("no provider is contacted on read", !/generateApp\(|createAppTransport\(/.test(props));

  const view = readFileSync(new URL("../../src/components/build/WorkspaceView.tsx", import.meta.url), "utf8");
  check("a generated application counts as having output", /Boolean\(props\.app\)/.test(view));
  check("and is previewed by the scripted-sandbox component", /<AppPreview/.test(view));

  const preview = readFileSync(new URL("../../src/components/workspace/AppPreview.tsx", import.meta.url), "utf8");
  check("the preview uses the runtime's own sandbox attribute", /sandbox=\{SANDBOX_ATTRIBUTE\}/.test(preview));
  // Tested against the code, not the prose: the file explains at length why
  // this token is never used, and a naive search finds the explanation.
  const previewCode = preview.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  check("never allow-same-origin", !/allow-same-origin/.test(previewCode));
  // The validation moved into `subscribePreview` when the listener had to be
  // attached to the frame's own window rather than the page's; both halves are
  // asserted so the component cannot start listening on its own again.
  check("and reads its messages through the protocol's subscriber", /subscribePreview\(/.test(preview));
  const protocolSource = readFileSync(new URL("../../src/lib/v2/app/protocol.ts", import.meta.url), "utf8");
  check("which validates every message", /subscribePreview[\s\S]{0,900}parsePreviewMessage\(/.test(protocolSource));
}

/* ── report ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`FAILED ${failures.length} of ${passed + failures.length}`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`app integration: ${passed} checks passed`);
