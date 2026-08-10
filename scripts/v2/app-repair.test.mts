/**
 * The repair loop: what a second provider request is spent on, and what it says.
 *
 *   npx tsx --conditions=react-server scripts/v2/app-repair.test.mts
 *
 * Offline. The provider is a fake that returns canned text, so every request in
 * this file is free — but everything between the response and the verdict is
 * the real thing: the real validator, the real esbuild compile, the real patch
 * application. A repair that "works" against a mocked gate proves nothing,
 * because the gate is what the repair has to satisfy.
 *
 * The claims under test:
 *   1. a clean generation costs one request and no repair;
 *   2. a compile failure buys a PATCH, and the patch leaves untouched files
 *      byte-identical;
 *   3. a failure with no valid base buys a REWRITE, because there is nothing to
 *      patch against;
 *   4. a transport failure buys nothing;
 *   5. the ceiling of two requests holds on every path through the function.
 *
 * The --conditions flag is not optional: this pulls in `server-only`, which
 * throws on import under the default condition.
 */

import {
  generateApp,
  repairApp,
  REPAIR_ECHO_FILES,
  REPAIR_WHOLE_PROJECT_BYTES,
} from "../../src/lib/v2/app/generate";
import { PATCH_SCHEMA_VERSION } from "../../src/lib/v2/app/edit";
import {
  PATCH_CLOSE, PATCH_OPEN,
  encodeFramedProject, fileClose, fileOpen,
} from "../../src/lib/v2/app/framing";
import { RuntimeErrorLog } from "../../src/lib/v2/app/protocol";
import { TIMELINE_APP } from "../../src/lib/v2/app/fixtures/timeline";
import type { GeminiRequest, GeminiResponse, GeminiTransport } from "../../src/lib/v2/gemini/transport";
import { readFileSync } from "node:fs";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

/* ── the fake provider ───────────────────────────────────────────────────── */

type Canned = { text: string } | { error: Extract<GeminiResponse, { ok: false }>["code"]; message?: string };

class FakeTransport implements GeminiTransport {
  readonly requests: GeminiRequest[] = [];
  constructor(private readonly canned: Canned[]) {}

  async send(request: GeminiRequest): Promise<GeminiResponse> {
    this.requests.push(request);
    const next = this.canned[this.requests.length - 1];
    if (!next) {
      // A request this test did not plan for. Reported as a distinctive failure
      // rather than an exception, so an over-eager control flow shows up as a
      // named check rather than a stack trace.
      return { ok: false, code: "transport_error", message: "unplanned request", latencyMs: 0 };
    }
    if ("error" in next) {
      return { ok: false, code: next.error, message: next.message ?? next.error, latencyMs: 1 };
    }
    return { ok: true, text: next.text, modelVersion: "fake-1", latencyMs: 1 };
  }
}

const BRIEF = "A timeline of every MCU film and series by in-universe date.";
const input = (over: Record<string, unknown> = {}) => ({ model: "fake-model", brief: BRIEF, ...over });

/** The framed equivalents of what the model now returns. */
const { files: TIMELINE_FILES, ...TIMELINE_HEADER } = TIMELINE_APP;
const GOOD = encodeFramedProject(TIMELINE_HEADER, TIMELINE_FILES);

/** A framed patch: a JSON header naming the files, then their raw bodies. */
const framedPatch = (header: Record<string, unknown>, files: Record<string, string>) =>
  [
    PATCH_OPEN,
    JSON.stringify({ ...header, write: Object.keys(files) }),
    PATCH_CLOSE,
    ...Object.entries(files).flatMap(([path, body]) => [fileOpen(path), body, fileClose(path)]),
  ].join("\n");

/** Validates cleanly, does not compile: a syntax error inside a real component. */
const BROKEN_FILE = "src/App.tsx";
const BROKEN_APP = {
  ...TIMELINE_APP,
  files: {
    ...TIMELINE_APP.files,
    [BROKEN_FILE]: `${TIMELINE_APP.files[BROKEN_FILE]}\nconst unterminated = ;\n`,
  },
};
const { files: BROKEN_FILES, ...BROKEN_HEADER } = BROKEN_APP;
const BROKEN = encodeFramedProject(BROKEN_HEADER, BROKEN_FILES);

const FIX_PATCH = framedPatch(
  { schemaVersion: PATCH_SCHEMA_VERSION, summary: "Remove the unterminated declaration" },
  { [BROKEN_FILE]: TIMELINE_APP.files[BROKEN_FILE] },
);

