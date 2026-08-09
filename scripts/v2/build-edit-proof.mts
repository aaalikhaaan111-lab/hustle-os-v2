/**
 * Applies a targeted edit to a fixture and compiles both versions.
 *
 *   npx tsx scripts/v2/build-edit-proof.mts <out-dir>
 *
 * Writes before.html and after.html so the browser harness can prove the edit
 * changed what it named and left the rest of the app working.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildGeneratedApp } from "../../src/lib/v2/app/pipeline";
import { applyPatch, PATCH_SCHEMA_VERSION } from "../../src/lib/v2/app/edit";
import { validateGeneratedApp } from "../../src/lib/v2/app/validate";
import { TIMELINE_APP } from "../../src/lib/v2/app/fixtures/timeline";

const out = process.argv[2];
if (!out) { console.error("usage: build-edit-proof.mts <out-dir>"); process.exit(1); }
mkdirSync(out, { recursive: true });

const before = await buildGeneratedApp(TIMELINE_APP);
if (!before.ok) { console.error("base failed to build"); process.exit(1); }
writeFileSync(join(out, "before.html"), before.document, "utf8");

/**
 * A change a person would actually ask for: "make it warmer and add a count
 * of how many are showing to the header". It touches the stylesheet and one
 * component, and must leave the other four files alone.
 */
const patch = {
  schemaVersion: PATCH_SCHEMA_VERSION,
  summary: "Warmer palette, and show the visible count in the masthead",
  write: {
    "src/styles.css": TIMELINE_APP.files["src/styles.css"]
      .replace("--bg:#0b0c0f", "--bg:#17110c")
      .replace("--panel:#121419", "--panel:#211710")
      .replace("--accent:#e0803c", "--accent:#f0a35e")
      .replace(".masthead p{margin:0;color:var(--dim);font-size:13px}",
        ".masthead p{margin:0;color:var(--dim);font-size:13px}\n.masthead .tally{margin-left:auto;color:var(--accent);font-size:13px;font-variant-numeric:tabular-nums}"),
    "src/App.tsx": TIMELINE_APP.files["src/App.tsx"]
      .replace("<p>Ordered by when it happened, not when it was released.</p>",
        "<p>Ordered by when it happened, not when it was released.</p>\n        <p className=\"tally\">{visible.length} showing</p>"),
  },
};

const applied = applyPatch(TIMELINE_APP, patch);
if (!applied.ok) {
  console.error("patch refused:", applied.issues.map((i) => `${i.path}: ${i.code}`).join("; "));
  process.exit(1);
}
const revalidated = validateGeneratedApp(applied.app);
if (!revalidated.ok) {
  console.error("edited project refused:", revalidated.issues.map((i) => i.code).join("; "));
  process.exit(1);
}

const after = await buildGeneratedApp(applied.app);
if (!after.ok) { console.error("edited project failed to build"); process.exit(1); }
writeFileSync(join(out, "after.html"), after.document, "utf8");

const untouched = Object.keys(TIMELINE_APP.files).filter((p) => !applied.changed.includes(p));
const identical = untouched.every((p) => applied.app.files[p] === TIMELINE_APP.files[p]);

console.log(`changed: ${applied.changed.join(", ")}`);
console.log(`untouched (${untouched.length}): ${untouched.join(", ")}`);
console.log(`byte-identical: ${identical}`);
console.log(`before ${Math.round(before.documentBytes / 1024)} kB → after ${Math.round(after.documentBytes / 1024)} kB`);
if (!identical) process.exit(1);
