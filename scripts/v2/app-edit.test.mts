/**
 * The edit path: a patch changes what it names and nothing else.
 *
 *   npx tsx scripts/v2/app-edit.test.mts
 *
 * The property under test is the one that makes a generated app feel owned
 * rather than disposable: a targeted change must leave every unrelated file
 * byte-identical. The page renderer could not do this — an edit re-ran
 * generation and produced a different site — so it is asserted here directly,
 * file by file, rather than inferred from the edit "succeeding".
 *
 * Offline.
 */

import { applyPatch, appendVersion, MAX_APP_VERSIONS, PATCH_SCHEMA_VERSION, type AppVersion } from "../../src/lib/v2/app/edit";
import { validateGeneratedApp } from "../../src/lib/v2/app/validate";
import { TIMELINE_APP } from "../../src/lib/v2/app/fixtures/timeline";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const base = TIMELINE_APP;
const patch = (over: Record<string, unknown> = {}) => ({
  schemaVersion: PATCH_SCHEMA_VERSION,
  summary: "Change something",
  ...over,
});

/* ── 1. a targeted edit changes only what it names ──────────────────────── */

const darker = base.files["src/styles.css"].replace("--bg:#0b0c0f", "--bg:#050506");
const applied = applyPatch(base, patch({ write: { "src/styles.css": darker } }));
check("a valid patch applies", applied.ok, applied.ok ? "" : applied.issues.map((i) => i.code).join(","));

if (applied.ok) {
  check("the named file changed", applied.app.files["src/styles.css"].includes("--bg:#050506"));
  check("it is reported as changed", applied.changed.join() === "src/styles.css");
  check("nothing was removed", applied.removed.length === 0);

  // The whole point, asserted file by file.
  const untouched = Object.keys(base.files).filter((p) => p !== "src/styles.css");
  const identical = untouched.every((p) => applied.app.files[p] === base.files[p]);
  check(`all ${untouched.length} unrelated files are byte-identical`, identical);
  check("the file count is unchanged", Object.keys(applied.app.files).length === Object.keys(base.files).length);
  check("routes are untouched", JSON.stringify(applied.app.routes) === JSON.stringify(base.routes));
  check("the base project was not mutated", base.files["src/styles.css"].includes("--bg:#0b0c0f"));

  // And the result must still be a valid project, not merely a valid patch.
  check("the edited project still validates", validateGeneratedApp(applied.app).ok);
}

/* ── 2. adding and removing files ───────────────────────────────────────── */

const added = applyPatch(base, patch({
  write: {
    "src/components/Legend.tsx": `export default function Legend(){return <p className="legend">Legend</p>;}`,
    "src/App.tsx": base.files["src/App.tsx"].replace(
      'import DetailPanel from "./components/DetailPanel";',
      'import DetailPanel from "./components/DetailPanel";\nimport Legend from "./components/Legend";',
    ).replace("<DetailPanel", "<Legend />\n      <DetailPanel"),
  },
}));
check("a patch can add a component", added.ok, added.ok ? "" : added.issues.map((i) => i.code).join(","));
if (added.ok) {
  check("the new file exists", "src/components/Legend.tsx" in added.app.files);
  check("two files are reported changed", added.changed.length === 2);
  check("the enlarged project validates", validateGeneratedApp(added.app).ok);
}

const pruned = applyPatch(base, patch({
  write: {
    "src/App.tsx": base.files["src/App.tsx"]
      .replace('import DetailPanel from "./components/DetailPanel";\n', "")
      .replace("      <DetailPanel entry={selected} onThread={setThread} />\n", ""),
  },
  remove: ["src/components/DetailPanel.tsx"],
}));
check("a patch can remove a component", pruned.ok, pruned.ok ? "" : pruned.issues.map((i) => i.code).join(","));
if (pruned.ok) {
  check("the file is gone", !("src/components/DetailPanel.tsx" in pruned.app.files));
  check("the reduced project validates", validateGeneratedApp(pruned.app).ok);
}