/* ── 1. a clean generation costs one request ─────────────────────────────── */

{
  const transport = new FakeTransport([{ text: GOOD }]);
  const result = await generateApp(input(), transport);
  check("a clean generation succeeds", result.ok, result.ok ? "" : `${result.code}: ${result.message}`);
  check("and costs exactly one request", result.telemetry.requestCount === 1, String(result.telemetry.requestCount));
  check("and is not marked repaired", !result.telemetry.repaired);
  check("and no repair mode is recorded", result.telemetry.repairMode === undefined);
  if (result.ok) {
    check("it returns a document", result.document.length > 0);
    check("and the app it accepted", result.app.metadata.name === TIMELINE_APP.metadata.name);
    check("and the raw response, for offline replay", result.raw === GOOD);
  }
  check("the request asked for an artifact", transport.requests[0]?.label === "artifact");
  check("and carried the brief", transport.requests[0]?.user.includes(BRIEF) ?? false);
}

/* ── 2. a fenced response does not cost a repair ─────────────────────────── */

// Every one of the three paid codegen canary responses arrived wrapped in a
// ```json fence despite the prompt forbidding it, and a bare JSON.parse spent a
// repair request on each. The app path inherits the tolerance, not the defect.
{
  const transport = new FakeTransport([{ text: "```\n" + GOOD + "\n```" }]);
  const result = await generateApp(input(), transport);
  check("a fenced project is accepted", result.ok, result.ok ? "" : result.message);
  check("without spending a repair", result.telemetry.requestCount === 1);
}

/* ── 3. a compile failure buys a patch ───────────────────────────────────── */

{
  const transport = new FakeTransport([{ text: BROKEN }, { text: FIX_PATCH }]);
  const result = await generateApp(input(), transport);

  check("a compile failure is repaired", result.ok, result.ok ? "" : `${result.code}: ${result.message}`);
  check("in two requests", result.telemetry.requestCount === 2, String(result.telemetry.requestCount));
  check("recorded as repaired", result.telemetry.repaired);
  check("by patching, not rewriting", result.telemetry.repairMode === "patch");
  check("with both stages in the telemetry", result.telemetry.stages.length === 2);

  const repairRequest = transport.requests[1];
  check("the repair is labelled as one", repairRequest?.label === "repair");
  check("it carries the compiler's diagnostic", /unterminated|Expected|Unexpected/i.test(repairRequest?.user ?? ""));
  check("it names the failing file", repairRequest?.user.includes(BROKEN_FILE) ?? false);
  check("it reproduces that file's current contents",
    repairRequest?.user.includes("const unterminated = ;") ?? false);
  check("it asks for a patch", repairRequest?.user.includes(PATCH_SCHEMA_VERSION) ?? false);
  // THE DEFECT THIS CAUGHT: esbuild reports every path under its virtual
  // namespace, so `file` arrived as "ventrio-app:src/App.tsx". That matches no
  // key in `app.files`, so the loop found no implicated file and quietly
  // downgraded every patch request to a whole-project echo — working, costing
  // more, and never once failing a test.
  check("the diagnostic path is project-relative, not namespaced",
    !(repairRequest?.user.includes("ventrio-app:") ?? true));
  check("it lists the files it did not reproduce",
    repairRequest?.user.includes("src/styles.css") ?? false);
  check("and says they are not to be rewritten",
    /do not rewrite one from memory/i.test(repairRequest?.user ?? ""));

  // THE PROPERTY THAT MATTERS. A repair is an edit, so everything it did not
  // name must survive byte-identical. Asserted file by file rather than
  // inferred from the build succeeding.
  if (result.ok) {
    const untouched = Object.keys(TIMELINE_APP.files).filter((path) => path !== BROKEN_FILE);
    const identical = untouched.every((path) => result.app.files[path] === TIMELINE_APP.files[path]);
    check("every unrelated file is byte-identical", identical);
    check("the repaired file is the fixed one", result.app.files[BROKEN_FILE] === TIMELINE_APP.files[BROKEN_FILE]);
    check("no file was lost", Object.keys(result.app.files).length === Object.keys(TIMELINE_APP.files).length);
    check("the raw kept is the patch, not the broken project", result.raw === FIX_PATCH);
  }
}

/* ── 4. no base means a rewrite ──────────────────────────────────────────── */

