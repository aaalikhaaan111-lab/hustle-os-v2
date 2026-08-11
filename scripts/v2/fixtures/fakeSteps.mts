/**
 * A stand-in for the durable steps, so the orchestration can be run for real.
 *
 * The workflow function is ordinary async JavaScript until the workflow
 * compiler transforms it; under tsx it simply calls whatever `./steps`
 * resolves to. Swapping this in (see `workflow-generation.test.mts`) lets the
 * actual control flow execute — the repair branch, the failure branches, the
 * order of the calls — without a database, a provider or a penny spent.
 *
 * Every call is recorded. The tests assert on the recording, because "how many
 * times did this run ask the provider for something" is exactly the property
 * that matters and exactly the one a source read cannot prove.
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
}

/**
 * The recording lives on `globalThis`, not in this module's scope.
 *
 * The loader hook substitutes this file for `./steps`, and the substituted
 * module is keyed separately from the one the test imports by path — so two
 * instances exist and a recording kept in module scope goes to whichever copy
 * the workflow happened to get. One shared object sidesteps the question
 * entirely.
 */
const KEY = Symbol.for("ventrio.fakeSteps");
const globals = globalThis as unknown as Record<symbol, { calls: Call[]; scenario: Scenario }>;
const state = (globals[KEY] ??= { calls: [], scenario: {} });

export function __reset(scenario: Scenario): void {
  state.calls = [];
  state.scenario = scenario;
}

export function __calls(): Call[] {
  return state.calls;
}

export function __countOf(step: string): number {
  return state.calls.filter((call) => call.step === step).length;
}

function record(step: string, args: unknown[]): void {
  state.calls.push({ step, args });
}

export async function beginGeneration(...args: unknown[]) {
  record("beginGeneration", args);
  return state.scenario.begin ?? { proceed: true };
}

export async function requestGeneration(...args: unknown[]) {
  record("requestGeneration", args);
  return state.scenario.generation ?? { ok: true, text: "<<<generated>>>", latencyMs: 1 };
}
requestGeneration.maxRetries = 0;

export async function evaluateGeneration(...args: unknown[]) {
  record("evaluateGeneration", args);
  return state.scenario.verdict ?? { ok: true, app: { metadata: { name: "App" } } };
}

export async function requestRepair(...args: unknown[]) {
  record("requestRepair", args);
  return state.scenario.repair ?? { ok: true, text: "<<<repaired>>>", latencyMs: 1 };
}
requestRepair.maxRetries = 0;

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