// A removal that leaves a dangling import is legal as a patch and broken as a
// project. The whole-project pass is what catches it, which is why both run.
const dangling = applyPatch(base, patch({ remove: ["src/components/DetailPanel.tsx"] }));
check("removing a still-imported file passes the patch checks", dangling.ok);
if (dangling.ok) {
  const after = validateGeneratedApp(dangling.app);
  check("but fails whole-project validation", !after.ok
    && after.issues.some((i) => i.code === "import_missing"));
}

/* ── 3. patches that must be refused ────────────────────────────────────── */

function refuses(name: string, value: unknown, code?: string): void {
  const result = applyPatch(base, value);
  const got = result.ok ? [] : result.issues.map((i) => i.code);
  check(`refused: ${name}`, !result.ok && (!code || got.includes(code)), `codes: ${got.join(",")}`);
}

refuses("a non-object", "patch me", "not_an_object");
refuses("the wrong schema", patch({ schemaVersion: "app-patch-2" }), "bad_version");
refuses("an unknown key", patch({ write: { "src/a.ts": "x" }, exec: "rm -rf /" }), "unknown_key");
refuses("no summary", { schemaVersion: PATCH_SCHEMA_VERSION, write: { "src/a.ts": "x" } }, "bad_value");
refuses("a patch that changes nothing", patch({}), "empty_patch");
refuses("a traversal write", patch({ write: { "../evil.ts": "x" } }), "path_root_not_allowed");
refuses("writing package.json", patch({ write: { "package.json": "{}" } }), "path_reserved");
refuses("writing Ventrio's entry", patch({ write: { "src/main.tsx": "x" } }), "entry_reserved");
refuses("an oversized file", patch({ write: { "src/Big.ts": "x".repeat(70_000) } }), "budget_file_bytes");
refuses("removing a file that is not there", patch({ remove: ["src/Nope.tsx"] }), "remove_missing");
refuses("writing and removing the same path", patch({
  write: { "src/styles.css": "body{}" }, remove: ["src/styles.css"],
}), "remove_conflict");
refuses("removing the mounted root", patch({ remove: ["src/App.tsx"] }), "root_missing");
refuses("a non-string file body", patch({ write: { "src/a.ts": 42 } }), "bad_value");

// `src/main.tsx` is reserved, so a patch cannot take over the entry module.
check("the entry stays Ventrio's", !applyPatch(base, patch({ write: { "src/main.tsx": "//" } })).ok);

/* ── 4. metadata and dependencies ───────────────────────────────────────── */

const renamed = applyPatch(base, patch({ metadata: { name: "Chronoverse II" } }));
check("metadata can be edited", renamed.ok && renamed.app.metadata.name === "Chronoverse II");
check("and the untouched half is kept", renamed.ok
  && renamed.app.metadata.description === base.metadata.description);

const deps = applyPatch(base, patch({ dependencies: ["react", "framer-motion"] }));
check("dependencies can be replaced", deps.ok
  && JSON.stringify(deps.ok ? deps.app.runtime.dependencies : []) === JSON.stringify(["react", "framer-motion"]));

// An unallowed dependency is caught by the whole-project pass, in one place.
const badDeps = applyPatch(base, patch({ dependencies: ["react", "express"] }));
check("an unallowed dependency survives the patch stage", badDeps.ok);
if (badDeps.ok) {
  const after = validateGeneratedApp(badDeps.app);
  check("and is refused by validation", !after.ok
    && after.issues.some((i) => i.code === "dependency_not_allowed"));
}

/* ── 5. version history ─────────────────────────────────────────────────── */

const version = (n: number): AppVersion => ({
  version: n, summary: `v${n}`, app: base, createdAt: new Date().toISOString(),
  changed: [], removed: [],
});

let history: AppVersion[] = [version(1)];
for (let i = 2; i <= 25; i += 1) history = appendVersion(history, version(i));
check("history is bounded", history.length === MAX_APP_VERSIONS, String(history.length));
check("the first version is always kept", history[0].version === 1);
check("the newest is kept", history[history.length - 1].version === 25);
check("the middle is what gets dropped", history[1].version > 2);

const short = appendVersion([version(1)], version(2));
check("a short history keeps everything", short.length === 2 && short[0].version === 1);

/* ── report ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`FAILED ${failures.length} of ${passed + failures.length}`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`app edit: ${passed} checks passed`);
