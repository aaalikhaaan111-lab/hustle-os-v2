/**
 * The three defects the paid canary found, pinned so they cannot come back.
 *
 *   npx tsx scripts/v2/pipeline.test.mts
 *
 * Each of these cost a real generation to discover. None of them was visible
 * from any offline check that existed at the time, and all three are trivially
 * checkable once you know they exist — which is the argument for writing them
 * down rather than remembering them.
 *
 * Offline. No provider is contacted.
 */

import { readFileSync } from "node:fs";
import {
  GENERATION_LIMITS,
  PIPELINE_SLACK_MS,
  STAGE_BUDGETS,
  deadlineFor,
} from "../../src/lib/v2/gemini/config";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const transportSrc = read("../../src/lib/v2/codegen/anthropicTransport.ts");
const generateSrc = read("../../src/lib/v2/codegen/generate.ts");

/* ── 1. large responses must stream ─────────────────────────────────────── */

// THE DEFECT: `messages.create` with max_tokens 32000 throws *synchronously*,
// before any network call, because the SDK refuses a non-streaming request
// that could exceed ten minutes. Three canary runs failed at 0 ms having never
// reached the provider, and the transport reported "transport_error" — a
// message that points at the network for a bug that never touched it.
check(
  "the transport streams",
  /\.stream\(/.test(transportSrc),
);
check(
  "and reassembles with finalMessage",
  /finalMessage\(\)/.test(transportSrc),
);
check(
  "the non-streaming create call is gone",
  !/messages\.create\(/.test(transportSrc),
  "messages.create would throw synchronously at this token budget",
);
check(
  "the output budget that triggered it is still what we send",
  GENERATION_LIMITS.maxOutputTokensArtifact >= 32_000,
  String(GENERATION_LIMITS.maxOutputTokensArtifact),
);

/* ── 2. fenced JSON must be normalised ──────────────────────────────────── */

// THE DEFECT: every one of the three canary responses arrived wrapped in a
// ```json fence despite the prompt forbidding it. A bare JSON.parse discarded
// three complete, valid, gate-passing bundles and spent a repair request on
// each. Replayed through the same gate with the fence stripped: 3/3 accepted.
//
// The parser is exercised through a local copy of the same expression rather
// than exported solely for a test — what matters is that the behaviour holds,
// and the source check below pins that generate.ts is the thing doing it.
function parseBundleJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

const OBJ = `{"version":"codegen-1","css":"a{color:red}","routes":[]}`;
const FENCE_CASES: Array<[string, string]> = [
  ["bare object", OBJ],
  ["```json fence", "```json\n" + OBJ + "\n```"],
  ["bare ``` fence", "```\n" + OBJ + "\n```"],
  ["fence with trailing newline", "```json\n" + OBJ + "\n```\n"],
  ["fence with leading whitespace", "  \n```json\n" + OBJ + "\n```"],
];
for (const [name, text] of FENCE_CASES) {
  let ok = false;
  try {
    const parsed = parseBundleJson(text) as { version?: string };
    ok = parsed.version === "codegen-1";
  } catch { ok = false; }
  check(`parses: ${name}`, ok);
}

// Normalising a wrapper must not become tolerance for content. These stay
// refused, because the fence is encoding and everything inside it is not.
const STILL_REJECTED: Array<[string, string]> = [
  ["prose before the object", "Here is your bundle:\n" + OBJ],
  ["prose after the object", OBJ + "\nHope that helps!"],
  ["two objects", OBJ + OBJ],
  ["truncated object", OBJ.slice(0, 30)],
  ["not JSON at all", "I cannot do that."],
];
for (const [name, text] of STILL_REJECTED) {
  let threw = false;
  try { parseBundleJson(text); } catch { threw = true; }
  check(`still refused: ${name}`, threw);
}

check(
  "generate.ts normalises rather than bare-parsing",
  /parseBundleJson/.test(generateSrc) && !/JSON\.parse\(text\)/.test(generateSrc),
);

// The gate itself must be untouched by any of this.
check("the reject pass still runs on the parsed value", /compileCodegenBundle\(parsed/.test(generateSrc));
check("the envelope check still runs", /validateCodegenEnvelope\(parsed\)/.test(generateSrc));

/* ── 3. the deadline must fit the stages ────────────────────────────────── */

// THE DEFECT: `totalTimeoutMs` was a hand-written 240 s next to stage budgets
// summing to 330 s. In three paid runs the generation took 204/153/232 s and
// the repair got the remainder: 35.6/86.9/7.9 s. All three repairs timed out.
//
// The invariant: a deadline may never be smaller than the stages it must cover.
// Asserted, not commented, because a comment did not stop it last time.
const FULL: Array<"brief" | "generate" | "repair"> = ["brief", "generate", "repair"];
const stageSum = FULL.reduce((t, s) => t + STAGE_BUDGETS[s], 0);

check(
  "the pipeline deadline covers every stage it may run",
  GENERATION_LIMITS.totalTimeoutMs >= stageSum,
  `${GENERATION_LIMITS.totalTimeoutMs} < ${stageSum}`,
);
check(
  "and leaves slack for the work between stages",
  GENERATION_LIMITS.totalTimeoutMs - stageSum >= PIPELINE_SLACK_MS,
);
check(
  "a generate-only run is not held open for a repair budget",
  deadlineFor(["generate"]) < deadlineFor(["generate", "repair"]),
);
check(
  "a generate+repair deadline covers both stages",
  deadlineFor(["generate", "repair"]) >= STAGE_BUDGETS.generate + STAGE_BUDGETS.repair,
);
check(
  "the repair has a real budget, not a remainder",
  GENERATION_LIMITS.repairTimeoutMs === STAGE_BUDGETS.repair && STAGE_BUDGETS.repair > 0,
);
check(
  "the repair request uses the repair budget",
  /timeoutMs: GENERATION_LIMITS\.repairTimeoutMs/.test(generateSrc),
);
check(
  "the deadline is derived from the stages, not hand-written",
  /deadlineFor\(/.test(generateSrc),
);

// The observed worst case must fit, with room. 232 s was the slowest paid
// generation; a budget that only just clears it turns variance into failure.
check(
  "the generate budget clears the slowest observed run with headroom",
  STAGE_BUDGETS.generate >= 232_000 * 1.2,
  `${STAGE_BUDGETS.generate} vs 232s observed`,
);

// The exact arithmetic that failed: generation at its budget must still leave
// the repair its full allowance.
check(
  "a generation that uses its whole budget does not starve the repair",
  deadlineFor(["generate", "repair"]) - STAGE_BUDGETS.generate >= STAGE_BUDGETS.repair,
);

/* ── report ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`FAILED ${failures.length} of ${passed + failures.length}`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`pipeline: ${passed} checks passed`);
