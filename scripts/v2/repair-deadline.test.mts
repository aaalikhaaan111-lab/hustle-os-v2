/**
 * The repair stage, when the provider never comes back.
 *
 *   npx tsx --conditions=react-server scripts/v2/repair-deadline.test.mts
 *
 * THE PRODUCTION FAILURE THIS REPRODUCES. On 2026-08-11 a repair invocation
 * started, won its provider-request claim, beat once — and was then never heard
 * from again. No heartbeat, no completion, no failure record, until Vercel
 * killed it near the 300 s function ceiling. Its provider budget was 180 s, so
 * the request's own `AbortSignal` should have handed control back at 180 s and
 * did not.
 *
 * WHY AN ABORT IS NOT A DEADLINE. `AbortSignal` is a request to whatever is
 * doing the work, not a guarantee that the `await` settles. A socket that never
 * answers, a body read that stalls, or a fetch layer that ignores the signal
 * all leave the promise pending, and the consumer has no way to notice. The
 * three transports below are exactly those three shapes.
 *
 * The stages are the real ones. Only the provider, the job row and the Supabase
 * client are substituted, and the deadline is shortened so the proof takes
 * milliseconds instead of the three and a half minutes production spent.
 *
 * Offline. No provider, no database, no queue, no cost.
 */

import { readFileSync } from "node:fs";
import * as nodeModule from "node:module";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

/* ── substitute the infrastructure, keep the stages ──────────────────────── */

const INFRA = new URL("./fixtures/fakeInfra.mts", import.meta.url).href;
type Resolved = { url: string; shortCircuit?: boolean };
type ResolveHook = (
  specifier: string,
  context: { parentURL?: string },
  nextResolve: (s: string, c: unknown) => Resolved,
) => Resolved;
const registerHooks = (nodeModule as unknown as {
  registerHooks: (hooks: { resolve: ResolveHook }) => void;
}).registerHooks;

const FAKED = /(lib\/jobs\/generationJobs|lib\/supabase\/public|lib\/v2\/app\/provider)(\.ts)?$/;
registerHooks({
  resolve(specifier, context, nextResolve) {
    const resolved = nextResolve(specifier, context);
    // Never redirect the fixture's own imports, or it would import itself.
    if (context?.parentURL === INFRA) return resolved;
    if (FAKED.test(resolved.url.replace(/\?.*$/, ""))) {
      return { ...resolved, url: INFRA, shortCircuit: true };
    }
    return resolved;
  },
});

const infra = (await import(INFRA)) as typeof import("./fixtures/fakeInfra.mts");
const { runRepairPhase } = await import("../../src/lib/v2/app/runGeneration");
const stages = await import("../../src/lib/v2/app/stages");

const MESSAGE = {
  phase: "repair" as const,
  jobId: "job-1",
  projectId: "project-1",
  userId: "user-1",
  brief: "a small app",
  locale: "en",
  model: "gemini-3.6-flash",
  issues: ["src/App.tsx: require — require() is not available"],
  plan: { mode: "rewrite" as const, reason: "no validated project to patch against" },
};

/** Short enough to run in a test, long enough that a prompt build finishes. */
const DEADLINE = 150;

/* ── 1. the hang, reproduced, one shape at a time ────────────────────────── */

for (const hang of ["never-resolves", "ignores-abort", "stalls-after-start"] as const) {
  infra.__reset({ hang });
  const startedAt = Date.now();
  const result = await runRepairPhase(MESSAGE as never, { deadlineMs: DEADLINE });
  const elapsed = Date.now() - startedAt;
  const state = infra.__state();

  check(`[${hang}] the consumer regains control`, result.outcome === "failed", JSON.stringify(result));
  // The whole point: bounded by the consumer's clock, not by the platform's.
  check(`[${hang}] within its own deadline`, elapsed < DEADLINE * 6, `${elapsed}ms`);
  check(`[${hang}] and reports a timeout`, result.outcome === "failed" && result.code === "timeout", JSON.stringify(result));
  check(`[${hang}] the provider was asked exactly once`, state.transport!.requestCount === 1);
  check(`[${hang}] the job is failed`, state.job.status === "failed");
  check(`[${hang}] quota is released`, state.job.released);
  check(`[${hang}] and no version was saved`, state.saves === 0);
  check(`[${hang}] the request cap is untouched`, state.job.providerRequests === 2);
}

/* ── 2. a late completion cannot undo the failure ────────────────────────── */

/**
 * The unavoidable part. `Promise.race` abandons the loser; it cannot cancel it.
 * So the provider promise may still settle long after the job has failed, and
 * the only real defence is that everything downstream re-reads the job.
 */
{
  infra.__reset({ hang: "never-resolves" });
  const result = await runRepairPhase(MESSAGE as never, { deadlineMs: DEADLINE });
  check("the repair timed out", result.outcome === "failed");
  const state = infra.__state();
  check("and the job is failed", state.job.status === "failed");

  // The abandoned request now answers, with a perfectly good project.
  state.transport!.finishLate("<<<VENTRIO:PROJECT>>>{}");
  await new Promise((r) => setTimeout(r, 60));

  check("a late answer does not resurrect the job", state.job.status === "failed");
  check("it saves nothing", state.saves === 0);
  check("and does not refund twice", state.job.released === true);
}

