import "server-only";

/**
 * App generation: one request, and at most one repair.
 *
 * The ceiling of two provider requests is enforced here and again by
 * `BudgetedTransport`, because a budget kept in one place is a budget kept by
 * accident. Everything else in this file is about the second request being
 * worth paying for.
 *
 * WHICH FAILURES BUY A REPAIR. Only the ones a second attempt can act on: a
 * response that was not JSON, a project the validator refused, a project the
 * compiler refused. Never a transport failure — a timeout or a 5xx says nothing
 * about the project and retrying it pays twice for the same network. Never a
 * compile timeout or an internal compiler error either: those are Ventrio's
 * problem, and asking a model to fix our compiler is spending the user's money
 * on a guess.
 *
 * THE TWO SHAPES OF REPAIR, and why there are two rather than one:
 *
 *   - PATCH, when validation passed and compilation did not. A validated
 *     project is a base, so the model can be asked to change three lines in one
 *     file and leave the other ten alone. This is the good case and the common
 *     one: syntax errors and missing imports are local.
 *   - REWRITE, when there is no base at all — the response was not JSON, or the
 *     validator refused it. `applyPatch` requires a project that passed the
 *     gate, and there isn't one, so the only honest second request is the whole
 *     thing again with the failures attached.
 *
 * A patch request carries the current contents of the files it is expected to
 * touch. The provider call is single-turn: the model has no memory of what it
 * returned, and a patch against a base it cannot see is a rewrite with extra
 * steps.
 *
 * There is no fallback project. If both attempts fail the caller gets the
 * failure and the diagnostics, because substituting hand-written output would
 * be measuring the fixture rather than the model.
 */

import { GENERATION_LIMITS, deadlineFor } from "../gemini/config";
import {
  BudgetedTransport,
  type GeminiResponse,
  type GeminiTransport,
  type GeminiUsage,
} from "../gemini/transport";
import type { GeneratedAppV1 } from "./contract";
import { applyPatch } from "./edit";
import { buildGeneratedApp, describeFailure, type AppBuildResult, type BuildOptions } from "./pipeline";
import { appRepairPrompt, appRewritePrompt, appSystemPrompt, appUserPrompt, type AppRepairContext } from "./prompt";
import type { RuntimeTemplateId } from "./runtime";

/** Two: one generation, one repair. Never more. */
export const APP_MAX_REQUESTS = 2;

/**
 * How much of the project a patch request may carry back.
 *
 * Bounded because the alternative is a request whose size is chosen by the
 * model that just failed: a project at the 600 kB source budget would otherwise
 * become a 600 kB repair prompt. Six files covers every compile failure the
 * fixtures produce, and a failure spread wider than that is not a local defect
 * anyway — it becomes a rewrite.
 */
export const REPAIR_ECHO_FILES = 6;
export const REPAIR_ECHO_BYTES = 48_000;

/**
 * The ceiling for a standalone repair, which may carry the whole project.
 *
 * Larger than the in-run echo because the caller there has a specific failing
 * file list and this one does not: a runtime error arrives as a stack, not as a
 * path. Above this the repair is refused rather than truncated — a model shown
 * half a project silently invents the other half.
 */
export const REPAIR_WHOLE_PROJECT_BYTES = 200_000;

/**
 * Compile failures worth a second request.
 *
 * `build_failed` is the model's code and `budget_output` is the model's size.
 * `timeout` and `internal` are ours.
 */
const REPAIRABLE_COMPILE_CODES = new Set(["build_failed", "budget_output"]);

export type AppRepairMode = "patch" | "rewrite";

export interface AppStageRecord {
  stage: "generate" | "repair";
  ok: boolean;
  latencyMs: number;
  modelVersion?: string;
  usage?: GeminiUsage;
  failure?: string;
}

export interface AppTelemetry {
  model: string;
  requestCount: number;
  totalLatencyMs: number;
  stages: AppStageRecord[];
  repaired: boolean;
  /** Which shape the repair took, when one was attempted. */
  repairMode?: AppRepairMode;
}

