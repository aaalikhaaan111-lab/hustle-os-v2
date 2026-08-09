/**
 * Codegen generation: one request, and at most one repair.
 *
 * A hard ceiling of two provider requests, enforced by `BudgetedTransport` as
 * well as by the control flow here — a budget kept in one place is a budget
 * kept by accident.
 *
 * The repair is spent only on failures a second attempt can plausibly fix:
 * malformed JSON, a refused envelope, a refused bundle. It is never spent on a
 * transport failure — a timeout or a 5xx says nothing about the bundle, and
 * retrying it is paying twice for the same network.
 *
 * There is no fallback bundle. If both attempts fail the caller gets the
 * failure and the issue list, because a prototype that silently substitutes
 * hand-written output would be measuring the wrong thing.
 */

import { GENERATION_LIMITS, deadlineFor } from "../gemini/config";
import { BudgetedTransport, type GeminiResponse, type GeminiTransport, type GeminiUsage } from "../gemini/transport";
import { compileCodegenBundle, type CodegenReport, type CodegenStage, type CompiledRoute } from "./compile";
import type { ContentPack } from "./content";
import { TRUSTED_ASSETS, type AssetRegistry } from "./assets";
import { codegenSystemPrompt, codegenUserPrompt } from "./prompt";
import type { RejectIssue } from "./reject";
import { validateCodegenEnvelope, type CodegenBundleV1 } from "./envelope";

/** Two: one generation, one repair. Never more. */
export const CODEGEN_MAX_REQUESTS = 2;

export interface CodegenStageRecord {
  stage: "bundle" | "repair";
  ok: boolean;
  latencyMs: number;
  modelVersion?: string;
  usage?: GeminiUsage;
  failure?: string;
}

export interface CodegenTelemetry {
  model: string;
  requestCount: number;
  totalLatencyMs: number;
  stages: CodegenStageRecord[];
  repaired: boolean;
}

export interface CodegenGenerationInput {
  model: string;
  /** One paragraph describing the product. Never the page copy. */
  brief: string;
  content: ContentPack;
  routes: ReadonlyArray<{ path: string; purpose: string }>;
  /**
   * Assets this site may place. Drives both the prompt and the gate.
   *
   * Passing an empty registry is meaningful, not a mistake: it tells the model
   * there are no pictures, and the gate then refuses any layout that implies
   * one. That pairing is what stops an empty visual column being generated.
   */
  assets?: AssetRegistry;
  /**
   * Hard ceiling for this run. 1 means one generation and no repair at all.
   *
   * Distinct from letting the transport refuse a second call: at 1 the repair
   * is never *attempted*, so the result reports the real reason the bundle was
   * rejected instead of a misleading "budget exhausted" from a request that
   * should never have been made.
   */
  maxRequests?: number;
}

export type CodegenGenerationResult =
  | {
      ok: true;
      routes: CompiledRoute[];
      report: CodegenReport;
      /** The accepted bundle, for callers that store it and recompile on read. */
      bundle: CodegenBundleV1;
      telemetry: CodegenTelemetry;
      /**
       * The model's raw response text.
       *
       * Kept so a paid run can be replayed through a *later* gate offline. The
       * first canary stored only its compiled output, which meant the next
       * change to the pipeline could not be tested against real model output
       * without paying again. Local diagnostics only.
       */
      raw?: string;
    }
  | {
      ok: false;
      code: "transport" | "unparseable" | "refused" | "timeout" | "budget_exhausted";
      message: string;
      stage?: CodegenStage;
      issues?: string[];
      telemetry: CodegenTelemetry;
      /** Raw model text, kept so a failed paid run is still diagnosable. */
      raw?: string;
    };

export async function generateCodegenBundle(
  input: CodegenGenerationInput,
  transport: GeminiTransport,
): Promise<CodegenGenerationResult> {
  const maxRequests = Math.max(1, Math.min(input.maxRequests ?? CODEGEN_MAX_REQUESTS, CODEGEN_MAX_REQUESTS));
  const budgeted =
    transport instanceof BudgetedTransport ? transport : new BudgetedTransport(transport, maxRequests);
  const stages: CodegenStageRecord[] = [];
  const startedAt = Date.now();

  const telemetry = (repaired = false): CodegenTelemetry => ({
    model: input.model,
    requestCount: budgeted.requestCount,
    totalLatencyMs: Date.now() - startedAt,
    stages,
    repaired,
  });

  const controller = new AbortController();
  /**
   * The deadline covers the stages this run may actually attempt.
   *
   * Previously a flat pipeline-wide timeout, which meant the repair inherited
   * whatever the generation had not used. Three paid canary runs each spent a
   * repair request into 7.9-86.9 s of remaining budget and each timed out. The
   * deadline is now the sum of the stages plus slack, so the repair has the
   * budget it was promised rather than the remainder.
   */
  const deadline = setTimeout(
    () => controller.abort(),
    deadlineFor(maxRequests >= 2 ? ["generate", "repair"] : ["generate"]),
  );

  const assets = input.assets ?? TRUSTED_ASSETS;
  const system = codegenSystemPrompt(assets.size > 0);
  const user = codegenUserPrompt(input.brief, input.content, input.routes, assets);

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
    record(stages, "bundle", first);
    if (!first.ok) {
      return { ok: false, code: transportCode(first), message: first.message, telemetry: telemetry() };
    }

    const attempt = accept(first.text, input.content, assets);
    if (attempt.ok) {
      return { ok: true, routes: attempt.routes, report: attempt.report, bundle: attempt.bundle, telemetry: telemetry(), raw: first.text };
    }

    if (maxRequests < 2) {
      // Repair not permitted for this run: report what the gate actually said.
      return {
        ok: false,
        code: attempt.code,
        message: attempt.message,
        stage: attempt.stage,
        issues: attempt.issues,
        telemetry: telemetry(),
        raw: first.text,
      };
    }

    // One repair, on a failure the model can act on.
    const repair = await budgeted.send(
      {
        model: input.model,
        system,
        user: repairPrompt(user, attempt.issues),
        timeoutMs: GENERATION_LIMITS.repairTimeoutMs,
        maxOutputTokens: GENERATION_LIMITS.maxOutputTokensRepair,
        label: "repair",
      },
      controller.signal,
    );
    record(stages, "repair", repair);
    if (!repair.ok) {
      return {
        ok: false,
        code: transportCode(repair),
        message: repair.message,
        stage: attempt.stage,
        issues: attempt.issues,
        telemetry: telemetry(true),
        raw: first.text,
      };
    }

    const second = accept(repair.text, input.content, assets);
    if (second.ok) {
      return { ok: true, routes: second.routes, report: second.report, bundle: second.bundle, telemetry: telemetry(true), raw: repair.text };
    }

    return {
      ok: false,
      code: second.code,
      message: `${second.message} The repair attempt did not resolve it.`,
      stage: second.stage,
      issues: second.issues,
      telemetry: telemetry(true),
      raw: repair.text,
    };
  } finally {
    clearTimeout(deadline);
  }
}

