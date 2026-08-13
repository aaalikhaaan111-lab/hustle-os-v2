/**
 * Three things the workspace did after a generation finished.
 *
 *   npx tsx --conditions=react-server scripts/generation-progress.test.mts
 *
 * It offered to create the app that had just been created; the preview could
 * sit on "starting your app" forever; and the progress list ticked rows that had
 * nothing to do with the run.
 *
 * The stage mapping runs for real. The rest is source-level: what regressed was
 * which state a control is gated on and when a listener is attached, and source
 * states both exactly.
 *
 * Offline. No network, no provider, no database.
 */

import { readFileSync } from "node:fs";
import { generationProgress, GENERATION_STAGES } from "../src/lib/workspace/generationProgress";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const preOutput = code(read("src/components/build/PreOutputWorkspace.tsx"));
const appPreview = read("src/components/workspace/AppPreview.tsx");

/* ── 1. never offer to create what was just created ──────────────────────── */

/**
 * `hasVersion` waits for the rebuilt project to come back from the server; the
 * job row says "succeeded" a second or more earlier. In that window every other
 * term held and the card returned.
 */
// Read the gate itself, not the file: `job.phase !== "succeeded"` also appears
// in the refresh effect, so searching the whole source would pass on a line
// that has nothing to do with this card.
const cardGate = preOutput.slice(preOutput.indexOf("{job.loaded && !hasVersion"), preOutput.indexOf("{job.loaded && !hasVersion") + 140);
check(
  "the create card is gated on the succeeded job, not only hasVersion",
  cardGate.includes('job.phase !== "succeeded"'),
  "the card can reappear after a successful generation again",
);
for (const term of ["job.loaded", "!hasVersion", 'job.phase !== "succeeded"', "!job.active", "!intake.step"]) {
  check(`the gate still requires ${term}`, cardGate.includes(term), cardGate);
}

/* ── 2. the preview cannot wait forever ──────────────────────────────────── */

/**
 * THE RACE. The generated entry posts `ready` synchronously after
 * `createRoot().render()`. A passive effect subscribes after React has already
 * handed the browser the `srcDoc`, so the sandbox could parse, run and post
 * before anyone was listening — and `ready` is sent once.
 */
check(
  "the listener is attached in a layout effect",
  /useLayoutEffect\(\s*\(\) => subscribePreview/.test(appPreview),
  "the subscription is passive again, so the sandbox can win the race",
);
check(
  "and no passive effect subscribes",
  !/useEffect\(\s*\(\) => subscribePreview/.test(appPreview),
);

/**
 * THE FLOOR. Even with the ordering fixed, one missed message must not mean a
 * permanent overlay.
 */
check("the frame reports when it has loaded", /onLoad=\{\(\) => \{/.test(appPreview));
check("which schedules a reveal", /setTimeout\(\(\) => setRevealedFor\(forDocument\), REVEAL_GRACE_MS\)/.test(appPreview));
check("the overlay yields to it", /const booting = !ready && revealedFor !== srcDoc;/.test(appPreview));
check("and the timer is cleaned up", /window\.clearTimeout\(revealTimer\.current\)/.test(appPreview));
check(
  "the grace is short enough not to be a wait",
  /const REVEAL_GRACE_MS = 2_000;/.test(appPreview),
);

// The boundary this fix must not cross.
check("the sandbox attribute is untouched", /sandbox=\{SANDBOX_ATTRIBUTE\}/.test(appPreview));
check("the document is passed through unchanged", /srcDoc=\{srcDoc\}/.test(appPreview));
const protocolFile = read("src/lib/v2/app/protocol.ts");
check("the protocol still accepts only its own three types", (protocolFile.match(/case "/g) ?? []).length === 3);

/* ── 3. progress is the pipeline's own stages ────────────────────────────── */

check("the stages are the ones the column carries", GENERATION_STAGES.join(",") === "queued,preparing,generating,saving,completed");

// A run at each stage: everything before it done, it active, the rest waiting.
{
  const rows = generationProgress("generating", "running");
  check("the current stage is active", rows.find((r) => r.stage === "generating")?.state === "active");
  check("earlier stages are done", rows.filter((r) => ["queued", "preparing"].includes(r.stage)).every((r) => r.state === "done"));
  check("later stages are waiting", rows.filter((r) => ["saving", "completed"].includes(r.stage)).every((r) => r.state === "waiting"));
  check("exactly one row is active", rows.filter((r) => r.state === "active").length === 1);
}
{
  // A claimed job with no stage written has not begun one.
  const rows = generationProgress(null, "running");
  check("an unreported stage reads as queued", rows[0]?.state === "active" && rows[0]?.stage === "queued");
}
{
  // Success beats the stage column: the row says succeeded before the rebuilt
  // project reaches the workspace, and that gap is what "opening" describes.
  const rows = generationProgress("saving", "succeeded");
  check("a succeeded job is opening", rows.find((r) => r.stage === "completed")?.state === "active");
  check("and everything before it is done", rows.filter((r) => r.stage !== "completed").every((r) => r.state === "done"));
}

// Nothing invented: no percentage, and no substep the pipeline cannot report.
const progressSource = read("src/lib/workspace/generationProgress.ts");
check("no percentage is computed", !/%|percent|Math\.round\(.*\/.*\* *100/.test(code(progressSource)));
check("the row count equals the stage count", generationProgress(null, "running").length === GENERATION_STAGES.length);

// The old checklist ticked rows from what the project already held.
for (const stale of ["genUnderstanding", "genAudience", "genDirection", "activeStageLabel"]) {
  check(`the ${stale} row is gone`, !preOutput.includes(stale), "the product-understanding checklist is back");
}
check("the steps come from the job", /generationProgress\(job\.stage, job\.phase\)/.test(preOutput));

// Every label exists, in both languages, and says what the user asked for.
const ru = JSON.parse(read("messages/ru.json")) as { stage3: Record<string, string> };
const en = JSON.parse(read("messages/en.json")) as { stage3: Record<string, string> };
const expectedRu: Record<string, string> = {
  progressQueued: "Ставлю задачу в очередь…",
  progressPreparing: "Разбираю идею…",
  progressGenerating: "Собираю приложение…",
  progressSaving: "Проверяю и сохраняю результат…",
  progressCompleted: "Открываю приложение…",
};
for (const [key, text] of Object.entries(expectedRu)) {
  check(`ru.${key} is the agreed wording`, ru.stage3[key] === text, ru.stage3[key]);
  check(`en.${key} exists`, typeof en.stage3[key] === "string" && en.stage3[key].length > 0);
}

if (failures.length > 0) {
  console.error(`generation-progress: ${failures.length} failed, ${passed} passed`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`generation-progress: ${passed} checks passed`);
