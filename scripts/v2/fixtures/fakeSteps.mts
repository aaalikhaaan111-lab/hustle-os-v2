/**
 * Stand-ins for everything the queue consumer's orchestration touches, so the
 * orchestration itself can be run for real.
 *
 * One module serves three: `./stages`, `./generationQueue` and the job module's
 * `claimProviderRequest`. The loader hook in `queue-generation.test.mts` points
 * all three specifiers here, and ESM only cares that the named exports exist.
 *
 * `claimProviderRequest` is modelled rather than stubbed, because it is the
 * guard the money rests on: it keeps a real counter per job and succeeds only
 * when that counter equals the value the phase expects, exactly as the
 * compare-and-swap in the migration does. That is what lets a test deliver the
 * same message twice and prove the second delivery spends nothing.
 *
 * Every call is recorded. The tests assert on the recording, because "how many
 * times did this ask the provider for something" is exactly the property that
 * matters and exactly the one a source read cannot prove.
 */

export interface Call {
  step: string;
  args: unknown[];
}

export interface Scenario {
  begin?: { proceed: boolean; reason?: string };
  generation?: unknown;
  verdict?: unknown;
  repair?: unknown;
  repairVerdict?: unknown;
  persist?: { ok: boolean; message?: string };
  enqueue?: { ok: boolean; message?: string };
}

interface State {
  calls: Call[];
  scenario: Scenario;
  /** jobId → provider requests already claimed, as the job row would hold. */
  claimed: Map<string, number>;
}

/**
 * The recording lives on `globalThis`, not in this module's scope.
 *
 * The loader hook substitutes this file for several specifiers, and each
 * substituted module is keyed separately from the one the test imports by path
 * — so more than one instance exists and a recording kept in module scope goes
 * to whichever copy happened to be used. One shared object sidesteps it.
 */
const KEY = Symbol.for("ventrio.fakeSteps");
const globals = globalThis as unknown as Record<symbol, State>;
const state = (globals[KEY] ??= { calls: [], scenario: {}, claimed: new Map() });

export function __reset(scenario: Scenario): void {
  state.calls = [];
  state.scenario = scenario;
  state.claimed = new Map();
}

export function __calls(): Call[] {
  return state.calls;
}

export function __countOf(step: string): number {
  return state.calls.filter((call) => call.step === step).length;
}

/** The provider requests a job has spent, as the database would report them. */
export function __claimed(jobId: string): number {
  return state.claimed.get(jobId) ?? 0;
}

function record(step: string, args: unknown[]): void {
  state.calls.push({ step, args });
}

/* ── the guard ───────────────────────────────────────────────────────────── */

export async function claimProviderRequest(jobId: string, expected: number): Promise<boolean> {
  record("claimProviderRequest", [jobId, expected]);
  const current = state.claimed.get(jobId) ?? 0;
  if (current !== expected) return false;
  state.claimed.set(jobId, expected + 1);
  return true;
}

/* ── the stages ──────────────────────────────────────────────────────────── */

export async function beginGeneration(...args: unknown[]) {
  record("beginGeneration", args);
  return state.scenario.begin ?? { proceed: true };
}

export async function requestGeneration(...args: unknown[]) {
  record("requestGeneration", args);
  return state.scenario.generation ?? { ok: true, text: "<<<generated>>>", latencyMs: 1 };
}

export async function evaluateGeneration(...args: unknown[]) {
  record("evaluateGeneration", args);
  return state.scenario.verdict ?? { ok: true, app: { metadata: { name: "App" } } };
}

export async function requestRepair(...args: unknown[]) {
  record("requestRepair", args);
  return state.scenario.repair ?? { ok: true, text: "<<<repaired>>>", latencyMs: 1 };
}

export async function evaluateRepair(...args: unknown[]) {
  record("evaluateRepair", args);
  return state.scenario.repairVerdict ?? { ok: true, app: { metadata: { name: "App" } } };
}

export async function persistGeneratedApp(...args: unknown[]) {
  record("persistGeneratedApp", args);
  return state.scenario.persist ?? { ok: true };
}

export async function failGeneration(...args: unknown[]) {
  record("failGeneration", args);
}

export async function withHeartbeat<T>(_jobId: string, _stage: string, run: () => Promise<T>): Promise<T> {
  return run();
}

/* ── the queue ───────────────────────────────────────────────────────────── */

export const GENERATION_TOPIC = "ventrio-app-generation";

export async function enqueueGeneration(...args: unknown[]) {
  record("enqueueGeneration", args);
  return state.scenario.enqueue ?? { ok: true, messageId: "m-1" };
}

export async function enqueueRepair(...args: unknown[]) {
  record("enqueueRepair", args);
  return state.scenario.enqueue ?? { ok: true, messageId: "m-2" };
}
