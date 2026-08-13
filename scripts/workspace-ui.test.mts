/**
 * The conversation-first workspace: what belongs where.
 *
 *   npx tsx --conditions=react-server scripts/workspace-ui.test.mts
 *
 * One product rule, checked six ways. The chat is for talking to Ventrio —
 * requests, answers, progress, decisions. The preview owns the thing Ventrio
 * made — viewport, publish, share, open. Before this pass the two were mixed:
 * publishing lived in the conversation, the viewport controls floated in a rail
 * over the work, proposals arrived as dashboard cards, generation covered the
 * screen with an overlay counting invented steps, and Versions was a navigation
 * item leading to a page whose only content was that it was empty.
 *
 * These are source-level assertions. There is no DOM in this repo's test
 * environment, so what can be pinned is which module renders which control, and
 * that is exactly what regressed here — a layout detail is a preference, but a
 * Publish button in the chat is the rule breaking again.
 *
 * Offline. No network, no database, no provider.
 */

import { existsSync, readFileSync } from "node:fs";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
/** Comments explain the removals at length; a naive search would find them. */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const shell = read("src/components/workspace-ui/WorkspaceShell.tsx");
const buildScreen = read("src/components/workspace/BuildScreen.tsx");
const preOutput = read("src/components/build/PreOutputWorkspace.tsx");
const workspaceView = read("src/components/build/WorkspaceView.tsx");
const createExperience = read("src/components/create/CreateExperience.tsx");
const structuredChoice = read("src/components/build/StructuredChoice.tsx");
const analytics = read("src/app/projects/[id]/analytics/page.tsx");
const publishing = read("src/lib/publishing/queries.ts");

/* ── 1. Versions is gone from the product, not from the code ─────────────── */

check(
  "the Versions route no longer exists",
  !existsSync(new URL("../src/app/projects/[id]/versions/page.tsx", import.meta.url)),
);
check("no navigation item points at it", !/\/versions/.test(code(shell)));
check("and nothing else links to it", !/\/versions/.test(code(workspaceView)));

// The infrastructure stays: this was a navigation decision, not a deletion.
const workspaceTypes = read("src/lib/workspace/types.ts");
check("the version types survive", /ProjectVersionSummary/.test(workspaceTypes));
check("and so does the loader", /export function loadProjectVersions/.test(workspaceTypes));

/* ── 2. product controls live in the preview toolbar ─────────────────────── */

const toolbar = buildScreen.slice(
  buildScreen.indexOf("The preview toolbar"),
  buildScreen.indexOf("min-h-0 flex-1 overflow-auto"),
);
for (const control of ["viewportDesktop", "viewportMobile", "fullScreen", "copyPreviewLink", "openPublicPage", "publishControl"]) {
  check(`the toolbar owns ${control}`, toolbar.includes(control), "missing from the toolbar block");
}

// The rail keeps only the two layout toggles.
const rail = buildScreen.slice(buildScreen.indexOf("The panel toggle"), buildScreen.indexOf("{copied && ("));
check("the rail no longer carries the viewport", !/viewportDesktop|viewportMobile/.test(rail));
check("nor sharing", !/copyPreviewLink/.test(rail));
check("but still switches surface", /focusChat/.test(rail) && /openPreview/.test(rail));

/* ── 3. no product controls left in the chat ─────────────────────────────── */

/**
 * The specific regression: `PublicationControls` used to render inside the
 * conversation column. It may now appear only as the toolbar's `publishControl`.
 */