{
  const transport = new FakeTransport([{ text: "I'm afraid I can't do that." }, { text: GOOD }]);
  const result = await generateApp(input(), transport);

  check("an unparseable response is repaired", result.ok, result.ok ? "" : result.message);
  check("by rewriting, because there is nothing to patch", result.telemetry.repairMode === "rewrite");
  const rewrite = transport.requests[1];
  check("the rewrite restates the brief", rewrite?.user.includes(BRIEF) ?? false);
  check("and asks for the whole project", /whole\s*\n?project again/i.test(rewrite?.user ?? ""));
  check("and does not ask for a patch", !(rewrite?.user.includes(PATCH_SCHEMA_VERSION) ?? true));
}

{
  // A validation failure also has no base: the project never passed the gate,
  // so `applyPatch` has nothing legal to apply a patch to.
  // A path the *validator* refuses, delivered through a well-formed frame:
  // framing checks paths too, so this uses one that only validation rejects —
  // a legal path importing a library that is not on the allowlist.
  const refused = encodeFramedProject(TIMELINE_HEADER, {
    ...TIMELINE_FILES,
    "src/App.tsx": 'import x from "jquery";\n' + TIMELINE_FILES["src/App.tsx"],
  });
  const transport = new FakeTransport([{ text: refused }, { text: GOOD }]);
  const result = await generateApp(input(), transport);
  check("a refused project is repaired by rewriting", result.telemetry.repairMode === "rewrite");
  check("and the rewrite carries the validator's own words",
    /import_/.test(transport.requests[1]?.user ?? ""));
  check("and it succeeds", result.ok, result.ok ? "" : result.message);
}

/* ── 5. what a repair is NOT spent on ────────────────────────────────────── */

{
  const transport = new FakeTransport([{ error: "server_error", message: "Gemini is unavailable (503)." }]);
  const result = await generateApp(input(), transport);
  check("a transport failure is not repaired", !result.ok);
  check("and costs one request, not two", result.telemetry.requestCount === 1, String(result.telemetry.requestCount));
  check("and is reported as transport", !result.ok && result.code === "transport");
  check("no repair was attempted", transport.requests.length === 1);
}

{
  const transport = new FakeTransport([{ error: "timeout" }]);
  const result = await generateApp(input(), transport);
  check("a timeout is reported as one", !result.ok && result.code === "timeout");
  check("and is not retried", transport.requests.length === 1);
}

{
  // maxRequests 1 must report why the project was rejected, not "budget
  // exhausted" from a request that was never allowed to happen.
  const transport = new FakeTransport([{ text: BROKEN }]);
  const result = await generateApp(input({ maxRequests: 1 }), transport);
  check("at maxRequests 1 the repair is never attempted", transport.requests.length === 1);
  check("and the real failure is reported", !result.ok && result.stage === "compile");
  check("with the compiler's diagnostics attached", !result.ok && (result.issues?.length ?? 0) > 0);
  check("and no repair mode is claimed", result.telemetry.repairMode === undefined);
}

/* ── 6. the second request can fail too ──────────────────────────────────── */

{
  const transport = new FakeTransport([{ text: BROKEN }, { error: "timeout" }]);
  const result = await generateApp(input(), transport);
  check("a failed repair leaves the run failed", !result.ok);
  check("the original failure is still what is reported", !result.ok && result.stage === "compile");
  check("and the message says the repair failed too",
    !result.ok && /repair request failed/i.test(result.message));
  check("two requests, no more", result.telemetry.requestCount === 2);
}

{
  const nonsense = framedPatch({ schemaVersion: PATCH_SCHEMA_VERSION, summary: "x" }, { "package.json": "{}" });
  const transport = new FakeTransport([{ text: BROKEN }, { text: nonsense }]);
  const result = await generateApp(input(), transport);
  check("a patch that breaks a rule is refused", !result.ok);
  // Framing now rejects a reserved path before applyPatch ever sees it, so the
  // refusal arrives one layer earlier than it used to. Earlier is better: the
  // bytes are never attributed to a path Ventrio owns.
  check("refused before the patch is applied", !result.ok && result.code === "unparseable");
  check("naming the reserved path", !result.ok && (result.issues ?? []).some((i) => i.includes("package.json")));
  check("and the run stops there", transport.requests.length === 2);
}