type Attempt =
  | { ok: true; routes: CompiledRoute[]; report: CodegenReport; bundle: CodegenBundleV1 }
  | { ok: false; code: "unparseable" | "refused"; message: string; stage?: CodegenStage; issues: string[] };

/**
 * Parses the response, tolerating a markdown fence around it.
 *
 * The prompt asks for a bare JSON object and the model wraps it in ```json
 * anyway — all three canary runs did, every time, and a bare `JSON.parse`
 * threw away three complete and otherwise valid bundles and spent a repair
 * request on each. The artifact path has had exactly this for the same reason
 * (see `parseJsonRelaxed` in actions/stage3.ts); codegen simply never got it.
 *
 * This is not a relaxed gate. A fence is transport encoding, not content: the
 * envelope check, the reject pass, the budgets, the substitution rules and the
 * shell all still run, unchanged, on whatever is inside it. Nothing that was
 * refused before is accepted now except the wrapper itself.
 */
function parseBundleJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

function accept(text: string, content: ContentPack, assets: AssetRegistry): Attempt {
  let parsed: unknown;
  try {
    parsed = parseBundleJson(text) as unknown;
  } catch {
    return {
      ok: false,
      code: "unparseable",
      message: "The model's response was not valid JSON.",
      issues: ["The response was not valid JSON. Return only the JSON object — no prose, no code fence."],
    };
  }

  const compiled = compileCodegenBundle(parsed, { content, assets });
  if (!compiled.ok) {
    return {
      ok: false,
      code: "refused",
      message: `The bundle was refused at the "${compiled.stage}" stage (${compiled.issues.length} problem(s)).`,
      stage: compiled.stage,
      issues: compiled.issues.map(describe),
    };
  }

  // The typed bundle, recovered so a caller can persist what the gate accepted
  // rather than the compiled pages. Re-running the envelope check is pure and
  // cheap, and it cannot disagree — the compile that just passed begins with
  // the same call. Deriving it here rather than widening the compiler's result
  // keeps the storage concern out of the gate chain.
  const envelope = validateCodegenEnvelope(parsed);
  if (!envelope.ok) {
    // Unreachable unless the two checks have drifted apart, which is a bug in
    // this file rather than in the model's output. Reported rather than
    // asserted, because the alternative is throwing inside a paid request.
    return {
      ok: false,
      code: "refused",
      message: "The bundle compiled but failed envelope validation.",
      stage: "envelope",
      issues: envelope.issues.map((issue) => `${issue.path}: ${issue.code} — ${issue.detail}`),
    };
  }

  return { ok: true, routes: compiled.routes, report: compiled.report, bundle: envelope.bundle };
}

function describe(issue: RejectIssue): string {
  return `${issue.path}: ${issue.code} — ${issue.detail}`;
}

/**
 * The repair request restates the task and appends what went wrong.
 *
 * The rejected bundle itself is not echoed back. It can be 60 KB, the failure
 * list already says what to change, and returning a refused document to a model
 * invites it to patch around the rule rather than to follow it.
 */
function repairPrompt(originalUser: string, issues: string[]): string {
  return `${originalUser}

YOUR PREVIOUS BUNDLE WAS REJECTED. Fix every point and return the whole bundle
again as a single JSON object.

${issues.slice(0, 25).map((issue) => `- ${issue}`).join("\n")}`;
}

function transportCode(response: Extract<GeminiResponse, { ok: false }>): "transport" | "timeout" | "budget_exhausted" {
  if (response.code === "timeout") return "timeout";
  if (response.message.includes("budget")) return "budget_exhausted";
  return "transport";
}

function record(stages: CodegenStageRecord[], stage: CodegenStageRecord["stage"], response: GeminiResponse): void {
  stages.push(
    response.ok
      ? { stage, ok: true, latencyMs: response.latencyMs, modelVersion: response.modelVersion, usage: response.usage }
      : { stage, ok: false, latencyMs: response.latencyMs, failure: `${response.code}: ${response.message}` },
  );
}
