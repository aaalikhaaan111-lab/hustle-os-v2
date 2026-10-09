import "server-only";

/**
 * Reports Gemini call telemetry to the AI Cost Observability service. Added
 * 2026-10-09, for the first real integration of that service.
 *
 * WHAT THIS IS NOT. Not a gateway: Gemini calls still go straight from
 * `GoogleGeminiTransport` to Google, exactly as before. This client only
 * reports AFTER a call already happened — usage counts and a latency number,
 * never anything on the request's critical path.
 *
 * WHERE THE NUMBERS COME FROM. `requestGeneration`/`requestRepair` in
 * `../v2/app/stages.ts` already return a `ProviderOutcome` with `latencyMs`
 * and a `ProviderUsage` (`inputTokens`, `outputTokens`, `thoughtsTokens`,
 * `cachedTokens`) on both the success and failure branches — see
 * `providerUsage()` and `usageFromDiagnostics()` there. This module adds
 * nothing to what Gemini returns; it only forwards a subset of what Ventrio
 * already parsed out of the response.
 *
 * THINKING TOKENS, BILLED ONCE. Ventrio's own `GeminiUsage` type
 * (`../gemini/transport.ts`) carries `thoughtsTokenCount` separately from
 * `candidatesTokenCount` with the comment "Billed as output, reported apart
 * from it" — i.e. Google bills thinking tokens at the output rate, Ventrio
 * just doesn't fold them together internally. The observability service's own
 * cost formula prices exactly one `output_tokens` number per call, so
 * `billableOutputTokens()` below does the folding: `outputTokens +
 * thoughtsTokens`. Skipping this step would silently undercount every call
 * that used thinking — this is the same bug that was found and fixed in the
 * observability service's own `examples/gemini-integration.ts` before this
 * integration was built, and the installed Gemini REST response
 * (`GeminiApiResponse.usageMetadata` in `../gemini/googleTransport.ts`) uses
 * the identical field name, confirmed by reading that file directly — Ventrio
 * has no `@google/genai` SDK dependency at all; the adapter is hand-rolled
 * `fetch` against the REST endpoint, so this file is already the ground truth
 * for "the installed SDK's semantics," not a separate assumption layered on
 * top of one.
 *
 * NEVER SENT: prompts, generated app output, the Gemini key, email
 * addresses, names, conversation content, Supabase tokens. The only strings
 * this module ever puts in a request body are: a feature literal, a Ventrio
 * user id (pseudonymous — a UUID, never an email or name), an environment
 * literal, a model id, and one of a small fixed vocabulary of error codes
 * (`ProviderOutcome.code`, e.g. "timeout", "blocked", "rate_limited" — never
 * `ProviderOutcome.message`, which is free-form prose). Everything else is a
 * number or a timestamp.
 *
 * DETERMINISTIC EVENT IDS. `claimProviderRequest` (see
 * `../jobs/generationJobs.ts`) already guarantees the real Gemini request for
 * one job/phase happens at most once — a redelivered queue message is turned
 * away before the provider is ever called. `${jobId}:${phase}` is therefore
 * already unique per actual provider call, with no extra bookkeeping needed,
 * and it is also stable across any accidental repeated call to this module
 * for the same outcome (e.g. a retry of this reporting call itself) — the
 * observability service's own ingestion is idempotent on
 * `(project, external_event_id)`, so a repeat here costs nothing twice.
 *
 * FAIL-OPEN. `reportProviderCallTelemetry` never throws. A timeout, a DNS
 * failure, a non-2xx response — all caught, logged as one structured line
 * (ids and codes only, matching the rest of this codebase's logging
 * discipline — see `log()` in `worker/main.ts`), and otherwise ignored. There
 * is no retry: a dropped telemetry event is a gap in a dashboard, and retrying
 * it would risk adding real latency to a generation worker over something
 * that was never allowed to affect generation in the first place.
 */

export type TelemetryPhase = "generate" | "repair";
export type TelemetryOperationStatus = "running" | "succeeded" | "failed";

export interface TelemetryUsage {
  inputTokens?: number;
  outputTokens?: number;
  thoughtsTokens?: number;
}

