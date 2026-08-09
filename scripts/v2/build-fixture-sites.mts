/**
 * Compiles the six fixture sites through the real gate chain and writes each
 * one out as a standalone file the screenshot pass can open.
 *
 *   npx tsx scripts/v2/build-fixture-sites.mts
 *
 * Nothing here is a shortcut around the compiler. Each bundle goes through
 * `compileCodegenBundle` exactly as a model's would, and a bundle that fails
 * any gate fails this script — which is the point: a fixture that could not
 * survive production is not evidence about production.
 *
 * No network request is made. The assets are the committed local registry and
 * arrive as data URIs.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { compileCodegenBundle } from "../../src/lib/v2/codegen/compile";
import { RELAY_CONTENT } from "../../src/lib/v2/codegen/contentPacks";
import { SITE_FIXTURES, SITE_FIXTURE_IDS } from "../../src/lib/v2/codegen/siteFixtures";

const outDir = process.argv[2];
if (!outDir) {
  console.error("usage: build-fixture-sites.mts <output-directory>");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

let failed = 0;

for (const id of SITE_FIXTURE_IDS) {
  const result = compileCodegenBundle(SITE_FIXTURES[id], { content: RELAY_CONTENT });

  if (!result.ok) {
    failed += 1;
    console.error(`✗ ${id} — refused at "${result.stage}"`);
    for (const issue of result.issues) {
      console.error(`    ${issue.code} @ ${issue.path}: ${issue.detail}`);
    }
    continue;
  }

  for (const [index, route] of result.routes.entries()) {
    const name = index === 0 ? `${id}.html` : `${id}-${index}.html`;
    writeFileSync(join(outDir, name), route.srcDoc, "utf8");
  }

  const kb = Math.round(result.report.totalSrcDocBytes / 1024);
  console.log(
    `✓ ${id.padEnd(12)} ${String(result.routes.length).padStart(2)} route(s)  ` +
    `${String(kb).padStart(4)} kB  media: ${result.report.assetsUsed.join(", ") || "none"}`,
  );
}

if (failed > 0) {
  console.error(`\n${failed} of ${SITE_FIXTURE_IDS.length} fixtures were refused by the gate.`);
  process.exit(1);
}
console.log(`\nAll ${SITE_FIXTURE_IDS.length} fixtures compiled → ${outDir}`);
