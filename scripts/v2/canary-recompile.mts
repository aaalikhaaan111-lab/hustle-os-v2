/**
 * Replays saved canary responses through the real gate. Costs nothing.
 *
 *   npx tsx scripts/v2/canary-recompile.mts <canary-dir>
 *
 * This exists because a paid response is evidence that should outlive the bug
 * that rejected it. The first canary's three runs each produced a complete
 * bundle and each was thrown away by a bare `JSON.parse` that could not see
 * past a markdown fence. The responses were written to disk before anything
 * parsed them — which is the whole reason they are still here to replay.
 *
 * Nothing is relaxed. This runs the same `compileCodegenBundle` the product
 * runs, and a bundle that fails it fails here.
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { compileCodegenBundle } from "../../src/lib/v2/codegen/compile";
import { TRUSTED_ASSETS } from "../../src/lib/v2/codegen/assets";
import type { ContentPack } from "../../src/lib/v2/codegen/content";

const dir = process.argv[2];
if (!dir) {
  console.error("usage: canary-recompile.mts <canary-dir>");
  process.exit(1);
}

const content = JSON.parse(readFileSync(join(dir, "content-pack.json"), "utf8")) as ContentPack;

/** The same tolerance `accept()` now has. A fence is encoding, not content. */
function parseBundleJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

const raws = readdirSync(dir).filter((f) => /^run\d+-req\d+-raw\.txt$/.test(f)).sort();
const results: Array<Record<string, unknown>> = [];

for (const file of raws) {
  const run = /^run(\d+)/.exec(file)![1];
  const text = readFileSync(join(dir, file), "utf8");

  let parsed: unknown;
  try {
    parsed = parseBundleJson(text);
  } catch (error) {
    console.log(`✗ run${run}: still not JSON — ${String(error).slice(0, 100)}`);
    results.push({ run, ok: false, stage: "json" });
    continue;
  }

  const compiled = compileCodegenBundle(parsed, { content, assets: TRUSTED_ASSETS });
  if (!compiled.ok) {
    console.log(`✗ run${run}: REFUSED at "${compiled.stage}" — ${compiled.issues.length} issue(s)`);
    for (const issue of compiled.issues.slice(0, 15)) {
      console.log(`    ${issue.path}: ${issue.code} — ${issue.detail}`);
    }
    results.push({
      run, ok: false, stage: compiled.stage,
      issues: compiled.issues.map((i) => `${i.path}: ${i.code} — ${i.detail}`),
    });
    continue;
  }

  writeFileSync(join(dir, `run${run}.html`), compiled.routes[0].srcDoc, "utf8");
  writeFileSync(join(dir, `run${run}-bundle.json`), JSON.stringify(parsed, null, 2), "utf8");

  const bundle = parsed as { css: string; routes: Array<{ bodyHtml: string }> };
  console.log(
    `✓ run${run}: ACCEPTED  ${compiled.routes.length} route(s)  ` +
    `${Math.round(compiled.report.totalSrcDocBytes / 1024)} kB  ` +
    `css ${bundle.css.length} B  body ${bundle.routes[0].bodyHtml.length} B  ` +
    `media: ${compiled.report.assetsUsed.join(", ") || "none"}  ` +
    `unused keys: ${compiled.report.unusedContentKeys.length}/${Object.keys(content).length}`,
  );
  results.push({
    run, ok: true,
    cssBytes: bundle.css.length,
    bodyBytes: bundle.routes[0].bodyHtml.length,
    srcDocBytes: compiled.report.totalSrcDocBytes,
    assetsUsed: compiled.report.assetsUsed,
    unusedContentKeys: compiled.report.unusedContentKeys,
  });
}

writeFileSync(join(dir, "recompile-report.json"), JSON.stringify(results, null, 2), "utf8");
console.log(`\naccepted ${results.filter((r) => r.ok).length}/${results.length}`);
