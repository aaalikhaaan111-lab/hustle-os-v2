/**
 * First-version generation as a durable run.
 *
 *   npx tsx --conditions=react-server scripts/v2/workflow-generation.test.mts
 *
 * WHAT THIS IS FOR. Production killed the old inline pipeline at the platform's
 * 300 s function ceiling, mid-generation, with a job left `running` and a unit
 * of quota spent on nothing. The work now runs as a workflow: each provider
 * call is its own step with its own function, and the run as a whole has no
 * duration limit.
 *
 * That buys duration and costs a new failure mode. A durable runtime retries
 * things. A retried provider step is a second paid generation nobody asked for;
 * a retried persist is a second version; a retried release is a double refund.
 * Most of what follows is about those three never happening.
 *
 * The orchestration is executed for real, with `./steps` swapped for a
 * recording fake — so "how many times did this run call the provider" is
 * measured rather than read off the source.
 *
 * Offline. No provider, no database, no cost.
 */

import { readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import { STEP_CEILING_MS, STEP_OVERHEAD_MS, WORKFLOW_STEP_BUDGETS, STAGE_BUDGETS } from "../../src/lib/v2/gemini/config";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const workflowSource = read("src/workflows/firstVersion/index.ts");
const stepsSource = read("src/workflows/firstVersion/steps.ts");
const actionSource = read("src/lib/actions/stage3.ts");
const starterSource = read("src/lib/v2/app/startWorkflow.ts");

/* ── 1. every provider call fits inside one function ─────────────────────── */

/**
 * The reason the old path died, expressed as an assertion.
 *
 * A workflow step executes as a Vercel Function and inherits its ceiling —
 * 300 s on this plan, where 300 s is both the default and the maximum. A
 * request permitted to spend the whole ceiling leaves nothing for the parse and
 * the return, so the platform kills the step instead of the request timing out
 * cleanly. Each budget must leave real room.
 */
for (const [stage, budget] of Object.entries(WORKFLOW_STEP_BUDGETS)) {
  check(`the ${stage} step's request fits inside a function`, budget + STEP_OVERHEAD_MS <= STEP_CEILING_MS,
    `${budget} + ${STEP_OVERHEAD_MS} > ${STEP_CEILING_MS}`);
}
// The slowest of seventeen measured live Gemini requests was 186.5 s. A budget
// at or under that would turn ordinary variance into a failure.
check("the generate budget clears the slowest observed real request",
  WORKFLOW_STEP_BUDGETS.generate > 186_500, String(WORKFLOW_STEP_BUDGETS.generate));
check("the offline stage budget is the thing that would not fit",
  STAGE_BUDGETS.generate >= STEP_CEILING_MS, String(STAGE_BUDGETS.generate));
check("so the durable path does not use it",
  /timeoutMs: WORKFLOW_STEP_BUDGETS\.generate/.test(stepsSource));
check("and the repair uses its own step budget",
  /timeoutMs: WORKFLOW_STEP_BUDGETS\.repair/.test(stepsSource));

/* ── 2. provider steps never retry ───────────────────────────────────────── */

check("the generation step is not retried", /requestGeneration\.maxRetries = 0/.test(stepsSource));
check("the repair step is not retried", /requestRepair\.maxRetries = 0/.test(stepsSource));

/* ── 3. the action hands off instead of generating ───────────────────────── */

const appBranch = actionSource.slice(
  actionSource.indexOf("if (appRuntimeEnabled()) {"),
  actionSource.indexOf("await beat(job.id, \"generating\");\n    const client = new Anthropic();"),
);
check("the app-runtime branch was found", appBranch.length > 200);
check("it starts a run", /startFirstVersionWorkflow\(/.test(appBranch));
// The whole point: the pipeline no longer runs inside the request.
check("and does not render inline any more", !/renderProjectWithAppRuntime/.test(actionSource));
check("nor waits for a document", !/await renderProjectWithAppRuntime/.test(appBranch));
check("a failed handoff refunds rather than leaving a running row",
  /if \(!handoff\.ok\)/.test(appBranch) && /releaseAndFail/.test(appBranch));

// Ordering: the claim and the reservation still happen before the handoff, so
// a run only ever exists for a job that was genuinely claimed and paid for.
const claimAt = actionSource.indexOf("const job = await claimJob(");
const reserveAt = actionSource.indexOf("const reservation = await reserveUsage(");
const startAt = actionSource.indexOf("const handoff = await startFirstVersionWorkflow(");
check("the job is claimed before quota is reserved", claimAt > 0 && claimAt < reserveAt);
check("and quota is reserved before the run starts", reserveAt > 0 && reserveAt < startAt);
check("the account-wide stale sweep still runs first",
  actionSource.indexOf("await expireStaleForUser(user.id)") < claimAt);
check("and the finality guard still comes before all of it",
  actionSource.indexOf("if (readAppState(project.snapshot_fields))") < claimAt);
check("the run is only started once, from one place",
  (actionSource.match(/startFirstVersionWorkflow\(/g) ?? []).length === 1);
check("and the starter is reached only after a claim",
  /start\(generateFirstVersionWorkflow/.test(starterSource));

/**
 * Reconnecting must not start a second run.
 *
 * A refresh mid-generation remounts the workspace, and the intake can fire the
 * action again. The in-flight guard returns the existing job before anything is
 * claimed, so the second call reaches neither `claimJob` nor `start()` — which
 * is why one run per job is a database guarantee rather than a race the client
 * is trusted to avoid.
 */
const inFlightAt = actionSource.indexOf('previous.status === "queued" || previous.status === "running"');
check("an in-flight job short-circuits the action", inFlightAt > 0);
check("before a second job could be claimed", inFlightAt < claimAt);
check("and it hands back the job already running, not a new one",
  /return \{ error: null, output: null, reply: null, jobId: previous\.id \}/.test(actionSource));

// The workspace reconnects by polling the row it already has, and reloads the
// server render once the run reports success — the application arrives through
// props, not through the action's return value.
const workspaceSource = read("src/components/build/PreOutputWorkspace.tsx");
check("the workspace refreshes when the run succeeds",
  /job\.phase !== "succeeded"/.test(workspaceSource) && /router\.refresh\(\)/.test(workspaceSource));
check("and only once per project, so a failure cannot loop",
  /refreshedForJob\.current === projectId/.test(workspaceSource));
const pollSource = read("src/lib/workspace/useFirstVersionJob.ts");
check("polling recovers a run this tab did not start", /Read once on mount/.test(pollSource));
check("and keeps polling only while something is in flight", /if \(!inFlight\) return;/.test(pollSource));

/* ── 4. the orchestration, executed ──────────────────────────────────────── */

/**
 * Swap the real steps for the recording fake.
 *
 * The workflow imports `./steps` relatively; the hook sees the resolved URL, so
 * matching on the path suffix is enough and stays correct if the tree moves.
 */
const FAKE = new URL("./fixtures/fakeSteps.mts", import.meta.url).href;

/**
 * `registerHooks` is Node 22.15+/24 and is not in this project's @types/node,
 * which targets the runtime the app ships on rather than the one the tests run
 * under. Narrowed to the one shape used here rather than typed in full.
 */
type Resolved = { url: string; shortCircuit?: boolean };
type ResolveHook = (
  specifier: string,
  context: unknown,
  nextResolve: (s: string, c: unknown) => Resolved,
) => Resolved;
const registerHooks = (nodeModule as unknown as {
  registerHooks: (hooks: { resolve: ResolveHook }) => void;
}).registerHooks;

registerHooks({
  resolve(specifier, context, nextResolve) {
    const resolved = nextResolve(specifier, context);
    if (/workflows\/firstVersion\/steps(\.ts)?$/.test(resolved.url.replace(/\?.*$/, ""))) {
      return { ...resolved, url: FAKE, shortCircuit: true };
    }
    return resolved;
  },
});

// Imported by the same URL the hook substitutes, so the test and the workflow
// share one module instance. A relative specifier here resolves through the
// loader to a different key and the recording silently goes to a second copy.
const fake = (await import(FAKE)) as typeof import("./fixtures/fakeSteps.mts");
const { generateFirstVersionWorkflow } = await import("../../src/workflows/firstVersion/index");

const INPUT = {
  jobId: "job-1",
  projectId: "project-1",
  userId: "user-1",
  brief: "a small app",
  locale: "en",
  model: "gemini-3.6-flash",
};

const APP = { metadata: { name: "Courses" } };

/* the happy path: one request, no repair, one save */
{
  fake.__reset({ verdict: { ok: true, app: APP } });
  const result = await generateFirstVersionWorkflow(INPUT as never);
  check("a clean generation succeeds", result.outcome === "generated", JSON.stringify(result));
  check("it asks the provider exactly once", fake.__countOf("requestGeneration") === 1);
  check("it never repairs", fake.__countOf("requestRepair") === 0);
  check("it saves exactly once", fake.__countOf("persistGeneratedApp") === 1);
  check("and refunds nothing", fake.__countOf("failGeneration") === 0);
}

/* a repairable failure buys exactly one repair */
{
  fake.__reset({
    verdict: {
      ok: false, code: "refused", message: "refused", issues: ["src/App.tsx: require"],
      plan: { mode: "rewrite", reason: "no validated project" },
    },
    repairVerdict: { ok: true, app: APP },
  });
  const result = await generateFirstVersionWorkflow(INPUT as never);
  check("a repaired run succeeds", result.outcome === "generated", JSON.stringify(result));
  check("the repair is requested once", fake.__countOf("requestRepair") === 1);
  check("and only once — two requests is the ceiling",
    fake.__countOf("requestGeneration") + fake.__countOf("requestRepair") === 2);
  check("the repair is evaluated", fake.__countOf("evaluateRepair") === 1);
  check("and the result is saved once", fake.__countOf("persistGeneratedApp") === 1);
}

/* a repair that does not fix it fails once, and refunds once */
{
  fake.__reset({
    verdict: {
      ok: false, code: "refused", message: "refused", issues: ["x"],
      plan: { mode: "rewrite", reason: "r" },
    },
    repairVerdict: { ok: false, code: "refused", message: "still refused", issues: ["x"], plan: null },
  });
  const result = await generateFirstVersionWorkflow(INPUT as never);
  check("the run fails", result.outcome === "failed");
  check("it never saves", fake.__countOf("persistGeneratedApp") === 0);
  check("it refunds exactly once", fake.__countOf("failGeneration") === 1);
  check("and never asks for a third request",
    fake.__countOf("requestGeneration") + fake.__countOf("requestRepair") === 2);
}

/* an unrepairable failure buys nothing */
{
  fake.__reset({
    verdict: { ok: false, code: "too_large", message: "truncated", issues: [], plan: null },
  });
  const result = await generateFirstVersionWorkflow(INPUT as never);
  check("a truncated response fails", result.outcome === "failed");
  // The model was cut off, not wrong. Asking again with the same budget buys
  // the same truncation.
  check("and never buys a repair", fake.__countOf("requestRepair") === 0);
  check("refunding once", fake.__countOf("failGeneration") === 1);
}

/* a transport failure never buys a repair either */
{
  fake.__reset({ generation: { ok: false, code: "timeout", message: "timed out", latencyMs: 1 } });
  const result = await generateFirstVersionWorkflow(INPUT as never);
  check("a transport failure fails the run", result.outcome === "failed");
  check("it is not evaluated", fake.__countOf("evaluateGeneration") === 0);
  check("it buys no repair", fake.__countOf("requestRepair") === 0);
  check("and refunds once", fake.__countOf("failGeneration") === 1);
}

/* a failed save refunds rather than reporting success */
{
  fake.__reset({ verdict: { ok: true, app: APP }, persist: { ok: false, message: "gone" } });
  const result = await generateFirstVersionWorkflow(INPUT as never);
  check("a failed save fails the run", result.outcome === "failed");
  check("and refunds", fake.__countOf("failGeneration") === 1);
}

/* ── 5. replay is a no-op ────────────────────────────────────────────────── */

/**
 * The guard that makes a re-run safe.
 *
 * A workflow that is retried from the start, or started twice for the same job
 * by some future caller, must not generate again. `beginGeneration` reads the
 * job and the project rather than trusting anything the run carries.
 */
{
  fake.__reset({ begin: { proceed: false, reason: "the project already has an application" } });
  const result = await generateFirstVersionWorkflow(INPUT as never);
  check("a replayed run skips", result.outcome === "skipped");
  check("it spends nothing", fake.__countOf("requestGeneration") === 0);
  check("writes nothing", fake.__countOf("persistGeneratedApp") === 0);
  check("and refunds nothing — the first run owns that", fake.__countOf("failGeneration") === 0);
}
{
  fake.__reset({ begin: { proceed: false, reason: "the job is already succeeded" } });
  const result = await generateFirstVersionWorkflow(INPUT as never);
  check("a run for a finished job skips too", result.outcome === "skipped");
  check("spending nothing", fake.__countOf("requestGeneration") === 0);
}

check("the guard checks the job status", /job\.status !== "running" && job\.status !== "queued"/.test(stepsSource));
check("and refuses a project that already has an application",
  /if \(readAppState\(project\.snapshot_fields\)\)/.test(stepsSource));

/* ── 6. the steps that may retry are idempotent ──────────────────────────── */

// Persist runs again only if it threw. A project that already holds an
// application is left exactly as it is — re-saving would replace a version the
// person may already be looking at.
check("persist returns early when the app is already stored",
  /if \(readAppState\(project\.snapshot_fields\)\) \{\s*await finishSucceeded/.test(stepsSource));
check("the readiness message is upserted, not inserted",
  /\.upsert\(/.test(stepsSource) && !/project_ai_messages"\)\.insert\(/.test(stepsSource));
check("and its id is derived, so a retry updates one row",
  /derivedMessageId\(conversationId\)/.test(stepsSource));
// The release itself is idempotent in the database; the step just calls it.
check("failure ends the job and releases its unit",
  /finishFailed\(ref\.jobId/.test(stepsSource) && /releaseUsage\(ref\.jobId/.test(stepsSource));

/* ── 7. the run stays visibly alive ──────────────────────────────────────── */

/**
 * A step can legitimately spend four minutes inside one `await`, and a job with
 * no heartbeat for five is swept and refunded. Without a beat *during* the
 * call, a slow-but-healthy generation would have its own quota returned out
 * from under it and then succeed anyway.
 */
check("long steps beat while they work", /setInterval\(\s*\(\) => \{\s*void beat\(/.test(stepsSource));
check("the interval is always cleared", /finally \{\s*clearInterval\(timer\);/.test(stepsSource));
const HEARTBEAT = Number(/const HEARTBEAT_MS = ([\d_]+)/.exec(stepsSource)?.[1]?.replace(/_/g, "") ?? "0");
check("the beat is frequent enough to matter", HEARTBEAT > 0 && HEARTBEAT * 4 < 300_000, String(HEARTBEAT));

/* ── 8. no second job model ──────────────────────────────────────────────── */

check("the workflow advances the existing job row",
  /finishSucceeded\(/.test(stepsSource) && /finishFailed\(/.test(stepsSource));
check("it never claims a job of its own", !/claimJob/.test(stepsSource + workflowSource));
check("and never reserves quota of its own", !/reserveUsage/.test(stepsSource + workflowSource));

/* ── report ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`FAILED ${failures.length} of ${passed + failures.length}`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`workflow generation: ${passed} checks passed`);