export type AppFailureCode =
  | "transport"
  | "timeout"
  | "budget_exhausted"
  | "unparseable"
  | "refused"
  | "too_large";

/** Where a refusal happened. `patch` means the repair itself was malformed. */
export type AppFailureStage = "validate" | "compile" | "patch";

export interface AppGenerationInput {
  model: string;
  /** What to build. Passed through untouched; this file does not author briefs. */
  brief: string;
  template?: RuntimeTemplateId;
  /** Ventrio-owned asset id → data URI, offered to the build. */
  assets?: BuildOptions["assets"];
  /**
   * Hard ceiling for this run. 1 means one generation and no repair at all.
   *
   * Distinct from letting the transport refuse a second call: at 1 the repair
   * is never *attempted*, so the result reports why the project was actually
   * rejected instead of a misleading "budget exhausted" from a request that
   * should never have been made.
   */
  maxRequests?: number;
}

export type AppGenerationResult =
  | {
      ok: true;
      app: GeneratedAppV1;
      document: string;
      compiledBytes: number;
      documentBytes: number;
      compileMs: number;
      telemetry: AppTelemetry;
      /**
       * The model's raw response text — the accepted one, so a repaired run
       * returns the patch rather than the project it patched.
       *
       * Kept so a paid run can be replayed through a *later* gate offline. The
       * first canary in this project stored only compiled output, which meant
       * the next change to the pipeline could not be tested against real model
       * output without paying again.
       */
      raw?: string;
    }
  | {
      ok: false;
      code: AppFailureCode;
      message: string;
      stage?: AppFailureStage;
      issues?: string[];
      telemetry: AppTelemetry;
      raw?: string;
    };

/**
 * Generates one application, repairing once if the failure warrants it.
 */
export async function generateApp(
  input: AppGenerationInput,
  transport: GeminiTransport,
): Promise<AppGenerationResult> {
  const maxRequests = Math.max(1, Math.min(input.maxRequests ?? APP_MAX_REQUESTS, APP_MAX_REQUESTS));
  const budgeted =
    transport instanceof BudgetedTransport ? transport : new BudgetedTransport(transport, maxRequests);
  const stages: AppStageRecord[] = [];
  const startedAt = Date.now();
  let repairMode: AppRepairMode | undefined;

  const telemetry = (repaired = false): AppTelemetry => ({
    model: input.model,
    requestCount: budgeted.requestCount,
    totalLatencyMs: Date.now() - startedAt,
    stages,
    repaired,
    repairMode,
  });

  const controller = new AbortController();
  /**
   * The deadline covers the stages this run may actually attempt.
   *
   * Not a flat pipeline-wide timeout: that gave the repair whatever the
   * generation had not used, and three paid codegen runs each spent a repair
   * request into a remainder too small to answer in. The repair gets the budget
   * it was promised or the run does not start it.
   */
  const deadline = setTimeout(
    () => controller.abort(),
    deadlineFor(maxRequests >= 2 ? ["generate", "repair"] : ["generate"]),
  );

  const template = input.template ?? "react-spa";
  const system = appSystemPrompt(template);
  const user = appUserPrompt(input.brief);
  const buildOptions: BuildOptions = { assets: input.assets };

  try {
    const first = await budgeted.send(
      {
        model: input.model,
        system,
        user,
        timeoutMs: GENERATION_LIMITS.stageBTimeoutMs,
        maxOutputTokens: GENERATION_LIMITS.maxOutputTokensArtifact,
        label: "artifact",
      },
      controller.signal,
    );
    record(stages, "generate", first);
    if (!first.ok) {
      return { ok: false, code: transportCode(first), message: first.message, telemetry: telemetry() };
    }

    const attempt = await accept(first.text, buildOptions);
    if (attempt.ok) {
      return { ...succeed(attempt.build), telemetry: telemetry(), raw: first.text };
    }

    // Not permitted, or not worth paying for: report what actually happened.
    if (maxRequests < 2 || !attempt.repairable) {
      return { ...fail(attempt), telemetry: telemetry(), raw: first.text };
    }

    const plan = planRepair(attempt);
    repairMode = plan.mode;

    const repair = await budgeted.send(
      {
        model: input.model,
        system,
        user: plan.mode === "patch"
          ? appRepairPrompt(attempt.issues, plan.context)
          : appRewritePrompt(user, attempt.issues),
        timeoutMs: GENERATION_LIMITS.repairTimeoutMs,
        maxOutputTokens: GENERATION_LIMITS.maxOutputTokensRepair,
        label: "repair",
      },
      controller.signal,
    );
    record(stages, "repair", repair);
    if (!repair.ok) {
      // The original failure is what the caller needs to see; the repair's
      // transport error explains only why it is still unfixed.
      return {
        ...fail(attempt),
        message: `${attempt.message} The repair request failed: ${repair.message}`,
        telemetry: telemetry(true),
        raw: first.text,
      };
    }

    const second = plan.mode === "patch"
      ? await acceptPatch(repair.text, plan.base, buildOptions)
      : await accept(repair.text, buildOptions);

    if (second.ok) {
      return { ...succeed(second.build), telemetry: telemetry(true), raw: repair.text };
    }

    return {
      ...fail(second),
      message: `${second.message} The repair attempt did not resolve it.`,
      telemetry: telemetry(true),
      raw: repair.text,
    };
  } finally {
    clearTimeout(deadline);
  }
}