{
  const stillBroken = framedPatch(
    { schemaVersion: PATCH_SCHEMA_VERSION, summary: "Not actually a fix" },
    { [BROKEN_FILE]: `${TIMELINE_APP.files[BROKEN_FILE]}\nconst also = ;\n` },
  );
  const transport = new FakeTransport([{ text: BROKEN }, { text: stillBroken }]);
  const result = await generateApp(input(), transport);
  check("a patch that does not fix it is not accepted", !result.ok);
  check("and says the repair did not resolve it",
    !result.ok && /did not resolve/i.test(result.message));
  check("and the ceiling of two holds", transport.requests.length === 2);
}

/* ── 7. the standalone repair, for errors that arrive later ──────────────── */

// A build failure is caught before the app renders. A runtime error arrives
// from the preview, from a project that compiled cleanly, with no generation in
// flight — so the same loop has to be reachable from outside `generateApp`.
{
  const log = new RuntimeErrorLog();
  log.add({ kind: "TypeError", message: "Cannot read properties of undefined (reading 'map')", stack: "at App" });
  log.add({ kind: "TypeError", message: "Cannot read properties of undefined (reading 'map')", stack: "at App" });

  const patch = framedPatch(
    { schemaVersion: PATCH_SCHEMA_VERSION, summary: "Guard the empty case" },
    { "src/styles.css": TIMELINE_APP.files["src/styles.css"].replace("--bg:#0b0c0f", "--bg:#050506") },
  );
  const transport = new FakeTransport([{ text: patch }]);
  const result = await repairApp(
    { model: "fake-model", base: TIMELINE_APP, diagnostics: log.describe(), focus: [BROKEN_FILE] },
    transport,
  );

  check("a runtime error can be repaired", result.ok, result.ok ? "" : result.message);
  check("in one request", result.telemetry.requestCount === 1);
  check("the diagnostics reach the prompt",
    transport.requests[0]?.user.includes("Cannot read properties of undefined") ?? false);
  check("de-duplicated, with the repeat count",
    transport.requests[0]?.user.includes("(x2)") ?? false);
  check("and the focus file is reproduced",
    transport.requests[0]?.user.includes(BROKEN_FILE) ?? false);
  if (result.ok) {
    check("the patch applied", result.app.files["src/styles.css"].includes("--bg:#050506"));
  }
}

{
  const transport = new FakeTransport([{ text: PATCH_OPEN }]);
  const result = await repairApp(
    { model: "fake-model", base: TIMELINE_APP, diagnostics: [] },
    transport,
  );
  check("a repair with nothing to fix is refused before it is paid for", !result.ok);
  check("and no request is made", transport.requests.length === 0);
}

{
  // No focus and a project too large to reproduce: a patch request would be
  // written against a base the model cannot see, so it is refused rather than
  // truncated.
  const huge = {
    ...TIMELINE_APP,
    files: { ...TIMELINE_APP.files, "src/huge.ts": "//" + "x".repeat(REPAIR_WHOLE_PROJECT_BYTES + 1) },
  };
  const transport = new FakeTransport([{ text: PATCH_OPEN }]);
  const result = await repairApp(
    { model: "fake-model", base: huge, diagnostics: ["something went wrong"] },
    transport,
  );
  check("an unshowable base is refused", !result.ok && result.code === "too_large");
  check("and costs nothing", transport.requests.length === 0);
}

/* ── 8. bounds and policy, asserted at the source ────────────────────────── */

const source = readFileSync(new URL("../../src/lib/v2/app/generate.ts", import.meta.url), "utf8");

// A compile timeout or an internal compiler error is Ventrio's problem. Asking
// a model to fix our compiler spends the user's money on a guess.
check("only model-caused compile failures buy a repair",
  /REPAIRABLE_COMPILE_CODES = new Set\(\["build_failed", "budget_output"\]\)/.test(source));
check("the ceiling is two", /APP_MAX_REQUESTS = 2/.test(source));
check("and is also enforced by the transport", /new BudgetedTransport\(/.test(source));
check("the deadline is derived from the stages it may run", /deadlineFor\(maxRequests >= 2/.test(source));
check("the repair uses the repair budget", /timeoutMs: GENERATION_LIMITS\.repairTimeoutMs/.test(source));
check("the echo is bounded by files and by bytes",
  /slice\(0, REPAIR_ECHO_FILES\)/.test(source) && /REPAIR_ECHO_BYTES/.test(source));
check("the echo limit is small enough to be a limit", REPAIR_ECHO_FILES <= 10);
check("nothing is applied in place", /applyPatch\(base, framed\.value\)/.test(source));

/* ── report ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`FAILED ${failures.length} of ${passed + failures.length}`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`app repair: ${passed} checks passed`);
