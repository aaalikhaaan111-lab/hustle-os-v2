/**
 * The app canary. ONE end-to-end generation per run, one brief, one model.
 *
 *   npx tsx --env-file=.env.local --conditions=react-server \
 *     scripts/v2/app-canary.mts <out-dir> --brief=<id> [--offline]
 *
 * THIS SPENDS MONEY. The budget is enforced here in code rather than trusted
 * to the operator:
 *
 *   - a hard ceiling of 2 provider requests, checked BEFORE every send;
 *   - exceeding it throws rather than returning a failure, because a failure
 *     would be absorbed by the repair logic and could become another attempt;
 *   - `generateApp` spends the second only on a refusal a model can act on —
 *     never on a transport, auth, quota or timeout failure.
 *
 * The provider comes from `createAppTransport`, which is the one place the app
 * runtime resolves one. This file names no provider and holds no key.
 *
 * Raw responses are written to disk the moment they arrive, before anything
 * parses or compiles them.
 *
 * `--offline` runs the whole harness against a fixture with no provider at
 * all — the only honest way to know the harness works before paying for it.
 */

import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createAppTransport, describeAppProvider } from "../../src/lib/v2/app/provider";
import { generateApp } from "../../src/lib/v2/app/generate";
import { parseFramedProject } from "../../src/lib/v2/app/framing";
import { buildGeneratedApp, describeFailure } from "../../src/lib/v2/app/pipeline";
import { TIMELINE_APP } from "../../src/lib/v2/app/fixtures/timeline";
import type { GeminiResponse, GeminiRequest, GeminiTransport } from "../../src/lib/v2/gemini/transport";

const OUT = process.argv[2];
const OFFLINE = process.argv.includes("--offline");
const BRIEF_ID = process.argv.find((a) => a.startsWith("--brief="))?.split("=")[1] ?? "";
if (!OUT || !BRIEF_ID) {
  console.error("usage: app-canary.mts <output-directory> --brief=<id> [--offline]");
  process.exit(1);
}

/** One generation, one repair. Never more. */
const REQUEST_CEILING = 2;

/**
 * The three briefs, written to answer three different questions.
 *
 * They are deliberately not variations of each other. Two products a shared
 * template could serve would prove nothing about whether the runtime can
 * express structurally different things, which is the claim under test.
 */
