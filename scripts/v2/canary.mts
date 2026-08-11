/**
 * The paid canary. Three end-to-end generations, one brief, one model.
 *
 *   npx tsx --env-file=.env.local scripts/v2/canary.mts <out-dir>
 *
 * THIS SPENDS MONEY. Nothing else in the repository does, which is why the
 * budget is enforced here in code rather than trusted to the operator:
 *
 *   - a hard global ceiling of 6 provider requests, checked before every send;
 *   - the per-run ceiling of 2 that the pipeline already enforces;
 *   - the run loop stops at 3 regardless of outcome — a failed generation is a
 *     result, not a reason to try again.
 *
 * Raw responses are written to disk the moment they arrive, before anything
 * parses or compiles them. A paid response that is lost because the code that
 * would have saved it ran after the code that threw is a paid response spent
 * twice, and the first canary in this project learned that the expensive way.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AnthropicCodegenTransport } from "../../src/lib/v2/codegen/anthropicTransport";
import { TRUSTED_ASSETS } from "../../src/lib/v2/codegen/assets";
import { resolveCodegenConfig } from "../../src/lib/v2/codegen/config";
import { compileCodegenBundle } from "../../src/lib/v2/codegen/compile";
import { generateCodegenBundle } from "../../src/lib/v2/codegen/generate";
import { projectContentPack } from "../../src/lib/v2/codegen/projectContent";
import { codegenRoutesFor } from "../../src/lib/v2/codegen/projectBrief";
import { CHRONOVERSE_OUTPUT } from "../../src/lib/build/outputFixtures";
import type {
  GeminiRequest,
  GeminiResponse,
  GeminiTransport,
} from "../../src/lib/v2/gemini/transport";

const OUT = process.argv[2];
if (!OUT) {
  console.error("usage: canary.mts <output-directory>");
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

const RUNS = 3;
const GLOBAL_REQUEST_CEILING = 6;

/** The operator's brief, verbatim. Identical for all three runs. */
const BRIEF_TEXT =
  "Chronoverse is an interactive product for MCU fans that maps every movie and " +
  "series by its in-universe date rather than release order. Users can explore " +
  "eras, filter by character, open timeline entries, and trace connected threads " +
  "such as the Infinity Stones, the TVA and the Multiverse. Build a premium, " +
  "cinematic, content-rich product website with a strong interactive timeline " +
  "experience. It must feel finished and intentional, not like a generic SaaS " +
  "landing page.";

/** Fixed for all three runs, so the only variable is the model's sampling. */
const INTAKE = {
  productType: "an interactive timeline",
  designDirection: "cinematic: deep field, one dominant image, restrained warm accent",
};
const LOCALE = "en";

const content = projectContentPack(CHRONOVERSE_OUTPUT);
const routes = codegenRoutesFor(CHRONOVERSE_OUTPUT);

/**
 * The brief the model sees.
 *
 * The operator's paragraph is used verbatim as the product description. The
 * structure block below it is not editorial licence — it names which content
 * keys exist and what each section is for, and without it the model would be
 * asked to build a page out of keys it was never told the meaning of.
 */
function briefFor(): string {
  const sections = CHRONOVERSE_OUTPUT.sections
    .map((section, i) => {
      const at = `section${i + 1}`;
      switch (section.kind) {
        case "showcase": return `  ${at} — showcase, ${section.items.length} item(s)`;
        case "stats": return `  ${at} — stats, ${section.stats.length} value/label pair(s)`;
        case "process": return `  ${at} — process, ${section.steps.length} step(s)`;
        case "compare": {
          const rows = (section as { rows?: unknown[] }).rows;
          return `  ${at} — comparison, ${Array.isArray(rows) ? rows.length : 0} row(s)`;
        }
        case "interactive":
          return `  ${at} — interactive in the product; on this page it is a titled prose block`;
        default: return `  ${at} — prose`;
      }
    })
    .join("\n");

  return [
    BRIEF_TEXT,
    "",
    `The person asked for: ${INTAKE.productType}.`,
    `They chose this visual direction: ${INTAKE.designDirection}.`,
    "Commit to it. A direction half-applied reads as no direction at all.",
    "",
    `Language on the page: ${LOCALE}. All copy arrives as content tokens; set type that suits that script.`,
    "",
    "CONTENT STRUCTURE",
    sections,
  ].join("\n");
}

