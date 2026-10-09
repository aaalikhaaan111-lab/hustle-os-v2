/**
 * The AI Cost Observability telemetry client, driven directly.
 *
 *   npx tsx scripts/observability-telemetry.test.mts
 *
 * Mocked Gemini and mocked HTTP only. No paid call is made anywhere in this
 * file — `reportProviderCallTelemetry` is tested against a fake `fetch`
 * implementation, never the real network, and nothing here ever imports
 * `GoogleGeminiTransport`.
 *
 * Offline.
 */

import {
  billableOutputTokens,
  reportProviderCallTelemetry,
  resolveTelemetryConfig,
  type TelemetryCallInput,
  type TelemetryConfig,
} from "../src/lib/observability/telemetryClient";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    passed += 1;
    return;
  }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const FAKE_URL = "https://observability.example.test";
const FAKE_KEY = "aicl_live_test_only_never_a_real_key_0000000000";

interface CapturedRequest {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

/** A fetch stand-in that records what it was called with and returns a canned response. */
function recordingFetch(
  responses: Array<{ ok: boolean; status?: number } | "throw" | "hang"> = [{ ok: true }],
): { fetchImpl: typeof fetch; calls: CapturedRequest[] } {
  const calls: CapturedRequest[] = [];
  let i = 0;
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    const behavior = responses[Math.min(i, responses.length - 1)];
    i += 1;
    calls.push({
      url,
      headers: Object.fromEntries(Object.entries((init?.headers as Record<string, string>) ?? {})),
      body: JSON.parse(String(init?.body ?? "{}")),
    });
    if (behavior === "throw") throw new Error("simulated network failure");
    if (behavior === "hang") {
      // Never resolves on its own; only the AbortSignal can end this call.
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    }
    return { ok: behavior.ok, status: behavior.status ?? (behavior.ok ? 201 : 500) } as Response;
  }) as typeof fetch;
  return { fetchImpl, calls };
}

function baseInput(overrides: Partial<TelemetryCallInput> = {}): TelemetryCallInput {
  return {
    jobId: "job-1",
    phase: "generate",
    attemptNumber: 1,
    userId: "user-uuid-1",
    model: "gemini-3.6-flash",
    latencyMs: 2500,
    usage: { inputTokens: 1000, outputTokens: 300, thoughtsTokens: 700 },
    callSucceeded: true,
    operationStatus: "succeeded",
    ...overrides,
  };
}

function enabledConfig(
  overrides: Partial<TelemetryConfig> = {},
  fetchImpl: typeof fetch = recordingFetch().fetchImpl,
): TelemetryConfig {
  return {
    enabled: true,
    url: FAKE_URL,
    apiKey: FAKE_KEY,
    timeoutMs: 200,
    fetchImpl,
    ...overrides,
  };
}

/* ── 1. a successful call maps to one correctly-shaped event ─────────────── */
{
  const { fetchImpl, calls } = recordingFetch();
  await reportProviderCallTelemetry(baseInput(), enabledConfig({}, fetchImpl));

  check("exactly one request was sent", calls.length === 1, `got ${calls.length}`);
  const body = calls[0]?.body ?? {};
  check("hits the documented ingestion URL", calls[0]?.url === `${FAKE_URL}/api/v1/events`);
  check("authenticates with Bearer <api key>", calls[0]?.headers.authorization === `Bearer ${FAKE_KEY}`);
  check("external_operation_id is the job id", body.external_operation_id === "job-1");
  check("external_event_id is deterministic: job id + phase", body.external_event_id === "job-1:generate");
  check("feature is a fixed literal", body.feature === "first_version_generation");
  check("end-user id is the Ventrio user id, pseudonymous", body.external_end_user_id === "user-uuid-1");
  check("call_status reflects the call outcome", body.call_status === "succeeded");
  check("operation_status is passed through as given", body.operation_status === "succeeded");
  check("attempt_number is passed through", body.attempt_number === 1);
  check("input_tokens is the raw prompt token count", body.input_tokens === 1000);
  check("latency_ms is rounded and non-negative", body.latency_ms === 2500);
  check("event_timestamp is a real ISO-8601 string", typeof body.event_timestamp === "string" && !Number.isNaN(Date.parse(body.event_timestamp as string)));
  check("no error_code on a succeeded call (schema rejects null here)", !("error_code" in body));
}