/* ── the standalone repair ───────────────────────────────────────────────── */

export interface AppRepairInput {
  model: string;
  /** A project that passed the gate. Runtime errors are reported against one. */
  base: GeneratedAppV1;
  /**
   * What is wrong, in the model's terms.
   *
   * Takes the same shape from either source: `describeFailure` for a build that
   * refused, `RuntimeErrorLog.describe()` for an app that mounted and threw.
   * Both are lists of concrete, file-and-rule sentences, which is the only
   * property the repair prompt depends on.
   */
  diagnostics: string[];
  /**
   * Paths to reproduce in the request. Defaults to the whole project.
   *
   * Worth passing when the caller knows where the fault is: a smaller prompt is
   * a cheaper request and a narrower invitation to rewrite.
   */
  focus?: string[];
  assets?: BuildOptions["assets"];
}

/**
 * One repair request against a known-good base.
 *
 * Separate from `generateApp` because the second half of the loop has a second
 * source. A build failure is caught before the app ever renders; a runtime
 * error arrives from the preview minutes later, from a project that compiled
 * cleanly, and there is no generation in flight to attach it to.
 */
export async function repairApp(
  input: AppRepairInput,
  transport: GeminiTransport,
): Promise<AppGenerationResult> {
  const budgeted = transport instanceof BudgetedTransport ? transport : new BudgetedTransport(transport, 1);
  const stages: AppStageRecord[] = [];
  const startedAt = Date.now();
  const telemetry = (): AppTelemetry => ({
    model: input.model,
    requestCount: budgeted.requestCount,
    totalLatencyMs: Date.now() - startedAt,
    stages,
    repaired: true,
    repairMode: "patch",
  });

  if (input.diagnostics.length === 0) {
    return {
      ok: false,
      code: "refused",
      message: "A repair needs at least one diagnostic.",
      telemetry: telemetry(),
    };
  }

  const context = echoContext(input.base, input.focus);
  if (!context) {
    return {
      ok: false,
      code: "too_large",
      message: `This project is over ${REPAIR_WHOLE_PROJECT_BYTES} B and no files were named, so a patch would have to be written against a project the model cannot see.`,
      telemetry: telemetry(),
    };
  }

  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), deadlineFor(["repair"]));
  try {
    const response = await budgeted.send(
      {
        model: input.model,
        system: appSystemPrompt(templateOf(input.base)),
        user: appRepairPrompt(input.diagnostics, context),
        timeoutMs: GENERATION_LIMITS.repairTimeoutMs,
        maxOutputTokens: GENERATION_LIMITS.maxOutputTokensRepair,
        label: "repair",
      },
      controller.signal,
    );
    record(stages, "repair", response);
    if (!response.ok) {
      return { ok: false, code: transportCode(response), message: response.message, telemetry: telemetry() };
    }

    const result = await acceptPatch(response.text, input.base, { assets: input.assets });
    if (result.ok) return { ...succeed(result.build), telemetry: telemetry(), raw: response.text };
    return { ...fail(result), telemetry: telemetry(), raw: response.text };
  } finally {
    clearTimeout(deadline);
  }
}

