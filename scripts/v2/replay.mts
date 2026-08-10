/**
 * Replays saved provider responses through the production path. Costs nothing.
 *
 *   npx tsx --conditions=react-server scripts/v2/replay.mts <out-dir> <raw...>
 *
 * This is the whole argument for persisting raw responses before parsing them:
 * six paid Gemini generations, five of them discarded at the time, can all be
 * re-judged against a changed pipeline without spending a cent. Nothing here
 * contacts a provider — the only inputs are files on disk.
 *
 * Every response goes through the same functions a live generation uses:
 * `parseModelJsonSafe`, `validateGeneratedApp`, `compileGeneratedApp` and
 * `buildGeneratedApp`. No shortcuts, no relaxed gate, no substitutions.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { parseFramedProject } from "../../src/lib/v2/app/framing";
import { validateGeneratedApp } from "../../src/lib/v2/app/validate";
import { buildGeneratedApp, describeFailure } from "../../src/lib/v2/app/pipeline";
import { SANDBOX_ATTRIBUTE } from "../../src/lib/v2/app/sandbox";

const [OUT, ...inputs] = process.argv.slice(2);
if (!OUT || inputs.length === 0) {
  console.error("usage: replay.mts <out-dir> <raw-response...>");
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

/** Forbidden shapes, checked against the document that would be served. */
function auditDocument(html: string) {
  return {
    externalUrls: [...html.matchAll(/https?:\/\/[^\s"'`)]+/g)].map((m) => m[0])
      .filter((url) => !url.startsWith("http://www.w3.org/"))
      .slice(0, 8),
    fetch: /\bfetch\s*\(/.test(html),
    storage: /localStorage|sessionStorage|indexedDB/.test(html),
    cookie: /document\.cookie/.test(html),
    eval: /\beval\s*\(|new Function\s*\(/.test(html),
    serviceWorker: /serviceWorker/.test(html),
    sandboxAttribute: SANDBOX_ATTRIBUTE,
    scriptTags: (html.match(/<script/g) ?? []).length,
  };
}

function cssStats(css: string) {
  return {
    bytes: Buffer.byteLength(css, "utf8"),
    rules: (css.match(/\{/g) ?? []).length,
    tailwindDirectivesRemaining: (css.match(/@tailwind\s/g) ?? []).length,
  };
}

const rows: Record<string, unknown>[] = [];

for (const input of inputs) {
  const label = `${basename(dirname(input))}/${basename(input).replace(/-raw\.txt$/, "")}`;
  const raw = readFileSync(input, "utf8");
  const row: Record<string, unknown> = { label, rawBytes: Buffer.byteLength(raw, "utf8") };

  /**
   * 1. framing — the same parser production uses.
   *
   * This used to be a local `JSON.parse`, which called a perfectly good framed
   * response "invalid JSON" and made the replay record actively misleading.
   * A verification tool that disagrees with the pipeline it verifies is worse
   * than no tool.
   */
  const parsed = parseFramedProject(raw);
  row.parse = parsed.ok ? "framed" : "failed";
  if (!parsed.ok) {
    row.parseIssues = parsed.issues.map((i) => `${i.path}: ${i.code} — ${i.detail}`);
    rows.push(row);
    console.log(`✗ ${label}  framing FAILED`);
    for (const issue of (row.parseIssues as string[]).slice(0, 4)) console.log(`      ${issue}`);
    continue;
  }

  /* 2. schema validation */
  const validation = validateGeneratedApp(parsed.value);
  row.validate = validation.ok ? "passed" : "refused";
  if (!validation.ok) {
    row.validateIssues = validation.issues.map((i) => `${i.path}: ${i.code} — ${i.detail}`);
    rows.push(row);
    console.log(`✗ ${label}  parse ${row.parse}, validation REFUSED`);
    for (const issue of (row.validateIssues as string[]).slice(0, 4)) console.log(`      ${issue}`);
    continue;
  }
  row.app = {
    name: validation.app.metadata.name,
    files: Object.keys(validation.app.files).length,
    routes: validation.app.routes.map((r) => r.path),
    dependencies: validation.app.runtime.dependencies,
  };

  /* 3. compile + document */
  const build = await buildGeneratedApp(validation.app);
  row.compile = build.ok ? "passed" : `failed:${build.stage}`;
  if (!build.ok) {
    row.compileIssues = describeFailure(build);
    rows.push(row);
    console.log(`✗ ${label}  compile FAILED`);
    for (const issue of (row.compileIssues as string[]).slice(0, 4)) console.log(`      ${issue}`);
    continue;
  }

  const css = build.document.match(/<style>([\s\S]*?)<\/style>/g)?.join("") ?? "";
  row.css = cssStats(css);
  row.tailwind = { applied: undefined };
  row.documentBytes = build.documentBytes;
  row.compiledBytes = build.compiledBytes;
  row.audit = auditDocument(build.document);

  const dir = join(OUT, label.replace("/", "__"));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "document.html"), build.document, "utf8");
  writeFileSync(join(dir, "app.json"), JSON.stringify(build.app, null, 2), "utf8");
  row.documentPath = join(dir, "document.html");

  rows.push(row);
  console.log(
    `✓ ${label}  parse ${row.parse}  files ${(row.app as { files: number }).files}  ` +
    `css ${(row.css as { bytes: number }).bytes}B/${(row.css as { rules: number }).rules} rules  ` +
    `doc ${(build.documentBytes / 1000).toFixed(0)}kB`,
  );
}

writeFileSync(join(OUT, "replay.json"), JSON.stringify(rows, null, 2), "utf8");
console.log(`\nreplayed ${rows.length} response(s) → ${join(OUT, "replay.json")}`);