/* ── 2. thinking tokens are folded into output_tokens exactly once ───────── */
{
  const { fetchImpl, calls } = recordingFetch();
  check(
    "billableOutputTokens folds candidates + thoughts",
    billableOutputTokens({ inputTokens: 1, outputTokens: 300, thoughtsTokens: 700 }) === 1000,
  );
  check("billableOutputTokens handles a response with no thinking", billableOutputTokens({ outputTokens: 300 }) === 300);
  check("billableOutputTokens handles missing usage entirely", billableOutputTokens(undefined) === 0);

  await reportProviderCallTelemetry(
    baseInput({ usage: { inputTokens: 500, outputTokens: 300, thoughtsTokens: 700 } }),
    enabledConfig({}, fetchImpl),
  );
  const body = calls[0]?.body ?? {};
  check("the sent output_tokens is candidates+thoughts, counted once", body.output_tokens === 1000);
}

/* ── 3. a failed Gemini call produces a failed event with a safe error code ─ */
{
  const { fetchImpl, calls } = recordingFetch();
  await reportProviderCallTelemetry(
    baseInput({
      callSucceeded: false,
      errorCode: "timeout",
      usage: undefined,
      operationStatus: "failed",
    }),
    enabledConfig({}, fetchImpl),
  );
  const body = calls[0]?.body ?? {};
  check("call_status is failed", body.call_status === "failed");
  check("operation_status is failed", body.operation_status === "failed");
  check("error_code carries the short fixed-vocabulary code", body.error_code === "timeout");
  check("missing usage defaults tokens to zero rather than omitting them", body.input_tokens === 0 && body.output_tokens === 0);
}

/* ── 4. two calls under one operation get different, phase-scoped event ids ─ */
{
  const { fetchImpl, calls } = recordingFetch();
  await reportProviderCallTelemetry(baseInput({ jobId: "job-2", phase: "generate", attemptNumber: 1 }), enabledConfig({}, fetchImpl));
  await reportProviderCallTelemetry(baseInput({ jobId: "job-2", phase: "repair", attemptNumber: 2 }), enabledConfig({}, fetchImpl));

  const [generateBody, repairBody] = calls.map((c) => c.body);
  check("both events share one operation id", generateBody?.external_operation_id === "job-2" && repairBody?.external_operation_id === "job-2");
  check(
    "but have different event ids",
    generateBody?.external_event_id === "job-2:generate" && repairBody?.external_event_id === "job-2:repair",
  );
  check("attempt numbers differ: generate=1, repair=2", generateBody?.attempt_number === 1 && repairBody?.attempt_number === 2);
}

/* ── 5. replaying the same attempt keeps the same deterministic event id ─── */
{
  const { fetchImpl, calls } = recordingFetch();
  await reportProviderCallTelemetry(baseInput({ jobId: "job-3", phase: "generate" }), enabledConfig({}, fetchImpl));
  await reportProviderCallTelemetry(baseInput({ jobId: "job-3", phase: "generate" }), enabledConfig({}, fetchImpl));

  const ids = calls.map((c) => c.body.external_event_id);
  check("a replayed report for the same job+phase sends the identical event id", ids[0] === "job-3:generate" && ids[1] === "job-3:generate");
}

/* ── 6. an observability outage never throws (so it can never fail generation) ─ */
{
  const { fetchImpl: throwingFetch } = recordingFetch(["throw"]);
  let threw = false;
  try {
    await reportProviderCallTelemetry(baseInput({ jobId: "job-4" }), enabledConfig({}, throwingFetch));
  } catch {
    threw = true;
  }
  check("a thrown network error does not propagate out of the reporter", !threw);

  const { fetchImpl: serverErrorFetch } = recordingFetch([{ ok: false, status: 500 }]);
  threw = false;
  try {
    await reportProviderCallTelemetry(baseInput({ jobId: "job-5" }), enabledConfig({}, serverErrorFetch));
  } catch {
    threw = true;
  }
  check("a non-2xx response does not propagate out of the reporter either", !threw);
}

/* ── 7. a hung connection times out instead of blocking generation forever ── */
{
  const { fetchImpl: hangingFetch } = recordingFetch(["hang"]);
  const startedAt = Date.now();
  let threw = false;
  try {
    await reportProviderCallTelemetry(baseInput({ jobId: "job-6" }), enabledConfig({ timeoutMs: 150 }, hangingFetch));
  } catch {
    threw = true;
  }
  const elapsed = Date.now() - startedAt;
  check("a hung request does not throw", !threw);
  check("it resolves close to the configured timeout, not indefinitely", elapsed < 1500, `took ${elapsed}ms`);
}