const BRIEFS: Record<string, string> = {
  /** A. An interactive tool with a clear core workflow: assemble and measure. */
  setlist: [
    "Setlist is a tool for gigging musicians to build and time a live set before a show.",
    "",
    "The musician has a library of songs they can play. Each song has a title, a key,",
    "a tempo in BPM, a duration, and an energy rating from 1 to 5. They need to:",
    "",
    "- browse the library and narrow it by key, by tempo range, and by energy;",
    "- add songs to tonight's set and remove them again;",
    "- reorder the set, because a set is an arc and the order is the whole craft;",
    "- see the set's total running time update as they build it, and see whether it",
    "  fits the venue's slot length, which they can change;",
    "- mark one song as the encore, and see it held apart from the main set;",
    "- add a song the library does not have, through a form that refuses a missing",
    "  title, a tempo outside 40-220, or a duration that is not a real time.",
    "",
    "Build the working tool, not a page about it. Every one of those has to actually",
    "work when clicked. It should feel like something a musician would open in a",
    "dressing room an hour before a set: fast to read, dense with the information that",
    "matters, and calm rather than loud.",
  ].join("\n"),

  /** B. A different category entirely: a repeating session loop with progress. */
  rehearsal: [
    "Kanji Drill is a study tool for someone learning to read Japanese.",
    "",
    "They work through a deck of characters. Each card has the character, its readings,",
    "its meaning, a stroke count and a JLPT level. A study session works like this:",
    "",
    "- the card shows the character alone; the learner recalls it, then reveals the answer;",
    "- they grade themselves 'again', 'hard' or 'easy', and that grade decides when the",
    "  card comes back inside the session — 'again' returns soon, 'easy' is set aside;",
    "- a session ends when every card has been answered at least once and nothing is",
    "  still marked 'again'; then they see what they got wrong and can go again;",
    "- they can pick which JLPT levels are in the deck before starting, and see how many",
    "  cards that leaves;",
    "- progress through the session is visible while they work, without being a toy.",
    "",
    "Build the working tool. The reveal, the grading, the requeueing and the summary all",
    "have to work. It is used in ten-minute bursts, often on a phone, often tired: large",
    "targets, no hunting, nothing that punishes a mistap.",
  ].join("\n"),

  /** C. An explicit landing-page request, to see whether intent is honoured. */
  landing: [
    "Build a landing page for Kettle, a small espresso roaster in Lisbon that sells",
    "single-origin beans by subscription.",
    "",
    "This is a marketing page, not an application. It needs to explain what they roast",
    "and why it is different, show the current three coffees with their origin, tasting",
    "notes and price, explain how the subscription works, answer the handful of questions",
    "people always ask before subscribing, and end with a clear way to start one.",
    "",
    "The tone is specific and unhurried — people who care where coffee comes from. It",
    "should look like it was designed for this roaster and no one else.",
  ].join("\n"),
  /* ── the final live quality gate: the operator's three briefs, verbatim ── */

  pm: "Build a project management app for a small creative team. It needs a dashboard, " +
    "kanban board, filters, task creation and editing, assignees, deadlines, status changes, " +
    "empty states, and form validation. This is an app, not a marketing landing page.",

  finance: "Build a personal finance app with an overview dashboard, transaction table, " +
    "category filters, budget progress, charts, an add-transaction form with validation, and " +
    "responsive mobile navigation. This is an app, not a marketing landing page.",

  coffee: "Build a premium landing page for a specialty coffee subscription with real visual " +
    "hierarchy, product imagery, plan comparison, testimonials, FAQ, and a signup form.",
  /* ── the final two canaries ─────────────────────────────────────────── */

  ops: [
    "Build a shift operations console for the duty manager of a 60-seat restaurant.",
    "",
    "They run the floor from this during service. It needs to cover:",
    "",
    "- tonight's roster: who is on, their role, their shift window, and whether they",
    "  have clocked in, are on break, or have gone home;",
    "- covers and turns: tables with party size, seated time, and current course, so",
    "  the manager can see what is running long;",
    "- a running log of incidents — a comp, a walkout, a breakage, a supplier",
    "  shortage — that anyone can add during service and that can be filtered by kind",
    "  and severity;",
    "- prep tasks for the next service, checked off as they are done, with what is",
    "  still outstanding always visible;",
    "- a form for logging an incident that refuses a missing description, a severity",
    "  that was not chosen, and a time outside this service.",
    "",
    "Views for the roster, the floor, the incident log and prep, and a summary the",
    "manager reads at the end of the night. Everything filterable and searchable.",
    "It is used standing up, on a phone, in a hurry, under bad lighting.",
  ].join("\n"),

  press: [
    "Build the launch site for OBLIQUE, an independent press that publishes one",
    "book a season in translation.",
    "",
    "This is a marketing site, not an application. It should carry:",
    "",
    "- the season's book, given real weight — title, author, translator, the country",
    "  and language it comes from, an extract worth reading, and the price;",
    "- the three previous seasons, so the list reads as a body of work;",
    "- what the press stands for and how it chooses what to publish;",
    "- the subscription: three tiers, what each includes, and what it costs;",
    "- what readers and reviewers have said;",
    "- the questions people ask before subscribing;",
    "- a way to subscribe that validates what it collects.",
    "",
    "The art direction should feel like a press with a point of view — literary,",
    "confident, and quiet. Type is the main material here. Nobody has sent you",
    "photographs, so make the composition work without them.",
  ].join("\n"),
};