/* ── accepting a response ────────────────────────────────────────────────── */

type BuildOk = Extract<AppBuildResult, { ok: true }>;

type Attempt =
  | { ok: true; build: BuildOk }
  | {
      ok: false;
      code: AppFailureCode;
      message: string;
      stage?: AppFailureStage;
      issues: string[];
      /** Set only when a validated project exists to patch. */
      base?: GeneratedAppV1;
      /** The files the diagnostics implicate, in the order they were named. */
      implicated?: string[];
      /** Whether a second request could plausibly fix this. */
      repairable: boolean;
    };

/**
 * Parses a response as a whole project and runs it through the gate.
 */
async function accept(text: string, options: BuildOptions): Promise<Attempt> {
  let parsed: unknown;
  try {
    parsed = parseModelJson(text);
  } catch {
    return {
      ok: false,
      code: "unparseable",
      message: "The model's response was not valid JSON.",
      issues: ["The response was not valid JSON. Return only the JSON object — no prose, no code fence."],
      repairable: true,
    };
  }

  const build = await buildGeneratedApp(parsed, options);
  if (build.ok) return { ok: true, build };
  return refusal(build);
}

/**
 * Parses a response as a patch, applies it, and runs the result through the gate.
 *
 * Two validation passes, both necessary: `applyPatch` catches a write to a path
 * that may not exist, and the build catches a patch that is individually legal
 * and leaves the project broken — a deleted component three files still import.
 * Nothing is applied in place, so a repair that fails leaves the base as it was.
 */
async function acceptPatch(text: string, base: GeneratedAppV1, options: BuildOptions): Promise<Attempt> {
  let parsed: unknown;
  try {
    parsed = parseModelJson(text);
  } catch {
    return {
      ok: false,
      code: "unparseable",
      message: "The repair was not valid JSON.",
      issues: ["The response was not valid JSON. Return only the patch object — no prose, no code fence."],
      repairable: false,
    };
  }

  const patched = applyPatch(base, parsed);
  if (!patched.ok) {
    return {
      ok: false,
      code: "refused",
      message: `The patch was refused (${patched.issues.length} problem(s)).`,
      stage: "patch",
      issues: patched.issues.map((issue) => `${issue.path}: ${issue.code} — ${issue.detail}`),
      base,
      repairable: false,
    };
  }

  const build = await buildGeneratedApp(patched.app, options);
  if (build.ok) return { ok: true, build };
  return refusal(build);
}

function refusal(build: Extract<AppBuildResult, { ok: false }>): Attempt {
  const issues = describeFailure(build);
  if (build.stage === "validate") {
    return {
      ok: false,
      code: "refused",
      message: `The project was refused by validation (${build.issues.length} problem(s)).`,
      stage: "validate",
      issues,
      repairable: true,
    };
  }
  return {
    ok: false,
    code: "refused",
    message: `The project did not compile (${build.errors.length} error(s)).`,
    stage: "compile",
    issues,
    base: build.app,
    implicated: distinctFiles(build.errors),
    repairable: REPAIRABLE_COMPILE_CODES.has(build.code),
  };
}

/* ── choosing the repair ─────────────────────────────────────────────────── */

type RepairPlan =
  | { mode: "patch"; base: GeneratedAppV1; context: AppRepairContext }
  | { mode: "rewrite" };

/**
 * Decides between patching and rewriting, from what the failure left behind.
 *
 * A patch needs two things: a project that passed the gate, and something
 * concrete to show the model. Missing either, the run falls back to a rewrite
 * rather than sending a patch request that cannot be answered — an unanswerable
 * paid request is worse than an expensive one.
 */