const publishUses = [...code(preOutput).matchAll(/<PublicationControls/g)].length;
check("the chat renders publish exactly once, as the toolbar slot", publishUses === 1, `${publishUses} uses`);
check(
  "and that use is the toolbar slot",
  /publishControl=\{[\s\S]{0,200}<PublicationControls/.test(preOutput),
);
check("the toolbar form is the compact one", /compact\s*$/m.test(preOutput) || /compact\n/.test(preOutput));
check(
  "the compact form does not repeat the toolbar's own actions",
  !/copyLink|t\("open"\)|t\("share"\)/.test(
    read("src/components/publishing/PublicationControls.tsx").split("if (compact)")[1]?.split("return (")[1]?.slice(0, 900) ?? "",
  ),
);
// Feedback is a conversation about responses, so it stays in the conversation.
check("feedback stays in the chat", /<FeedbackPanel/.test(preOutput));

/* ── 4. generation happens in the conversation ───────────────────────────── */

check(
  "the full-screen generation overlay is gone",
  !/CreationTransition/.test(createExperience),
  "the detached generation screen is back",
);
check("and its fixed overlay with it", !/fixed inset-0 z-\[90\]/.test(createExperience));
check(
  "progress is rendered inside the message stream",
  /creating && \([\s\S]{0,400}progressPreparing/.test(createExperience),
);

/**
 * Truthfulness. Every progress line must correspond to a state the component is
 * genuinely in, so each one is checked against the phase that produces it.
 */
for (const [phase, key] of [["persisting", "progressPreparing"], ["generating", "progressBuilding"]] as const) {
  check(`"${key}" is shown for the ${phase} phase`, new RegExp(`"${phase}"[\\s\\S]{0,80}${key}`).test(createExperience));
}
const messages = JSON.parse(read("messages/en.json")) as { create: Record<string, string>; workspace: Record<string, string> };
for (const key of ["progressPreparing", "progressBuilding", "progressOpening"]) {
  check(`${key} exists`, typeof messages.create[key] === "string");
}

// The workspace's own progress still comes from the job row, not from a timer.
// Stages moved out of an inline label function into `generationProgress`, which
// maps the pipeline's own `progress_stage` values. Still the job row, one
// indirection along, and now the whole list rather than one active line.
check("workspace stages are read from the job", /generationProgress\(job\.stage, job\.phase\)/.test(preOutput));

/* ── 5. choices are stacked rows, not columns ────────────────────────────── */

const createCode = code(createExperience);
check(
  "no multi-column choice grid remains in /create",
  !/sm:grid-cols-|md:grid-cols-|lg:grid-cols-/.test(createCode),
  "a responsive column grid is back",
);
check("the proposal renders as a stack", /className="choice-stack"/.test(createExperience));
check("with one row component per direction", /<DirectionRow/.test(createExperience));
check("and the large card is gone", !/direction-card|DirectionCard/.test(createCode));
check("discovery choices stack too", (createExperience.match(/choice-stack/g) ?? []).length >= 3, "expected three stacked surfaces");

// The compact intake was a sideways filmstrip; options off-screen are options
// nobody knows about.
check("intake options stack", /flex flex-col gap-2 px-3 pb-3/.test(structuredChoice));
check("and no longer scroll sideways", !/overflow-x-auto/.test(code(structuredChoice)));
check("nor snap horizontally", !/snap-x|snap-mandatory/.test(code(structuredChoice)));

const css = read("src/app/globals.css");
check("the row style is a single column", /\.choice-stack \{[\s\S]{0,120}flex-direction: column/.test(css));
check("and the supporting line is one line", /\.choice-row-hint \{[\s\S]{0,220}white-space: nowrap/.test(css));

/* ── 6. analytics shows only what is measured ────────────────────────────── */

check("analytics reads a real loader", /loadProjectAnalytics/.test(analytics));
check(
  "which counts responses and distinct submitters",
  /responseCount: rows\.length/.test(publishing) && /new Set\(rows\.map\(\(row\) => row\.submitter_hash\)\)\.size/.test(publishing),
);

// The invented furniture: a readiness checklist with a permanently-false row,
// a five-step sequence, and seven things Ventrio "watches for".
for (const gone of ["readinessTracking", "readinessPattern", "analyzeCompletion", "analyzeReturn", "analyticsStep1"]) {
  check(`analytics no longer renders ${gone}`, !analytics.includes(gone));
}
// Views and visitors are not tracked anywhere, so they must not be claimed.
for (const fake of ["views", "visitors", "sessions", "bounce", "impressions"]) {
  check(`analytics claims no ${fake} metric`, !new RegExp(`metric${fake}`, "i").test(analytics));
}
check("no chart is drawn", !/<svg|Chart|sparkline|<canvas/i.test(code(analytics)));
check("the gap is stated rather than hidden", /analyticsScopeNote/.test(analytics));
check(
  "and the note says what is not tracked",
  /does not track page views or visitors/.test(messages.workspace.analyticsScopeNote ?? ""),
);
check("unpublished projects get an empty state", /analyticsUnpublishedTitle/.test(analytics));
check("published-but-quiet projects get their own", /analyticsQuietTitle/.test(analytics));
check("zeroes are not shown as measurements", /state === "live" \?/.test(analytics));

/* ── report ──────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`workspace-ui: ${failures.length} failed, ${passed} passed`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`workspace-ui: ${passed} checks passed`);