interface RequestRecord {
  run: number;
  index: number;
  label: string;
  ok: boolean;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  modelVersion?: string;
  failure?: string;
  rawPath?: string;
}

const records: RequestRecord[] = [];
let globalRequests = 0;

class BudgetExceeded extends Error {}

/**
 * Wraps the real transport to persist and count.
 *
 * The ceiling is checked before the send, not after, so the sixth request is
 * the last one that can ever happen. Exceeding it throws rather than returning
 * a failure: a failure would be absorbed by the pipeline's repair logic and
 * could turn into another attempt, which is exactly what must not happen.
 */
class CanaryTransport implements GeminiTransport {
  constructor(
    private readonly inner: GeminiTransport,
    private readonly run: number,
  ) {}

  async send(request: GeminiRequest, signal: AbortSignal): Promise<GeminiResponse> {
    if (globalRequests >= GLOBAL_REQUEST_CEILING) {
      throw new BudgetExceeded(`Global ceiling of ${GLOBAL_REQUEST_CEILING} provider requests reached.`);
    }
    globalRequests += 1;
    const index = globalRequests;

    // The prompt is written before the call, so a run that dies mid-flight is
    // still reproducible from disk.
    writeFileSync(join(OUT, `run${this.run}-req${index}-prompt.txt`),
      `SYSTEM\n${request.system}\n\n\nUSER\n${request.user}\n`, "utf8");

    const response = await this.inner.send(request, signal);

    const record: RequestRecord = {
      run: this.run,
      index,
      label: request.label,
      ok: response.ok,
      latencyMs: response.latencyMs,
    };

    if (response.ok) {
      // Written before anything looks at it. This is the whole point.
      const rawPath = join(OUT, `run${this.run}-req${index}-raw.txt`);
      writeFileSync(rawPath, response.text, "utf8");
      record.rawPath = rawPath;
      record.inputTokens = response.usage?.promptTokenCount;
      record.outputTokens = response.usage?.candidatesTokenCount;
      record.modelVersion = response.modelVersion;
    } else {
      record.failure = `${response.code}: ${response.message}`;
    }

    records.push(record);
    console.log(
      `  request ${index}/${GLOBAL_REQUEST_CEILING} [${request.label}] ` +
      `${response.ok ? "ok" : `FAILED ${record.failure}`} ` +
      `${response.latencyMs}ms in=${record.inputTokens ?? "?"} out=${record.outputTokens ?? "?"}`,
    );
    return response;
  }
}

/* ── run ─────────────────────────────────────────────────────────────────── */

const config = resolveCodegenConfig();
if (!config.ok) {
  console.error(`Cannot run: ${config.message}`);
  process.exit(1);
}
console.log(`model: ${config.model}`);
console.log(`content keys: ${Object.keys(content).length}`);
console.log(`assets offered: ${TRUSTED_ASSETS.size}`);
console.log(`ceiling: ${GLOBAL_REQUEST_CEILING} provider requests across ${RUNS} runs\n`);

const brief = briefFor();
writeFileSync(join(OUT, "brief.txt"), brief, "utf8");
writeFileSync(join(OUT, "content-pack.json"), JSON.stringify(content, null, 2), "utf8");

interface RunSummary {
  run: number;
  ok: boolean;
  code?: string;
  message?: string;
  issues?: string[];
  requestCount: number;
  totalLatencyMs: number;
  repaired: boolean;
  elementBytes?: number;
  cssBytes?: number;
  assetsUsed?: string[];
  unusedContentKeys?: number;
}

const summaries: RunSummary[] = [];