function planRepair(attempt: Extract<Attempt, { ok: false }>): RepairPlan {
  if (!attempt.base) return { mode: "rewrite" };
  const context = echoContext(attempt.base, attempt.implicated);
  if (!context) return { mode: "rewrite" };
  return { mode: "patch", base: attempt.base, context };
}

/**
 * Builds the view of the project a patch request carries.
 *
 * Returns null when there is nothing useful to show — no named files and a
 * project too large to reproduce whole — which is the signal to rewrite instead.
 */
function echoContext(app: GeneratedAppV1, focus?: string[]): AppRepairContext | null {
  const manifest = Object.keys(app.files).sort();
  const wanted = (focus ?? []).filter((path) => path in app.files);

  if (wanted.length === 0) {
    const total = manifest.reduce((sum, path) => sum + Buffer.byteLength(app.files[path], "utf8"), 0);
    if (total > REPAIR_WHOLE_PROJECT_BYTES) return null;
    const files: Record<string, string> = {};
    for (const path of manifest) files[path] = app.files[path];
    return { manifest, files, partial: false };
  }

  const files: Record<string, string> = {};
  let bytes = 0;
  for (const path of wanted.slice(0, REPAIR_ECHO_FILES)) {
    const size = Buffer.byteLength(app.files[path], "utf8");
    if (bytes + size > REPAIR_ECHO_BYTES) break;
    files[path] = app.files[path];
    bytes += size;
  }
  // Every named file was individually over the ceiling. Nothing to show.
  if (Object.keys(files).length === 0) return null;

  return {
    manifest,
    files,
    partial: Object.keys(files).length < manifest.length,
  };
}

/** Files the compiler blamed, deduplicated, in the order it blamed them. */
function distinctFiles(errors: ReadonlyArray<{ file?: string }>): string[] {
  const seen: string[] = [];
  for (const error of errors) {
    if (error.file && !seen.includes(error.file)) seen.push(error.file);
  }
  return seen;
}

/* ── shared plumbing ─────────────────────────────────────────────────────── */

function succeed(build: BuildOk) {
  return {
    ok: true as const,
    app: build.app,
    document: build.document,
    compiledBytes: build.compiledBytes,
    documentBytes: build.documentBytes,
    compileMs: build.compileMs,
  };
}

function fail(attempt: Extract<Attempt, { ok: false }>) {
  return {
    ok: false as const,
    code: attempt.code,
    message: attempt.message,
    stage: attempt.stage,
    issues: attempt.issues,
  };
}

/**
 * Parses the response, tolerating a markdown fence around it.
 *
 * The prompt asks for a bare JSON object and models wrap it in ```json anyway —
 * all three codegen canary runs did, every time, and a bare `JSON.parse` threw
 * away three complete and otherwise valid bundles and spent a repair request on
 * each. This is the same tolerance, deliberately re-stated for the app path
 * rather than shared: it is four lines, and the codegen copy is pinned by a
 * source-level regression test that a move would quietly defeat.
 *
 * Not a relaxed gate. A fence is transport encoding, not content: validation,
 * the budgets and the compile all still run, unchanged, on whatever is inside.
 */
function parseModelJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

function templateOf(app: GeneratedAppV1): RuntimeTemplateId {
  // The stored template is a string by contract; the prompt needs a known one.
  // A project that validated has a template from the allowlist, so this only
  // guards against a base assembled by something other than the gate.
  return (app.runtime.template as RuntimeTemplateId) ?? "react-spa";
}

function transportCode(response: Extract<GeminiResponse, { ok: false }>): AppFailureCode {
  if (response.code === "timeout") return "timeout";
  if (response.message.includes("budget")) return "budget_exhausted";
  return "transport";
}

function record(stages: AppStageRecord[], stage: AppStageRecord["stage"], response: GeminiResponse): void {
  stages.push(
    response.ok
      ? { stage, ok: true, latencyMs: response.latencyMs, modelVersion: response.modelVersion, usage: response.usage }
      : { stage, ok: false, latencyMs: response.latencyMs, failure: `${response.code}: ${response.message}` },
  );
}