export interface TelemetryCallInput {
  jobId: string;
  phase: TelemetryPhase;
  /** 1 for the generate call, 2 for the repair call — see GENERATE_EXPECTS/REPAIR_EXPECTS in runGeneration.ts. */
  attemptNumber: number;
  userId: string;
  model: string;
  latencyMs: number;
  usage: TelemetryUsage | undefined;
  /** Whether THIS provider call succeeded (got a usable response), independent of the job's overall outcome. */
  callSucceeded: boolean;
  /** A short, fixed-vocabulary code (ProviderOutcome.code) — never free-form provider text. */
  errorCode?: string;
  /** The job's status AFTER this call, as Ventrio itself has already decided it. */
  operationStatus: TelemetryOperationStatus;
}

export interface TelemetryConfig {
  enabled: boolean;
  url: string | null;
  apiKey: string | null;
  timeoutMs: number;
  fetchImpl: typeof fetch;
}

const DEFAULT_TIMEOUT_MS = 3_000;
const FEATURE = "first_version_generation";

/** Reads the three AI_COST_OBSERVABILITY_* vars. Never NEXT_PUBLIC_ — server-only, by design. */
export function resolveTelemetryConfig(
  env: NodeJS.ProcessEnv = process.env,
  overrides: Partial<Pick<TelemetryConfig, "timeoutMs" | "fetchImpl">> = {},
): TelemetryConfig {
  return {
    enabled: env.AI_COST_OBSERVABILITY_ENABLED === "1",
    url: env.AI_COST_OBSERVABILITY_URL?.trim() || null,
    apiKey: env.AI_COST_OBSERVABILITY_API_KEY?.trim() || null,
    timeoutMs: overrides.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    fetchImpl: overrides.fetchImpl ?? fetch,
  };
}

/** Thinking tokens billed once, folded into output — see the module header. */
export function billableOutputTokens(usage: TelemetryUsage | undefined): number {
  return (usage?.outputTokens ?? 0) + (usage?.thoughtsTokens ?? 0);
}

function environmentLiteral(): string {
  return process.env.NODE_ENV === "development" ? "development" : "production";
}

function logTelemetryOutcome(event: string, fields: Record<string, unknown>): void {
  // Same discipline as worker/main.ts's log(): ids, codes, counts — never a
  // key, never a prompt, never provider text.
  console.log("[ai-cost-observability]", JSON.stringify({ event, at: new Date().toISOString(), ...fields }));
}

/**
 * Reports one Gemini provider call. Never throws, never retries, never
 * blocks longer than `config.timeoutMs`. Call this AFTER the call it
 * describes has already completed — it has no side effect on generation.
 */
export async function reportProviderCallTelemetry(
  input: TelemetryCallInput,
  config: TelemetryConfig = resolveTelemetryConfig(),
): Promise<void> {
  if (!config.enabled) return;
  if (!config.url || !config.apiKey) {
    // Enabled but unconfigured is a deployment mistake worth one log line —
    // still never a value, only the fact that something is missing.
    logTelemetryOutcome("telemetry_unconfigured", { jobId: input.jobId, phase: input.phase });
    return;
  }

  const body: Record<string, unknown> = {
    external_event_id: `${input.jobId}:${input.phase}`,
    external_operation_id: input.jobId,
    feature: FEATURE,
    external_end_user_id: input.userId,
    environment: environmentLiteral(),
    operation_status: input.operationStatus,
    model: input.model,
    input_tokens: input.usage?.inputTokens ?? 0,
    output_tokens: billableOutputTokens(input.usage),
    latency_ms: Math.max(0, Math.round(input.latencyMs)),
    call_status: input.callSucceeded ? "succeeded" : "failed",
    attempt_number: input.attemptNumber,
    event_timestamp: new Date().toISOString(),
  };
  // error_code must be ABSENT, not null, when the call succeeded — the
  // ingestion schema is .strict() and rejects a null here.
  if (!input.callSucceeded && input.errorCode) {
    body.error_code = input.errorCode;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await config.fetchImpl(`${config.url}/api/v1/events`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      logTelemetryOutcome("telemetry_rejected", {
        jobId: input.jobId,
        phase: input.phase,
        status: response.status,
      });
    }
  } catch (error) {
    logTelemetryOutcome("telemetry_failed", {
      jobId: input.jobId,
      phase: input.phase,
      reason: error instanceof Error ? error.name : "unknown",
    });
  } finally {
    clearTimeout(timer);
  }
}
