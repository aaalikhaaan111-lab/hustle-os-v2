/**
 * `/create` must read a queued generation as a success.
 *
 *   npx tsx --conditions=react-server scripts/create-async-start.test.mts
 *
 * WHY. `generateFirstVersionAction` used to generate inside the request and
 * return a finished version, so `!generation.output` meant failure. Execution
 * then moved to the external worker: the action now claims a job, reserves the
 * unit and returns `{ error: null, output: null, jobId }` — a success — with two
 * more minutes of work happening elsewhere. `/create` was never updated.
 *
 * The result on production, 2026-08-12: both projects created that evening
 * showed "Не удалось создать проект. Пожалуйста, попробуйте снова." while their
 * generation was running, and both finished successfully ~2.5 minutes later,
 * charged exactly once, with the application persisted. Nothing failed except
 * the reading of the reply.
 *
 * These cases are the contract between the action and the screen. They run the
 * real classifier; the navigation it drives is asserted from the component
 * source, since there is no DOM in this repo's test environment.
 *
 * Offline. No network, no database, no provider.
 */

import { readFileSync } from "node:fs";
import { classifyFirstVersionStart, startedFromJobView } from "../src/lib/build/firstVersionStart";
import type { FirstVersionJobView } from "../src/lib/jobs/firstVersion";
import type { GenerationJob } from "../src/lib/jobs/generationJobs";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

/* ── 1. the async contract: a job id is a success ────────────────────────── */

{
  const queued = classifyFirstVersionStart({
    error: null,
    output: null,
    jobId: "6b39a0ce-3350-4470-b953-a6607a13145f",
  });
  check("a queued job is a start", queued.outcome === "started", JSON.stringify(queued));
  check("and is recognised as the job path", queued.outcome === "started" && queued.via === "job");
  // The whole point: this shape must never reach the failure branch, which is
  // the only place `create.errorSaveFailed` is shown.
  check("a queued job is never a failure", queued.outcome !== "failed");
}

/* ── 2. the legacy synchronous contract still works ──────────────────────── */

{
  const inline = classifyFirstVersionStart({
    error: null,
    output: { sections: [] },
    jobId: null,
  });
  check("an immediate output is a start", inline.outcome === "started");
  check("and is recognised as the output path", inline.outcome === "started" && inline.via === "output");
}

/* ── 3. a real error is still a real failure ─────────────────────────────── */

{
  const failed = classifyFirstVersionStart({ error: "Generation is unavailable.", output: null });
  check("an error is a failure", failed.outcome === "failed");
  check("and carries the server's own message", failed.outcome === "failed" && failed.error === "Generation is unavailable.");

  // An error wins even when a job was claimed before the failure.
  const both = classifyFirstVersionStart({ error: "Retries exhausted.", output: null, jobId: "abc" });
  check("an error beats a job id", both.outcome === "failed", JSON.stringify(both));
}

/* ── 4. a limit is neither a start nor a retryable failure ───────────────── */

{
  const limited = classifyFirstVersionStart({
    error: null, output: null,
    limitReached: { metric: "first_version_generation", used: 3, limit: 3 },
  });
  check("a reached limit is its own outcome", limited.outcome === "limit-reached");
  check("and carries the limit", limited.outcome === "limit-reached" && limited.limit.limit === 3);

  // Checked before `error`, so a limit never shows a generic failure message.
  const limitedWithError = classifyFirstVersionStart({
    error: "something", output: null,
    limitReached: { metric: "first_version_generation", used: 3, limit: 3 },
  });
  check("a limit is read before an error", limitedWithError.outcome === "limit-reached");
}

/* ── 5. the undecidable reply, and the duplicate states it caused ────────── */

{
  const bare = classifyFirstVersionStart({ error: null, output: null, jobId: null });
  check("no error, no output and no job id defers to the job state", bare.outcome === "check-job");
  check("an empty job id is not a job id", classifyFirstVersionStart({ error: null, output: null, jobId: "" }).outcome === "check-job");
}

const job = (status: GenerationJob["status"]): FirstVersionJobView => ({
  job: { status } as GenerationJob,
  hasOutput: false,
  attemptsRemaining: 3,
});

/**
 * This is the "Retry on a project that is already building or already built"
 * case. The action answers with nothing to report because there is nothing to
 * do, and treating that as a failure is what produced a Retry button that could
 * only ever fail the same way.
 */
check("a succeeded job means it is already built", startedFromJobView(job("succeeded")));
check("a running job means it is already building", startedFromJobView(job("running")));
check("a queued job means it is already building", startedFromJobView(job("queued")));
check("a legacy output means it is already built", startedFromJobView({ job: null, hasOutput: true, attemptsRemaining: 3 }));
check("a failed job is not a start", !startedFromJobView(job("failed")));
check("and neither is no job at all", !startedFromJobView({ job: null, hasOutput: false, attemptsRemaining: 3 }));

/* ── 6. no second provider request ───────────────────────────────────────── */

/**
 * A succeeded job resolves to "started", so the screen navigates instead of
 * calling `generateFirstVersionAction` again. That call is the only thing on
 * this path that can claim a job, reserve a unit or reach the provider, so not
 * making it is what keeps the count at one.
 */
{
  const alreadyBuilt = startedFromJobView(job("succeeded"));
  check("an already-built project starts rather than regenerates", alreadyBuilt);
  check(
    "and a failed one is allowed to try again",
    !startedFromJobView(job("failed")),
  );
}

/* ── 7. the component wiring ─────────────────────────────────────────────── */

const source = readFileSync(new URL("../src/components/create/CreateExperience.tsx", import.meta.url), "utf8");

check(
  "the old synchronous test is gone",
  !/generation\.error \|\| !generation\.output/.test(source),
  "the `!generation.output` failure test is back",
);
check("the screen classifies the reply", /classifyFirstVersionStart\(generation\)/.test(source));
check("and asks the job state when the reply cannot settle it", /check-job[\s\S]{0,400}getFirstVersionJobAction/.test(source));
check("and uses the job view to decide", /startedFromJobView\(view\)/.test(source));

// errorSaveFailed must be reachable only from the failed branch.
const failedBranch = source.slice(source.indexOf('start.outcome === "failed"'));
check(
  "the generic failure message lives in the failed branch",
  /start\.error \?\? t\("errorSaveFailed"\)/.test(failedBranch.slice(0, 400)),
);

// Started must hand off rather than linger on /create.
const startedPath = source.slice(source.indexOf("// Started."));
check(
  "a started generation navigates to the project",
  /router\.push\(`\/projects\/\$\{result\.projectId\}`\)/.test(startedPath.slice(0, 600)),
);
check(
  "and marks the handoff phase",
  /setCreationPhase\("handoff"\)/.test(startedPath.slice(0, 600)),
);

// The workspace it hands off to is the thing that polls.
const preOutput = readFileSync(new URL("../src/components/build/PreOutputWorkspace.tsx", import.meta.url), "utf8");
check("the workspace polls the job", /useFirstVersionJob\(/.test(preOutput));

if (failures.length > 0) {
  console.error(`create-async-start: ${failures.length} failed, ${passed} passed`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`create-async-start: ${passed} checks passed`);
