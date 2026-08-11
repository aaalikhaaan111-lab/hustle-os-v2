/**
 * First-version generation, as the queue runs it.
 *
 *   npx tsx --conditions=react-server scripts/v2/queue-generation.test.mts
 *
 * WHAT THIS IS FOR. Production killed the old inline pipeline at the platform's
 * 300 s function ceiling, mid-generation, with a job left `running` and a unit
 * of quota spent on nothing. The work now runs from a queue: each provider call
 * is its own message and its own function invocation.
 *
 * That buys duration and costs a new failure mode. A queue delivers at least
 * once. A redelivered generate message is a second paid generation nobody asked
 * for; a redelivered persist is a second version; a redelivered release is a
 * double refund. Most of what follows is about those three never happening.
 *
 * The orchestration is executed for real, with the stages, the queue and the
 * provider-request guard swapped for a recording fake — so "how many times did
 * this call the provider" is measured rather than read off the source. The
 * guard is modelled on the migration's compare-and-swap rather than stubbed,
 * which is what lets a test deliver the same message twice.
 *
 * Offline. No provider, no database, no queue, no cost.
 */

import { readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import { FUNCTION_CEILING_MS, CONSUMER_OVERHEAD_MS, CONSUMER_BUDGETS, STAGE_BUDGETS } from "../../src/lib/v2/gemini/config";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const runSource = read("src/lib/v2/app/runGeneration.ts");
const stagesSource = read("src/lib/v2/app/stages.ts");
const consumerSource = read("src/app/api/queues/app-generation/route.ts");
const queueSource = read("src/lib/v2/app/generationQueue.ts");
const actionSource = read("src/lib/actions/stage3.ts");

/* ── 1. every provider call fits inside one function ─────────────────────── */

/**
 * The reason the old path died, expressed as an assertion.
 *
 * A queue consumer executes as a Vercel Function and inherits its ceiling —
 * 300 s on this plan, where 300 s is both the default and the maximum. A
 * request permitted to spend the whole ceiling leaves nothing for the parse and
 * the return, so the platform kills the invocation instead of the request
 * timing out cleanly. Each budget must leave real room.
 */
for (const [stage, budget] of Object.entries(CONSUMER_BUDGETS)) {
  check(`the ${stage} request fits inside one invocation`, budget + CONSUMER_OVERHEAD_MS <= FUNCTION_CEILING_MS,
    `${budget} + ${CONSUMER_OVERHEAD_MS} > ${FUNCTION_CEILING_MS}`);
}
// The slowest of seventeen measured live Gemini requests was 186.5 s. A budget
// at or under that would turn ordinary variance into a failure.
check("the generate budget clears the slowest observed real request",
  CONSUMER_BUDGETS.generate > 186_500, String(CONSUMER_BUDGETS.generate));
check("the offline stage budget is the thing that would not fit",
  STAGE_BUDGETS.generate >= FUNCTION_CEILING_MS, String(STAGE_BUDGETS.generate));
check("so the queued path does not use it",
  /timeoutMs: CONSUMER_BUDGETS\.generate/.test(stagesSource));
check("and the repair uses its own budget",
  /timeoutMs: CONSUMER_BUDGETS\.repair/.test(stagesSource));

/* ── 2. the consumer never retries, and never runs twice ─────────────────── */

// A retry is a second paid generation nobody asked for. `acknowledge` drops the
// message rather than redelivering it.
check("the consumer disables queue retries", /retry: \(\) => \(\{ acknowledge: true \}\)/.test(consumerSource));
// The lease must outlive the handler, or the message is redelivered mid-call
// and a second request is paid for.
check("and holds the lease past the longest call",
  /visibilityTimeoutSeconds: (\d+)/.test(consumerSource)
    && Number(/visibilityTimeoutSeconds: (\d+)/.exec(consumerSource)![1]) * 1000 > CONSUMER_BUDGETS.generate);
check("the consumer may run for the whole function ceiling",
  new RegExp(`maxDuration = ${FUNCTION_CEILING_MS / 1000}`).test(consumerSource));
// The guard that actually protects the money: a counter on the job, moved by a
// compare-and-swap, so a redelivered message is refused before it spends.
check("each phase claims a provider request first",
  (runSource.match(/claimProviderRequest\(/g) ?? []).length === 2);
check("generation claims from zero, repair from one",
  /GENERATE_EXPECTS = 0/.test(runSource) && /REPAIR_EXPECTS = 1/.test(runSource));
check("the claim comes before the provider call",
  runSource.indexOf("claimProviderRequest(ref.jobId, GENERATE_EXPECTS)") < runSource.indexOf("await requestGeneration("));
check("and the guard fails closed", /return false;\n  \}\n  return data === true;/.test(read("src/lib/jobs/generationJobs.ts")));

/* ── 3. the action hands off instead of generating ───────────────────────── */

const appBranch = actionSource.slice(
  actionSource.indexOf("if (appRuntimeEnabled()) {"),
  actionSource.indexOf("await beat(job.id, \"generating\");\n    const client = new Anthropic();"),
);
check("the app-runtime branch was found", appBranch.length > 200);
check("it enqueues the work", /enqueueGeneration\(/.test(appBranch));
// The whole point: the pipeline no longer runs inside the request.
check("and does not render inline any more", !/renderProjectWithAppRuntime/.test(actionSource));
check("a failed enqueue refunds rather than leaving a running row",
  /if \(!queued\.ok\)/.test(appBranch) && /releaseAndFail/.test(appBranch));

// Ordering: the claim and the reservation still happen before the handoff, so
// a run only ever exists for a job that was genuinely claimed and paid for.
const claimAt = actionSource.indexOf("const job = await claimJob(");
const reserveAt = actionSource.indexOf("const reservation = await reserveUsage(");
const startAt = actionSource.indexOf("const queued = await enqueueGeneration(");
check("the job is claimed before quota is reserved", claimAt > 0 && claimAt < reserveAt);
check("and quota is reserved before anything is queued", reserveAt > 0 && reserveAt < startAt);
check("the account-wide stale sweep still runs first",
  actionSource.indexOf("await expireStaleForUser(user.id)") < claimAt);
check("and the finality guard still comes before all of it",
  actionSource.indexOf("if (readAppState(project.snapshot_fields))") < claimAt);
check("the work is enqueued once, from one place",
  (actionSource.match(/enqueueGeneration\(/g) ?? []).length === 1);
// The outer of two guards: the queue itself refuses a duplicate publish.
check("every send carries an idempotency key derived from the job",
  /idempotencyKey,/.test(queueSource)
    && /`generate:\$\{input\.jobId\}`/.test(queueSource)
    && /`repair:\$\{input\.jobId\}`/.test(queueSource));

/**
 * Reconnecting must not enqueue a second time.
 *
 * A refresh mid-generation remounts the workspace, and the intake can fire the
 * action again. The in-flight guard returns the existing job before anything is
 * claimed, so the second call reaches neither `claimJob` nor the enqueue —
 * which is why one message per job is a database guarantee rather than a race
 * the client is trusted to avoid.
 */
const inFlightAt = actionSource.indexOf('previous.status === "queued" || previous.status === "running"');
check("an in-flight job short-circuits the action", inFlightAt > 0);
check("before a second job could be claimed", inFlightAt < claimAt);
check("and it hands back the job already running, not a new one",
  /return \{ error: null, output: null, reply: null, jobId: previous\.id \}/.test(actionSource));

// The workspace reconnects by polling the row it already has, and reloads the
// server render once the job reports success — the application arrives through
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
 * Swap the stages, the queue and the guard for the recording fake.
 *
 * The consumer imports all three relatively; the hook sees the resolved URL, so
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

const FAKED = /(lib\/v2\/app\/(stages|generationQueue)|lib\/jobs\/generationJobs)(\.ts)?$/;
registerHooks({
  resolve(specifier, context, nextResolve) {
    const resolved = nextResolve(specifier, context);
    if (FAKED.test(resolved.url.replace(/\?.*$/, ""))) {
      return { ...resolved, url: FAKE, shortCircuit: true };
    }
    return resolved;
  },
});

// Imported by the same URL the hook substitutes, so the test and the consumer
// share one module instance. A relative specifier here resolves through the
// loader to a different key and the recording silently goes to a second copy.
const fake = (await import(FAKE)) as typeof import("./fixtures/fakeSteps.mts");
const { runGeneratePhase, runRepairPhase } = await import("../../src/lib/v2/app/runGeneration");

const GENERATE = {
  phase: "generate" as const,
  jobId: "job-1",
  projectId: "project-1",
  userId: "user-1",
  brief: "a small app",
  locale: "en",
  model: "gemini-3.6-flash",
};

const APP = { metadata: { name: "Courses" } };
const PLAN = { mode: "rewrite" as const, reason: "no validated project" };
const REPAIRABLE = {
  ok: false, code: "refused", message: "refused", issues: ["src/App.tsx: require"], plan: PLAN,
};
const repairMessage = () => ({ ...GENERATE, phase: "repair" as const, issues: REPAIRABLE.issues, plan: PLAN });

/* the happy path: one request, no repair, one save */
{
  fake.__reset({ verdict: { ok: true, app: APP } });
  const result = await runGeneratePhase(GENERATE as never);
  check("a clean generation succeeds", result.outcome === "generated", JSON.stringify(result));
  check("it asks the provider exactly once", fake.__countOf("requestGeneration") === 1);
  check("it never repairs", fake.__countOf("requestRepair") === 0);
  check("it queues nothing further", fake.__countOf("enqueueRepair") === 0);
  check("it saves exactly once", fake.__countOf("persistGeneratedApp") === 1);
  check("and refunds nothing", fake.__countOf("failGeneration") === 0);
  check("one provider request is recorded against the job", fake.__claimed("job-1") === 1);
}

/* a repairable failure queues exactly one repair, and does not run it here */
{
  fake.__reset({ verdict: REPAIRABLE });
  const result = await runGeneratePhase(GENERATE as never);
  check("a repairable failure queues a repair", result.outcome === "queued-repair", JSON.stringify(result));
  check("the repair is queued once", fake.__countOf("enqueueRepair") === 1);
  // The whole point of the second message: the repair gets its own function,
  // rather than whatever time this invocation has left.
  check("and is not run inside this invocation", fake.__countOf("requestRepair") === 0);
  check("nothing is saved yet", fake.__countOf("persistGeneratedApp") === 0);
  check("and nothing is refunded yet", fake.__countOf("failGeneration") === 0);
  check("the plan the gate chose travels with it",
    JSON.stringify((fake.__calls().find((c) => c.step === "enqueueRepair")!.args[0] as { plan: unknown }).plan)
      === JSON.stringify(PLAN));

  // The repair message then arrives at its own invocation.
  const repaired = await runRepairPhase(repairMessage() as never);
  check("the repair succeeds", repaired.outcome === "generated", JSON.stringify(repaired));
  check("it asks the provider once", fake.__countOf("requestRepair") === 1);
  check("two provider requests, total, across both phases", fake.__claimed("job-1") === 2);
  check("and the result is saved once", fake.__countOf("persistGeneratedApp") === 1);
}

/* a repair that does not fix it fails once, and refunds once */
{
  fake.__reset({
    repairVerdict: { ok: false, code: "refused", message: "still refused", issues: ["x"], plan: null },
  });
  fake.__claimed("job-1");
  await claimTo(1);
  const result = await runRepairPhase(repairMessage() as never);
  check("the run fails", result.outcome === "failed", JSON.stringify(result));
  check("it never saves", fake.__countOf("persistGeneratedApp") === 0);
  check("it refunds exactly once", fake.__countOf("failGeneration") === 1);
}

/* an unrepairable failure buys nothing */
{
  fake.__reset({ verdict: { ok: false, code: "too_large", message: "truncated", issues: [], plan: null } });
  const result = await runGeneratePhase(GENERATE as never);
  check("a truncated response fails", result.outcome === "failed");
  // The model was cut off, not wrong. Asking again with the same budget buys
  // the same truncation.
  check("and never queues a repair", fake.__countOf("enqueueRepair") === 0);
  check("refunding once", fake.__countOf("failGeneration") === 1);
}

/* a transport failure never buys a repair either */
{
  fake.__reset({ generation: { ok: false, code: "timeout", message: "timed out", latencyMs: 1 } });
  const result = await runGeneratePhase(GENERATE as never);
  check("a transport failure fails the run", result.outcome === "failed");
  check("it is not evaluated", fake.__countOf("evaluateGeneration") === 0);
  check("it queues no repair", fake.__countOf("enqueueRepair") === 0);
  check("and refunds once", fake.__countOf("failGeneration") === 1);
}

/* a failed enqueue is a failed generation, not a silent stall */
{
  fake.__reset({ verdict: REPAIRABLE, enqueue: { ok: false, message: "queue down" } });
  const result = await runGeneratePhase(GENERATE as never);
  check("a repair that cannot be queued fails the run", result.outcome === "failed");
  check("and refunds, rather than leaving a running job", fake.__countOf("failGeneration") === 1);
}

/* a failed save refunds rather than reporting success */
{
  fake.__reset({ verdict: { ok: true, app: APP }, persist: { ok: false, message: "gone" } });
  const result = await runGeneratePhase(GENERATE as never);
  check("a failed save fails the run", result.outcome === "failed");
  check("and refunds", fake.__countOf("failGeneration") === 1);
}

/* ── 5. duplicate delivery ───────────────────────────────────────────────── */

/**
 * The property the whole design turns on.
 *
 * A queue delivers at least once. The same message, delivered twice, must cost
 * exactly one provider request — and the second delivery must not save, refund
 * or queue anything either.
 */
{
  fake.__reset({ verdict: { ok: true, app: APP } });
  const first = await runGeneratePhase(GENERATE as never);
  const second = await runGeneratePhase(GENERATE as never);
  check("the first delivery generates", first.outcome === "generated");
  check("the second is skipped", second.outcome === "skipped", JSON.stringify(second));
  check("the provider was asked exactly once", fake.__countOf("requestGeneration") === 1);
  check("the job records exactly one provider request", fake.__claimed("job-1") === 1);
  check("and exactly one version was saved", fake.__countOf("persistGeneratedApp") === 1);
  check("nothing was refunded", fake.__countOf("failGeneration") === 0);
}
{
  fake.__reset({ repairVerdict: { ok: true, app: APP } });
  await claimTo(1);
  const first = await runRepairPhase(repairMessage() as never);
  const second = await runRepairPhase(repairMessage() as never);
  check("a duplicate repair is refused too", second.outcome === "skipped", JSON.stringify(second));
  check("the repair provider call happened once", fake.__countOf("requestRepair") === 1);
  check("and the first one still succeeded", first.outcome === "generated");
  check("two requests total, never three", fake.__claimed("job-1") === 2);
}

/**
 * A repair message that arrives before its generation cannot claim.
 *
 * Ordering is not enforced by the queue — it falls out of the counter: until a
 * generation has claimed, the counter is 0 and a repair expects 1.
 */
{
  fake.__reset({ repairVerdict: { ok: true, app: APP } });
  const early = await runRepairPhase(repairMessage() as never);
  check("a repair cannot run before a generation", early.outcome === "skipped");
  check("and spends nothing", fake.__countOf("requestRepair") === 0);
}

/* ── 6. a message for a job that is already over ─────────────────────────── */

{
  fake.__reset({ begin: { proceed: false, reason: "the project already has an application" } });
  const result = await runGeneratePhase(GENERATE as never);
  check("a message for a finished project skips", result.outcome === "skipped");
  check("it spends nothing", fake.__countOf("requestGeneration") === 0);
  check("writes nothing", fake.__countOf("persistGeneratedApp") === 0);
  check("and refunds nothing — the stale sweep owns that", fake.__countOf("failGeneration") === 0);
  check("it does not even claim", fake.__claimed("job-1") === 0);
}
{
  fake.__reset({ begin: { proceed: false, reason: "the job is already failed" } });
  const result = await runGeneratePhase(GENERATE as never);
  check("a message for a swept job skips too", result.outcome === "skipped");
  check("spending nothing", fake.__countOf("requestGeneration") === 0);
}

check("the guard checks the job status", /job\.status !== "running" && job\.status !== "queued"/.test(stagesSource));
check("and refuses a project that already has an application",
  /if \(readAppState\(project\.snapshot_fields\)\)/.test(stagesSource));

/* ── 7. the stages that may repeat are idempotent ────────────────────────── */

// A project that already holds an application is left exactly as it is —
// re-saving would replace a version the person may already be looking at.
check("persist returns early when the app is already stored",
  /if \(readAppState\(project\.snapshot_fields\)\) \{\s*await finishSucceeded/.test(stagesSource));
check("the readiness message is upserted, not inserted",
  /\.upsert\(/.test(stagesSource) && !/project_ai_messages"\)\.insert\(/.test(stagesSource));
check("and its id is derived, so a repeat updates one row",
  /derivedMessageId\(conversationId\)/.test(stagesSource));
// The release itself is idempotent in the database; the stage just calls it.
check("failure ends the job and releases its unit",
  /finishFailed\(ref\.jobId/.test(stagesSource) && /releaseUsage\(ref\.jobId/.test(stagesSource));

/* ── 8. the run stays visibly alive ──────────────────────────────────────── */

/**
 * A generation can legitimately spend four minutes inside one `await`, and a
 * job with no heartbeat for five is swept and refunded. Without a beat *during*
 * the call, a slow-but-healthy run would have its own quota returned out from
 * under it and then succeed anyway.
 */
check("long stages beat while they work", /setInterval\(\s*\(\) => \{\s*void beat\(/.test(stagesSource));
check("the interval is always cleared", /finally \{\s*clearInterval\(timer\);/.test(stagesSource));
const HEARTBEAT = Number(/const HEARTBEAT_MS = ([\d_]+)/.exec(stagesSource)?.[1]?.replace(/_/g, "") ?? "0");
check("the beat is frequent enough to matter", HEARTBEAT > 0 && HEARTBEAT * 4 < 300_000, String(HEARTBEAT));

/* ── 9. no second job model, and no second orchestrator ──────────────────── */

check("the consumer advances the existing job row",
  /finishSucceeded\(/.test(stagesSource) && /finishFailed\(/.test(stagesSource));
check("it never claims a job of its own", !/claimJob/.test(stagesSource + runSource));
check("and never reserves quota of its own", !/reserveUsage/.test(stagesSource + runSource));

// One async mechanism, not two. The workflow SDK attempt is gone entirely.
{
  const { existsSync } = await import("node:fs");
  const root = new URL("../../", import.meta.url);
  check("the workflow orchestrator is gone", !existsSync(new URL("src/workflows", root)));
  check("its generated endpoints are gone", !existsSync(new URL("src/app/.well-known", root)));
  const pkg = JSON.parse(read("package.json")) as { dependencies?: Record<string, string> };
  check("the workflow SDK is not a dependency", !("workflow" in (pkg.dependencies ?? {})));
  check("the queue SDK is", "@vercel/queue" in (pkg.dependencies ?? {}));
  const vercelJson = JSON.parse(read("vercel.json")) as {
    functions?: Record<string, { experimentalTriggers?: Array<{ topic?: string }> }>;
  };
  const trigger = vercelJson.functions?.["src/app/api/queues/app-generation/route.ts"]?.experimentalTriggers?.[0];
  check("the consumer is wired to the topic it consumes", trigger?.topic === "ventrio-app-generation");
  check("and the producer sends to that same topic",
    new RegExp(`GENERATION_TOPIC = "${trigger?.topic}"`).test(queueSource));
}

/** Advances the modelled counter to a given value, for repair-only scenarios. */
async function claimTo(target: number): Promise<void> {
  for (let i = 0; i < target; i += 1) await fake.claimProviderRequest("job-1", i);
}

/* ── report ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`FAILED ${failures.length} of ${passed + failures.length}`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`queue generation: ${passed} checks passed`);