/* ── 8. observability disabled performs no network request at all ────────── */
{
  const { fetchImpl, calls } = recordingFetch();
  await reportProviderCallTelemetry(baseInput({ jobId: "job-7" }), { ...enabledConfig({}, fetchImpl), enabled: false });
  check("no request is sent when AI_COST_OBSERVABILITY_ENABLED is not set", calls.length === 0);
}

/* ── 8b. enabled but unconfigured (missing url/key) also sends nothing ───── */
{
  const { fetchImpl, calls } = recordingFetch();
  await reportProviderCallTelemetry(baseInput({ jobId: "job-7b" }), { ...enabledConfig({}, fetchImpl), url: null });
  check("enabled with no URL configured sends no request", calls.length === 0);
}

/* ── 9. only the documented fields ever leave this module ────────────────── */
{
  const { fetchImpl, calls } = recordingFetch();
  const ALLOWED_KEYS = new Set([
    "external_event_id",
    "external_operation_id",
    "feature",
    "external_end_user_id",
    "environment",
    "operation_status",
    "model",
    "input_tokens",
    "output_tokens",
    "latency_ms",
    "call_status",
    "error_code",
    "attempt_number",
    "event_timestamp",
  ]);
  await reportProviderCallTelemetry(
    baseInput({ jobId: "job-8", callSucceeded: false, errorCode: "blocked" }),
    enabledConfig({}, fetchImpl),
  );
  const sentKeys = Object.keys(calls[0]?.body ?? {});
  const unexpected = sentKeys.filter((key) => !ALLOWED_KEYS.has(key));
  check("every sent key is on the documented allow-list (no prompt/output/content field exists to leak)", unexpected.length === 0, `unexpected: ${unexpected.join(", ")}`);

  const serialized = JSON.stringify(calls[0]?.body ?? {});
  check("the serialized payload contains no @ sign (no email could have been smuggled in)", !serialized.includes("@"));
  check("the serialized payload never contains the api key", !serialized.includes(FAKE_KEY));
}

/* ── 10. the ingestion key is never logged, success or failure ───────────── */
{
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const logged: string[] = [];
  console.log = (...args: unknown[]) => logged.push(args.map(String).join(" "));
  console.warn = (...args: unknown[]) => logged.push(args.map(String).join(" "));
  console.error = (...args: unknown[]) => logged.push(args.map(String).join(" "));
  try {
    const { fetchImpl: ok } = recordingFetch();
    await reportProviderCallTelemetry(baseInput({ jobId: "job-9" }), enabledConfig({}, ok));

    const { fetchImpl: failing } = recordingFetch(["throw"]);
    await reportProviderCallTelemetry(baseInput({ jobId: "job-10" }), enabledConfig({}, failing));

    const { fetchImpl: rejected } = recordingFetch([{ ok: false, status: 401 }]);
    await reportProviderCallTelemetry(baseInput({ jobId: "job-11" }), enabledConfig({}, rejected));

    // Enabled-but-unconfigured also logs a line — must not leak either.
    await reportProviderCallTelemetry(baseInput({ jobId: "job-12" }), { ...enabledConfig({}, ok), apiKey: null });
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  }
  const allLogged = logged.join("\n");
  check("the real API key never appears in any log line across success, throw, rejection, or misconfiguration", !allLogged.includes(FAKE_KEY));
}

/* ── 11. resolveTelemetryConfig reads only server-only var names ─────────── */
{
  const cfg = resolveTelemetryConfig({
    AI_COST_OBSERVABILITY_ENABLED: "1",
    AI_COST_OBSERVABILITY_URL: "https://x.example",
    AI_COST_OBSERVABILITY_API_KEY: "k",
  } as unknown as NodeJS.ProcessEnv);
  check("enabled reads from AI_COST_OBSERVABILITY_ENABLED=1", cfg.enabled === true);
  check("url reads from AI_COST_OBSERVABILITY_URL", cfg.url === "https://x.example");

  const disabledByDefault = resolveTelemetryConfig({} as unknown as NodeJS.ProcessEnv);
  check("disabled by default when the env var is absent", disabledByDefault.enabled === false);
}

/* ── report ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`FAILED ${failures.length} of ${passed + failures.length}`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`observability telemetry: ${passed} checks passed`);