/**
 * The same guard, exercised directly: a result that arrives for a job which is
 * already finished must be refused by the persist stage itself, not merely
 * never reached.
 */
{
  infra.__reset({});
  const state = infra.__state();
  state.job.status = "failed";
  const saved = await stages.persistGeneratedApp(
    { jobId: "job-1", projectId: "project-1", userId: "user-1" },
    { app: { metadata: { name: "Late" } } as never, model: "gemini-3.6-flash", locale: "en" },
  );
  check("persisting into a failed job is refused", !saved.ok, JSON.stringify(saved));
  check("with a reason that names the state", (saved.message ?? "").includes("already failed"));
  check("and writes nothing", state.saves === 0);
  check("nor marks it succeeded", state.job.status === "failed");
}

/* ── 3. repeated handling stays idempotent ───────────────────────────────── */

{
  infra.__reset({ hang: "never-resolves" });
  await runRepairPhase(MESSAGE as never, { deadlineMs: DEADLINE });
  const state = infra.__state();
  check("the first timeout refunds", state.job.released);

  // A duplicate delivery of the same repair message, after the timeout.
  const second = await runRepairPhase(MESSAGE as never, { deadlineMs: DEADLINE });
  check("a duplicate after a timeout is skipped", second.outcome === "skipped", JSON.stringify(second));
  check("it does not ask the provider again", state.transport!.requestCount === 1);
  check("there is no third provider request", state.job.providerRequests === 2);
  check("and no second refund", state.job.released === true);
}

/* ── 4. a healthy repair is unaffected ───────────────────────────────────── */

{
  infra.__reset({ hang: "never-resolves" });
  const state = infra.__state();
  // Answer before the deadline: the ordinary case.
  setTimeout(() => state.transport!.finishLate("not a framed project"), 20);
  const result = await runRepairPhase(MESSAGE as never, { deadlineMs: DEADLINE });
  check("a provider that answers in time is not timed out",
    result.outcome === "failed" && result.code !== "timeout", JSON.stringify(result));
  check("the response reached the gate, which refused it",
    result.outcome === "failed" && result.code === "unparseable", JSON.stringify(result));
  check("still exactly one provider request", state.transport!.requestCount === 1);
}

/* ── 5. the heartbeat keeps running during a slow call ───────────────────── */

/**
 * Why this matters. In production the heartbeat stopped at the same moment the
 * hang began, which is what let the stale sweep close the job. A beat only at
 * the boundaries is not enough: the whole point is to distinguish "slow" from
 * "dead" while the call is in flight.
 */
{
  infra.__reset({ hang: "never-resolves" });
  const state = infra.__state();
  const beforeBeats = state.beats.length;
  // A call slower than several heartbeat intervals, then a timeout.
  // A call many heartbeat intervals long. The interval is injected so the proof
  // takes a quarter of a second rather than the two and a half minutes three
  // real 30 s beats would need.
  await stages.withHeartbeat(
    "job-1",
    "generating",
    () => new Promise<void>((resolve) => setTimeout(resolve, 260)),
    40,
  );
  const during = state.beats.length - beforeBeats;
  check("the heartbeat beats at the start", during >= 1, `${during} beats`);
  check("and keeps beating while the call is in flight", during >= 4, `${during} beats`);
  // Spread across the call rather than bunched at either end.
  const spread = state.beats[state.beats.length - 1].at - state.beats[beforeBeats].at;
  check("across the whole call, not just its edges", spread > 150, `${spread}ms`);

  // And it stops when the call does — a beat after the stage returns would keep
  // a dead job looking alive.
  const settled = state.beats.length;
  await new Promise((r) => setTimeout(r, 120));
  check("and stops cleanly when the stage returns", state.beats.length === settled,
    `${state.beats.length - settled} extra`);
}

/* ── 6. the budgets leave the platform real margin ───────────────────────── */

const stagesSource = read("src/lib/v2/app/stages.ts");
const config = await import("../../src/lib/v2/gemini/config");

check("the repair provider budget is unchanged at 180s", config.CONSUMER_BUDGETS.repair === 180_000);
check("the generation provider budget is unchanged at 240s", config.CONSUMER_BUDGETS.generate === 240_000);

// The consumer's ceiling has to be under the platform's, with room to fail
// cleanly — that margin is the difference between a job that reports a timeout
// and one the platform kills mid-write.
const CEILING = config.FUNCTION_CEILING_MS;
for (const [stage, ms] of Object.entries(stages.HARD_DEADLINES)) {
  check(`the ${stage} deadline is under the function ceiling`, ms < CEILING, `${ms} vs ${CEILING}`);
  check(`with at least 30s of cleanup margin`, CEILING - ms >= 30_000, `${CEILING - ms}ms`);
}
check("the repair deadline is within the 220-240s target",
  stages.HARD_DEADLINES.repair >= 180_000 && stages.HARD_DEADLINES.repair <= 240_000,
  String(stages.HARD_DEADLINES.repair));
// The deadline must outlast the request it is supervising, or every healthy
// call would be cut off by its own supervisor.
check("each deadline outlasts its provider budget",
  stages.HARD_DEADLINES.repair > config.CONSUMER_BUDGETS.repair
    && stages.HARD_DEADLINES.generate > config.CONSUMER_BUDGETS.generate);

check("both provider stages are supervised", (stagesSource.match(/withDeadline\(hard,/g) ?? []).length === 2);
check("the persist stage re-reads the job before writing",
  /this result arrived too late/.test(stagesSource));

/* ── report ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`FAILED ${failures.length} of ${passed + failures.length}`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`repair deadline: ${passed} checks passed`);