const BRIEF = BRIEFS[BRIEF_ID];
if (!BRIEF) {
  console.error(`unknown brief "${BRIEF_ID}". known: ${Object.keys(BRIEFS).join(", ")}`);
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

interface RequestRecord {
  index: number;
  label: string;
  ok: boolean;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  modelVersion?: string;
  failure?: string;
  promptBytes: number;
  responseBytes?: number;
  rawPath?: string;
  diagnostics?: Record<string, unknown>;
}

const records: RequestRecord[] = [];
let requestCount = 0;

class BudgetExceeded extends Error {}

/** Wraps the resolved transport to count, cap and persist. */
class CanaryTransport implements GeminiTransport {
  constructor(private readonly inner: GeminiTransport) {}

  async send(request: GeminiRequest, signal: AbortSignal): Promise<GeminiResponse> {
    if (requestCount >= REQUEST_CEILING) {
      throw new BudgetExceeded(`Ceiling of ${REQUEST_CEILING} provider requests reached.`);
    }
    requestCount += 1;
    const index = requestCount;

    writeFileSync(
      join(OUT, `req${index}-${request.label}-prompt.txt`),
      `SYSTEM\n${request.system}\n\n\nUSER\n${request.user}\n`,
      "utf8",
    );

    const startedAt = Date.now();
    const response = await this.inner.send(request, signal);

    const record: RequestRecord = {
      index,
      label: request.label,
      ok: response.ok,
      latencyMs: response.latencyMs || Date.now() - startedAt,
      promptBytes: Buffer.byteLength(request.system + request.user, "utf8"),
    };

    if (response.ok) {
      // Written before anything looks at it. This is the whole point.
      const rawPath = join(OUT, `req${index}-${request.label}-raw.txt`);
      writeFileSync(rawPath, response.text, "utf8");
      record.rawPath = rawPath;
      record.responseBytes = Buffer.byteLength(response.text, "utf8");
      record.inputTokens = response.usage?.promptTokenCount;
      record.outputTokens = response.usage?.candidatesTokenCount;
      record.totalTokens = response.usage?.totalTokenCount;
      record.modelVersion = response.modelVersion;
    } else {
      record.failure = `${response.code}: ${response.message}`;
      record.diagnostics = response.diagnostics;
      writeFileSync(
        join(OUT, `req${index}-${request.label}-failure.json`),
        JSON.stringify({ code: response.code, message: response.message, status: response.status,
          latencyMs: response.latencyMs, diagnostics: response.diagnostics ?? null }, null, 2),
        "utf8",
      );
    }

    records.push(record);
    console.log(
      `  request ${index}/${REQUEST_CEILING} [${request.label}] ` +
      `${response.ok ? "ok" : `FAILED ${record.failure}`} ` +
      `${(record.latencyMs / 1000).toFixed(1)}s in=${record.inputTokens ?? "?"} out=${record.outputTokens ?? "?"}`,
    );
    return response;
  }
}

/** The offline stand-in: a fixture, returned as if the model had written it. */
class FixtureTransport implements GeminiTransport {
  async send(): Promise<GeminiResponse> {
    return {
      ok: true,
      text: JSON.stringify(TIMELINE_APP),
      modelVersion: "offline-fixture",
      usage: { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 },
      latencyMs: 1,
    };
  }
}

/* ── run ─────────────────────────────────────────────────────────────────── */

const provider = describeAppProvider();
let inner: GeminiTransport;
let model: string;

if (OFFLINE) {
  inner = new FixtureTransport();
  model = "offline-fixture";
} else {
  const resolved = createAppTransport();
  if (!resolved.ok) {
    console.error(`Cannot run: ${resolved.message}`);
    process.exit(1);
  }
  inner = resolved.transport;
  model = resolved.model;
}

console.log(OFFLINE ? "OFFLINE DRY RUN — no provider, no spend" : "PAID RUN");
console.log(`provider: ${provider.provider}   model: ${model}   configured: ${provider.configured}`);
console.log(`brief: ${BRIEF_ID}   ceiling: ${REQUEST_CEILING} provider requests\n`);

writeFileSync(join(OUT, "brief.txt"), BRIEF, "utf8");

const transport = new CanaryTransport(inner);
const startedAt = Date.now();
let result;
try {
  result = await generateApp({ model, brief: BRIEF, maxRequests: REQUEST_CEILING }, transport);
} catch (error) {
  if (error instanceof BudgetExceeded) {
    console.error(`\nBUDGET STOP: ${error.message}`);
    writeFileSync(join(OUT, "summary.json"), JSON.stringify({ budgetExceeded: true, records }, null, 2), "utf8");
    process.exit(1);
  }
  throw error;
}
const wallMs = Date.now() - startedAt;

/* ── persist everything, including what a success discards ───────────────── */

async function replayFirst(): Promise<{ bundle: unknown; diagnostics: string[]; stage?: string }> {
  const raw = records[0]?.rawPath;
  if (!raw) return { bundle: null, diagnostics: ["The first request never returned."] };
  // The real framed parser, not a local JSON.parse: this helper used to call a
  // perfectly good framed response "invalid JSON" and put that in the record.
  const parsed = parseFramedProject(readFileSync(raw, "utf8"));
  if (!parsed.ok) {
    return {
      bundle: null,
      diagnostics: parsed.issues.map((i) => `${i.path}: ${i.code} — ${i.detail}`),
      stage: "framing",
    };
  }
  const build = await buildGeneratedApp(parsed.value);
  if (build.ok) return { bundle: parsed.value, diagnostics: [] };
  return { bundle: parsed.value, diagnostics: describeFailure(build), stage: build.stage };
}

const first = await replayFirst();
if (first.bundle) writeFileSync(join(OUT, "bundle-initial.json"), JSON.stringify(first.bundle, null, 2), "utf8");
writeFileSync(join(OUT, "diagnostics.json"),
  JSON.stringify({ stage: first.stage ?? null, diagnostics: first.diagnostics }, null, 2), "utf8");

if (records.length > 1 && records[1].rawPath) {
  const text = readFileSync(records[1].rawPath, "utf8").trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(text);
  try {
    const parsed = JSON.parse(fenced ? fenced[1] : text);
    writeFileSync(join(OUT, result.telemetry.repairMode === "patch" ? "patch.json" : "bundle-rewrite.json"),
      JSON.stringify(parsed, null, 2), "utf8");
  } catch {
    writeFileSync(join(OUT, "repair-unparseable.txt"), text, "utf8");
  }
}

if (result.ok) {
  writeFileSync(join(OUT, "bundle-final.json"), JSON.stringify(result.app, null, 2), "utf8");
  writeFileSync(join(OUT, "document.html"), result.document, "utf8");
}

const summary = {
  paid: !OFFLINE,
  provider: provider.provider,
  model,
  brief: BRIEF_ID,
  requestCount,
  repairCount: Math.max(0, requestCount - 1),
  wallMs,
  ok: result.ok,
  failure: result.ok ? null : { code: result.code, message: result.message, stage: result.stage, issues: result.issues },
  repaired: result.telemetry.repaired,
  repairMode: result.telemetry.repairMode ?? null,
  firstResponseStage: first.stage ?? null,
  firstResponseDiagnostics: first.diagnostics,
  requests: records,
  app: result.ok
    ? {
        name: result.app.metadata.name,
        description: result.app.metadata.description,
        files: Object.keys(result.app.files),
        fileCount: Object.keys(result.app.files).length,
        dependencies: result.app.runtime.dependencies,
        routes: result.app.routes.map((r) => ({ path: r.path, module: r.module, title: r.title })),
        sourceBytes: Object.values(result.app.files).reduce((n, f) => n + Buffer.byteLength(f, "utf8"), 0),
        compiledBytes: result.compiledBytes,
        documentBytes: result.documentBytes,
        compileMs: result.compileMs,
      }
    : null,
};
writeFileSync(join(OUT, "summary.json"), JSON.stringify(summary, null, 2), "utf8");

/* ── report ──────────────────────────────────────────────────────────────── */

console.log(`\nrequests: ${requestCount}/${REQUEST_CEILING}   repairs: ${summary.repairCount}   wall: ${(wallMs / 1000).toFixed(1)}s`);
if (first.diagnostics.length > 0) {
  console.log(`\nfirst response refused at "${first.stage}":`);
  for (const line of first.diagnostics.slice(0, 20)) console.log(`  ${line}`);
}
if (!result.ok) {
  console.error(`\nFAILED ${result.code} at "${result.stage ?? "-"}": ${result.message}`);
  for (const issue of (result.issues ?? []).slice(0, 20)) console.error(`  ${issue}`);
  process.exit(1);
}
console.log(`\n✓ ${summary.app!.name}`);
console.log(`  ${summary.app!.fileCount} files, ${(summary.app!.sourceBytes / 1000).toFixed(1)} kB source`);
console.log(`  routes: ${summary.app!.routes.map((r) => r.path).join(", ")}`);
console.log(`  bundle ${(result.compiledBytes / 1000).toFixed(0)} kB, document ${(result.documentBytes / 1000).toFixed(0)} kB, compile ${result.compileMs} ms`);
console.log(`  deps: ${summary.app!.dependencies.join(", ") || "none"}`);
console.log(`  → ${join(OUT, "document.html")}`);