for (let run = 1; run <= RUNS; run += 1) {
  console.log(`── run ${run} ──`);

  if (globalRequests >= GLOBAL_REQUEST_CEILING) {
    console.log("  skipped: global request ceiling already reached");
    summaries.push({ run, ok: false, code: "ceiling", message: "Global ceiling reached before this run.", requestCount: 0, totalLatencyMs: 0, repaired: false });
    continue;
  }

  let result;
  try {
    result = await generateCodegenBundle(
      { model: config.model, brief, content, routes, assets: TRUSTED_ASSETS },
      new CanaryTransport(new AnthropicCodegenTransport(config.model), run),
    );
  } catch (error) {
    if (error instanceof BudgetExceeded) {
      console.error(`  STOPPED: ${error.message}`);
      summaries.push({ run, ok: false, code: "ceiling", message: error.message, requestCount: 0, totalLatencyMs: 0, repaired: false });
      break;
    }
    throw error;
  }

  if (!result.ok) {
    console.log(`  REFUSED: ${result.code} — ${result.message}`);
    for (const issue of (result.issues ?? []).slice(0, 12)) console.log(`    ${issue}`);
    summaries.push({
      run, ok: false, code: result.code, message: result.message,
      issues: result.issues, requestCount: result.telemetry.requestCount,
      totalLatencyMs: result.telemetry.totalLatencyMs, repaired: result.telemetry.repaired,
    });
    continue;
  }

  // Recompiled from the stored bundle, exactly as the workspace read path does,
  // so what is screenshotted is what a person would actually be shown.
  const recompiled = compileCodegenBundle(result.bundle, { content });
  if (!recompiled.ok) {
    console.log(`  recompile from stored bundle FAILED at ${recompiled.stage}`);
    summaries.push({
      run, ok: false, code: "recompile_failed", message: recompiled.stage,
      issues: recompiled.issues.map((i) => `${i.path}: ${i.code} — ${i.detail}`),
      requestCount: result.telemetry.requestCount,
      totalLatencyMs: result.telemetry.totalLatencyMs, repaired: result.telemetry.repaired,
    });
    continue;
  }

  writeFileSync(join(OUT, `run${run}-bundle.json`), JSON.stringify(result.bundle, null, 2), "utf8");
  for (const [i, route] of recompiled.routes.entries()) {
    writeFileSync(join(OUT, i === 0 ? `run${run}.html` : `run${run}-${i}.html`), route.srcDoc, "utf8");
  }

  console.log(
    `  ACCEPTED  ${recompiled.routes.length} route(s)  ` +
    `${Math.round(recompiled.report.totalSrcDocBytes / 1024)} kB  ` +
    `css ${recompiled.report.cssBytes} B  ` +
    `media: ${recompiled.report.assetsUsed.join(", ") || "none"}  ` +
    `${result.telemetry.repaired ? "(after repair)" : ""}`,
  );

  summaries.push({
    run, ok: true,
    requestCount: result.telemetry.requestCount,
    totalLatencyMs: result.telemetry.totalLatencyMs,
    repaired: result.telemetry.repaired,
    elementBytes: recompiled.routes[0]?.elementBytes,
    cssBytes: recompiled.report.cssBytes,
    assetsUsed: recompiled.report.assetsUsed,
    unusedContentKeys: recompiled.report.unusedContentKeys.length,
  });
}

writeFileSync(join(OUT, "canary-report.json"), JSON.stringify({
  model: config.model,
  runs: RUNS,
  globalRequests,
  ceiling: GLOBAL_REQUEST_CEILING,
  intake: INTAKE,
  locale: LOCALE,
  requests: records,
  summaries,
}, null, 2), "utf8");

console.log(`\ntotal provider requests: ${globalRequests}/${GLOBAL_REQUEST_CEILING}`);
console.log(`accepted: ${summaries.filter((s) => s.ok).length}/${RUNS}`);
console.log(`report → ${join(OUT, "canary-report.json")}`);
