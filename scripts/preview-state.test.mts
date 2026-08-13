/**
 * What the preview panel says when there is nothing in it.
 *
 *   npx tsx --conditions=react-server scripts/preview-state.test.mts
 *
 * `previewStatus` was one word, `"empty"`, doing four jobs — and it was the
 * default value of an optional prop, so forgetting to pass it asserted "nothing
 * has been built yet". That sentence was false in three of the four cases:
 *
 *   - the job row had not been read yet (`idle` also means "haven't looked");
 *   - the job had just succeeded and the rebuilt app had not arrived;
 *   - a stored version existed and would not recompile, which is why a project
 *     could work when published and look empty in the workspace — publishing
 *     serves a stored payload, the workspace rebuilds on every read.
 *
 * And when the frame did render, it was blank until the app inside it booted,
 * with nothing to say so.
 *
 * Offline. No network, no provider, no database.
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

const buildScreen = read("src/components/workspace/BuildScreen.tsx");
const preOutput = code(read("src/components/build/PreOutputWorkspace.tsx"));
const workspaceView = code(read("src/components/build/WorkspaceView.tsx"));
const appPreview = read("src/components/workspace/AppPreview.tsx");
const props = read("src/lib/build/workspaceProps.ts");

/* ── 1. the states are distinct, and none is the default ─────────────────── */

for (const state of ["loading", "generating", "failed", "unavailable", "empty"]) {
  check(`"${state}" is a preview state`, new RegExp(`"${state}"`).test(buildScreen));
}
check(
  "previewStatus is required",
  /previewStatus: PreviewStatus;/.test(buildScreen),
  "it is optional again, so a caller can fall back to a claim it did not make",
);
check(
  "and has no default",
  !/previewStatus = "empty"/.test(buildScreen),
  "the default that caused this is back",
);

/* ── 2. unloaded is not empty ────────────────────────────────────────────── */

/**
 * The rule, in order: not read yet → loading; failed → failed; running →
 * generating; read and idle → empty; anything else → loading.
 */
const rule = preOutput.slice(preOutput.indexOf("previewStatus={"), preOutput.indexOf("onPreviewRetry="));
check("an unread job row is loading", /!job\.loaded\s*\?\s*"loading"/.test(rule), rule.slice(0, 160));
check("a failed job is failed", /job\.phase === "failed" \|\| job\.phase === "stale"\s*\?\s*"failed"/.test(rule));
check("a running job is generating", /job\.active\s*\?\s*"generating"/.test(rule));
check("only a read, idle row is empty", /job\.phase === "idle"\s*\?\s*"empty"/.test(rule));
check(
  "and a succeeded job is not empty",
  !/succeeded[\s\S]{0,40}"empty"/.test(rule),
  "the window between a job finishing and its app arriving claims emptiness again",
);
check("anything else unknown is loading", /:\s*"loading"\s*\}/.test(rule));

/* ── 3. a stored version that will not rebuild is not empty ──────────────── */

check(
  "the workspace passes its status explicitly",
  /previewStatus=\{/.test(workspaceView),
  "it relies on the default again",
);
check("and reports an unrenderable version", /versionUnavailable \? "unavailable"/.test(workspaceView));

// The server has to be able to tell the two apart, or the screen cannot.
check("the server distinguishes stored-but-broken from absent", /storedVersionUnavailable/.test(props));
check(
  "by asking whether something is stored at all",
  /readAppState\(snapshotFields\)[\s\S]{0,200}compileStoredApp\(snapshotFields\)\) === null/.test(props),
);
check(
  "and returns false when nothing is stored",
  /return false;\s*\}/.test(props.slice(props.indexOf("storedVersionUnavailable"))),
);

// The honest message, in the language production speaks.
const ru = JSON.parse(read("messages/ru.json")) as { workspace: Record<string, string> };
const en = JSON.parse(read("messages/en.json")) as { workspace: Record<string, string> };
check("ru names the failure", ru.workspace.previewUnavailableTitle === "Не удалось загрузить эту версию", ru.workspace.previewUnavailableTitle);
check("en names it too", typeof en.workspace.previewUnavailableTitle === "string");
check("and it does not claim the version was lost", /сохранена/.test(ru.workspace.previewUnavailableBody ?? ""));
for (const key of ["previewLoadingTitle", "previewLoadingBody", "previewUnavailableTitle", "previewUnavailableBody", "previewBootingTitle"]) {
  for (const [locale, messages] of [["en", en], ["ru", ru]] as const) {
    check(`${locale}.${key} exists`, typeof messages.workspace[key] === "string" && messages.workspace[key].length > 0);
  }
}

/* ── 4. only a real failure offers an action ─────────────────────────────── */

check(
  "loading offers no retry",
  /const showRetry = \(status === "failed" \|\| status === "unavailable"\) && !!onRetry;/.test(buildScreen),
);

/* ── 5. a mounted frame that has not booted is not blank ─────────────────── */

check("the booting overlay exists", /data-testid="app-preview-booting"/.test(appPreview));
check("it covers the frame until ready", /\{!ready && \(/.test(appPreview));
check("and says what is happening", /previewBootingTitle/.test(appPreview));

/**
 * Readiness belongs to one document. A boolean would have to be reset when the
 * document changes — a setState inside an effect, which React's linter refuses
 * and which cascades a render.
 */
check("readiness is derived from the document", /const ready = readyFor === srcDoc;/.test(appPreview));
check("the subscription follows the document", /\[onRuntimeErrors, srcDoc\]/.test(appPreview));
check(
  "no effect resets readiness",
  !/useEffect\(\(\) => setReady/.test(appPreview),
  "the cascading reset is back",
);

// The boundary this must not touch.
check("the sandbox attribute is unchanged", /sandbox=\{SANDBOX_ATTRIBUTE\}/.test(appPreview));
check("the document is still passed straight through", /srcDoc=\{srcDoc\}/.test(appPreview));

if (failures.length > 0) {
  console.error(`preview-state: ${failures.length} failed, ${passed} passed`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`preview-state: ${passed} checks passed`);
