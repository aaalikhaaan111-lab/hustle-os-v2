/**
 * Compiles the fixture applications through the real runtime and writes each
 * one out as a sandbox document the browser harness can load.
 *
 *   npx tsx scripts/v2/build-app-fixtures.mts <out-dir>
 *
 * No shortcuts around the pipeline: every fixture goes through
 * `buildGeneratedApp` exactly as model output would, and a fixture that fails
 * any gate fails this script.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildGeneratedApp } from "../../src/lib/v2/app/pipeline";
import { APP_FIXTURES, APP_FIXTURE_IDS } from "../../src/lib/v2/app/fixtures";

const outDir = process.argv[2];
if (!outDir) { console.error("usage: build-app-fixtures.mts <out-dir>"); process.exit(1); }
mkdirSync(outDir, { recursive: true });

let failed = 0;
for (const id of APP_FIXTURE_IDS) {
  const app = APP_FIXTURES[id];
  const result = await buildGeneratedApp(app);
  if (!result.ok) {
    failed += 1;
    console.error(`✗ ${id} — refused at "${result.stage}"`);
    const issues = result.stage === "validate"
      ? result.issues.map((i) => `${i.path}: ${i.code} — ${i.detail}`)
      : result.errors.map((e) => `${e.file ?? "build"}: ${e.text}`);
    for (const issue of issues.slice(0, 15)) console.error(`    ${issue}`);
    continue;
  }
  writeFileSync(join(outDir, `${id}.html`), result.document, "utf8");
  console.log(
    `✓ ${id.padEnd(10)} ${Object.keys(app.files).length} files  ` +
    `bundle ${String(Math.round(result.compiledBytes / 1024)).padStart(3)} kB  ` +
    `doc ${String(Math.round(result.documentBytes / 1024)).padStart(4)} kB  ` +
    `${result.compileMs} ms  deps: ${app.runtime.dependencies.join(", ")}`,
  );
}

if (failed > 0) { console.error(`\n${failed} fixture(s) refused.`); process.exit(1); }
console.log(`\nAll ${APP_FIXTURE_IDS.length} applications compiled → ${outDir}`);
