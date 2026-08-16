/**
 * First-version generation, as the queue runs it.
 *
 *   npx tsx --conditions=react-server scripts/v2/worker-generation.test.mts
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
const workerSource = read("worker/main.ts");

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

/* ── 2. the executor runs a job once, and only once ──────────────────────── */

// The worker is a long-running process, not a function with a ceiling. That is
// the entire reason it exists: three attempts to run a multi-minute provider
// call inside a Vercel function failed, twice by the invocation simply ceasing
// to execute.
check("the worker loops rather than being invoked", /while \(running\)/.test(workerSource));
check("it takes one job per tick", /\/\/ One job per tick/.test(workerSource));
check("it sleeps when idle instead of spinning", /await sleep\(IDLE_MS\)/.test(workerSource));
check("and backs off after an unexpected error", /await sleep\(BACKOFF_MS\)/.test(workerSource));

// Selecting is not owning. Two workers may read the same row; exactly one wins
// the compare-and-swap inside `runGeneratePhase`.
check("it selects candidates without claiming them", /claimableJobs\(/.test(workerSource));
check("and the claim is the existing compare-and-swap",
  (runSource.match(/claimProviderRequest\(/g) ?? []).length === 2);
check("generation claims from zero, repair from one",
  /GENERATE_EXPECTS = 0/.test(runSource) && /REPAIR_EXPECTS = 1/.test(runSource));
check("the claim comes before the provider call",
  runSource.indexOf("claimProviderRequest(ref.jobId, GENERATE_EXPECTS)") < runSource.indexOf("await requestGeneration("));
check("and the guard fails closed", /return false;\n  \}\n  return data === true;/.test(read("src/lib/jobs/generationJobs.ts")));

// Only rows that can actually be run are offered, so a claimed-then-crashed job
// is never picked up a second time and paid for twice.
const jobsSource = read("src/lib/jobs/generationJobs.ts");
check("only unclaimed jobs are offered", /\.eq\("provider_requests", 0\)/.test(jobsSource));
check("and only jobs that carry their input", /\.not\("payload", "is", null\)/.test(jobsSource));

// A throw leaves the row alone on purpose: the stale sweep owns recovery, and
// guessing a status from the loop would be a second accounting path.
check("a throwing job is left to the stale sweep", /job_threw/.test(workerSource));
check("and the worker sweeps abandoned jobs itself", /expireStaleForUser\(userId\)/.test(workerSource));
check("draining lets the job in flight finish", /running = false;/.test(workerSource));

/**
 * THE SWEEP'S CANDIDATE QUERY MUST NOT BE NARROWER THAN THE FUNCTION IT FEEDS.
 *
 * `heartbeat_at` is nullable, and in SQL `null < cutoff` is null, not true — so
 * a bare `.lt("heartbeat_at", …)` cannot see a row that has no heartbeat. Every
 * other answer to "is this job stale" falls through the timestamps that are
 * never null: the database function uses
 * `coalesce(heartbeat_at, started_at, created_at)` and `isStale` mirrors it.
 * The worker's query was the only one that did not, so it could pass over
 * exactly the jobs `expire_stale_generation_jobs_for_user` would have ended.
 *
 * Not reachable today — `claimJob` is the only insert and always writes a
 * heartbeat — which is why this is asserted rather than left to be noticed. The
 * sweep exists to catch states nobody predicted; one that only looks where the
 * predicted states are is not doing that.
 */
check("the sweep does not filter on heartbeat alone",
  !/\.lt\("heartbeat_at", cutoff\)/.test(workerSource),
  "a null heartbeat is invisible to that filter, and null is exactly the abandoned case");
check("it falls back to started_at when there is no heartbeat",
  /heartbeat_at\.is\.null,started_at\.lt\./.test(workerSource));
check("and to created_at when there is neither",
  /heartbeat_at\.is\.null,started_at\.is\.null,created_at\.lt\./.test(workerSource));
check("which is the same fallback chain the database function applies",
  /coalesce\(heartbeat_at, started_at, created_at\)/.test(
    read("supabase/migrations/20260803120000_add_user_wide_stale_recovery.sql"),
  ),
  "if the function's rule changes, the query feeding it has to change with it");

// Secrets are checked by name and never printed.
check("the worker refuses to start without its configuration", /startup_failed/.test(workerSource));
check("and logs only the names of what is missing", /log\("startup_failed", \{ missing \}\)/.test(workerSource));
/**
 * Asserted against the log calls themselves, not the file.
 *
 * The worker legitimately reads `job.payload.brief` to build the message it
 * runs; what must never happen is that brief reaching a log line. So this looks
 * at what is inside `log(...)` and nothing else.
 */
{
  const logCalls = workerSource.match(/\blog\((?:[^()]|\([^()]*\))*\)/g) ?? [];
  check("the worker logs something", logCalls.length >= 5, String(logCalls.length));
  const logged = logCalls.join("\n");
  check("no brief reaches the log", !/payload\.brief(?!\.length)/.test(logged), logged.slice(0, 160));
  check("its size does, which is the useful part", /briefChars/.test(logged));
  // Nothing that could carry a key or a project.
  for (const forbidden of ["apiKey", "GEMINI_API_KEY", "SUPABASE_SERVICE_ROLE_KEY", "process.env"]) {
    check(`no ${forbidden} in any log line`, !logged.includes(forbidden), forbidden);
  }
}

/* ── 3. the action hands off instead of generating ───────────────────────── */

const appBranch = actionSource.slice(
  actionSource.indexOf("if (appRuntimeEnabled()) {"),
  actionSource.indexOf("await beat(job.id, \"generating\");\n    const client = new Anthropic();"),
);
check("the app-runtime branch was found", appBranch.length > 200);
check("it records the work for the worker", /savePayload\(/.test(appBranch));
// The whole point: the pipeline no longer runs inside the request.
check("and does not render inline any more", !/renderProjectWithAppRuntime/.test(actionSource));
check("a payload that cannot be written refunds rather than leaving a running row",
  /if \(!recorded\)/.test(appBranch) && /releaseAndFail/.test(appBranch));

// Ordering: the claim and the reservation still happen before the handoff, so
// a run only ever exists for a job that was genuinely claimed and paid for.
const claimAt = actionSource.indexOf("const job = await claimJob(");
const reserveAt = actionSource.indexOf("const reservation = await reserveUsage(");
const startAt = actionSource.indexOf("const recorded = await savePayload(");
check("the job is claimed before quota is reserved", claimAt > 0 && claimAt < reserveAt);
check("and quota is reserved before the work is recorded", reserveAt > 0 && reserveAt < startAt);
check("the account-wide stale sweep still runs first",
  actionSource.indexOf("await expireStaleForUser(user.id)") < claimAt);
check("and the finality guard still comes before all of it",
  actionSource.indexOf("if (readAppState(project.snapshot_fields))") < claimAt);
check("the work is recorded once, from one place",
  (actionSource.match(/savePayload\(/g) ?? []).length === 1);

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
/**
 * Bounded rather than one-shot. A single refresh was terminal when it landed in
 * the gap between the worker writing the application and finishing the job row:
 * it came back with nothing and nothing ever tried again, which is how a
 * finished generation left an empty workspace on a phone. The original concern
 * — that an unguarded effect loops on the failure path — is still enforced,
 * just by a counter instead of a latch.
 */
check("the refresh retries, so the worker's write gap is survivable",
  /MAX_ARRIVAL_REFRESHES/.test(workspaceSource) && /ARRIVAL_RETRY_MS/.test(workspaceSource));
check("and is bounded, so a failure cannot loop",
  /refreshAttempts\.current >= MAX_ARRIVAL_REFRESHES/.test(workspaceSource));
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

/**
 * The repair branch is off in production, so the scenarios that exercise it
 * turn it on explicitly. Everything asserted about the shipping configuration
 * runs with the flag as it actually ships — see section 10.
 */
const withRepair = <T,>(run: () => Promise<T>): Promise<T> => {
  const saved = process.env.VENTRIO_APP_REPAIR;
  process.env.VENTRIO_APP_REPAIR = "1";
  return run().finally(() => {
    if (saved === undefined) delete process.env.VENTRIO_APP_REPAIR;
    else process.env.VENTRIO_APP_REPAIR = saved;
  });
};
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
  check("what the request cost is written down", fake.__countOf("recordTokenUsage") === 1);
}

/**
 * The cost of a refused run is recorded too.
 *
 * This is the case the telemetry exists for. A response that fails the gate was
 * generated and billed exactly like one that passes, and those runs are roughly
 * a third of current model spend — so the write has to happen before the
 * verdict, not after a success.
 */
{
  fake.__reset({ verdict: { ok: false, code: "refused", message: "refused", issues: [] } });
  await runGeneratePhase(GENERATE as never);
  check("a refused generation still records its cost", fake.__countOf("recordTokenUsage") === 1);
  const order = fake.__calls().map((call) => call.step);
  check(
    "and records it before the gate runs",
    order.indexOf("recordTokenUsage") < order.indexOf("evaluateGeneration"),
    order.join(" -> "),
  );
}

/* a repairable failure queues exactly one repair, and does not run it here */
{
  fake.__reset({ verdict: REPAIRABLE });
  const result = await withRepair(() => runGeneratePhase(GENERATE as never));
  check("a repairable failure queues a repair", result.outcome === "queued-repair", JSON.stringify(result));
  check("the repair is queued once", fake.__countOf("enqueueRepair") === 1);
  // The whole point of the second message: the repair gets its own function,
  // rather than whatever time this invocation has left.
  check("and is not run inside this invocation", fake.__countOf("requestRepair") === 0);
  check("nothing is saved yet", fake.__countOf("persistGeneratedApp") === 0);
  check("and nothing is refunded yet", fake.__countOf("failGeneration") === 0);
  // Three production generations failed the gate and left no trace of which
  // rule they broke, which made "same mistake three times, or three different
  // ones?" unanswerable. The objections now travel out of the run.
  check("the gate's objections are reported, not dropped",
    result.outcome === "queued-repair" && (result.issues ?? []).length > 0, JSON.stringify(result));
  check("along with the stage that raised them",
    result.outcome === "queued-repair" && result.stage === "refused");
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
  const result = await withRepair(() => runGeneratePhase(GENERATE as never));
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

/* ── 8b. a failure says what was wrong with it ───────────────────────────── */

{
  fake.__reset({ verdict: { ok: false, code: "refused", message: "refused", issues: ["a", "b"], plan: null } });
  const result = await runGeneratePhase(GENERATE as never);
  check("a terminal failure carries its issues too",
    result.outcome === "failed" && (result.issues ?? []).length === 2, JSON.stringify(result));
}
// Three production generations were refused and none recorded which rule they
// broke, so none could be diagnosed without spending another provider request.
check("and the worker writes them to the log",
  /issueCount: result\.issues\?\.length/.test(workerSource) && /issues: result\.issues\.slice\(0, 4\)/.test(workerSource));
check("bounded, so a project cannot be spilled into it",
  /issue\.slice\(0, 160\)/.test(workerSource));

/* ── 8c. the shipping configuration makes exactly one request ────────────── */

/**
 * V1 is one shot. The repair stage exists and is tested, but it runs in a second
 * invocation that has twice stopped executing until the platform killed it, so
 * production does not depend on it. A refused first pass ends the attempt.
 */
{
  delete process.env.VENTRIO_APP_REPAIR;
  fake.__reset({ verdict: REPAIRABLE });
  const result = await runGeneratePhase(GENERATE as never);
  check("a refused first pass fails instead of queueing a repair",
    result.outcome === "failed", JSON.stringify(result));
  check("nothing is queued", fake.__countOf("enqueueRepair") === 0);
  check("the provider was asked exactly once", fake.__countOf("requestGeneration") === 1);
  check("the job records exactly one provider request", fake.__claimed("job-1") === 1);
  check("quota is released exactly once", fake.__countOf("failGeneration") === 1);
  check("nothing is persisted", fake.__countOf("persistGeneratedApp") === 0);
  // The objections still travel out, for the log — they are simply not acted on.
  check("and the gate's objections are still reported",
    result.outcome === "failed" && (result.issues ?? []).length > 0);
}

/* a duplicate delivery of that same message still spends nothing */
{
  delete process.env.VENTRIO_APP_REPAIR;
  fake.__reset({ verdict: REPAIRABLE });
  await runGeneratePhase(GENERATE as never);
  const second = await runGeneratePhase(GENERATE as never);
  check("a duplicate after a one-shot failure is skipped", second.outcome === "skipped", JSON.stringify(second));
  check("with no second provider request", fake.__countOf("requestGeneration") === 1);
  check("and no second refund", fake.__countOf("failGeneration") === 1);
}

/* a clean first pass is unaffected by any of this */
{
  delete process.env.VENTRIO_APP_REPAIR;
  fake.__reset({ verdict: { ok: true, app: APP } });
  const result = await runGeneratePhase(GENERATE as never);
  check("a first pass that validates still succeeds", result.outcome === "generated");
  check("in one provider request", fake.__claimed("job-1") === 1);
  check("persisted once", fake.__countOf("persistGeneratedApp") === 1);
  check("and refunding nothing", fake.__countOf("failGeneration") === 0);
}

/* ── 9. no second job model, and no second orchestrator ──────────────────── */

check("the consumer advances the existing job row",
  /finishSucceeded\(/.test(stagesSource) && /finishFailed\(/.test(stagesSource));
check("it never claims a job of its own", !/claimJob/.test(stagesSource + runSource));
check("and never reserves quota of its own", !/reserveUsage/.test(stagesSource + runSource));

/**
 * One executor, not three.
 *
 * Two previous attempts at running generation on Vercel are gone entirely — the
 * durable-workflow SDK, whose own endpoints never resolved, and the queue
 * consumer, whose invocation twice stopped executing. Leaving either in place
 * would mean two things able to claim the same job.
 */
{
  const { existsSync } = await import("node:fs");
  const root = new URL("../../", import.meta.url);
  check("the workflow orchestrator is gone", !existsSync(new URL("src/workflows", root)));
  check("its generated endpoints are gone", !existsSync(new URL("src/app/.well-known", root)));
  check("the queue consumer route is gone", !existsSync(new URL("src/app/api/queues", root)));
  check("and its trigger configuration with it", !existsSync(new URL("vercel.json", root)));

  const pkg = JSON.parse(read("package.json")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
  };
  check("the workflow SDK is not a dependency", !("workflow" in (pkg.dependencies ?? {})));
  check("nor is the queue SDK", !("@vercel/queue" in (pkg.dependencies ?? {})));
  // The worker is a real process, so its runner is a real dependency rather
  // than something `npx` happens to fetch.
  check("the worker has a start script", (pkg.scripts ?? {}).worker === "tsx --conditions=react-server worker/main.ts");
  check("and its runner is declared", "tsx" in (pkg.devDependencies ?? {}));

  // Nothing in the web app may execute a provider call any more.
  check("no route sends to a queue", !/@vercel\/queue/.test(read("src/lib/v2/app/generationQueue.ts")));
  check("and the action only records the work",
    !/enqueueGeneration/.test(actionSource) && /savePayload\(/.test(actionSource));
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
console.log(`worker generation: ${passed} checks passed`);
