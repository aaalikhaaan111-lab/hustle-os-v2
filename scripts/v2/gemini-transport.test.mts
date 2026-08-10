/**
 * The Gemini adapter, and the proof that app-runtime cannot reach Anthropic.
 *
 *   npx tsx --conditions=react-server scripts/v2/gemini-transport.test.mts
 *
 * Offline and deterministic: `fetch` is injected, so every provider outcome —
 * a good response, an empty one, a safety block, a 429, a 500, a hang — is an
 * ordinary local object. No key, no network, no recorded fixtures.
 *
 * The second half is a static check rather than a behavioural one. "The app
 * path uses Gemini" is only true if no module reachable from it can construct
 * something else, and that is a property of the import graph, not of any one
 * run. It is walked here from the two real entry points.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { GoogleGeminiTransport, type FetchLike, type GeminiEmptyDiagnostics } from "../../src/lib/v2/gemini/googleTransport";
import { DEFAULT_GEMINI_MODEL, GENERATION_LIMITS } from "../../src/lib/v2/gemini/config";
import type { GeminiRequest } from "../../src/lib/v2/gemini/transport";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

/** Obviously fake, and the string every sanitisation check searches for. */
const FAKE_KEY = "AIzaSyFAKEKEYFAKEKEYFAKEKEYFAKEKEY0000000";
process.env.GEMINI_API_KEY = FAKE_KEY;

const request = (over: Partial<GeminiRequest> = {}): GeminiRequest => ({
  model: DEFAULT_GEMINI_MODEL,
  system: "You write complete React applications.",
  user: "Build a setlist tool.",
  maxOutputTokens: 32_000,
  label: "artifact",
  ...over,
});

interface Call { url: string; init: RequestInit }
const calls: Call[] = [];

function fetchReturning(status: number, payload: unknown, opts: { hang?: boolean } = {}): FetchLike {
  return async (url, init) => {
    calls.push({ url, init });
    if (opts.hang) {
      return new Promise<Response>((_, reject) => {
        const signal = init.signal as AbortSignal;
        const abort = () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        if (signal.aborted) abort();
        else signal.addEventListener("abort", abort, { once: true });
      });
    }
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload,
      text: async () => (typeof payload === "string" ? payload : JSON.stringify(payload)),
    } as Response;
  };
}

const GOOD = {
  candidates: [{ content: { parts: [{ text: '{"schemaVersion":"app-1"}' }] }, finishReason: "STOP" }],
  usageMetadata: { promptTokenCount: 1_484, candidatesTokenCount: 9_000, totalTokenCount: 10_484 },
  modelVersion: "gemini-3.6-flash-001",
};

/* ── 1. the request that goes out ────────────────────────────────────────── */

{
  calls.length = 0;
  const transport = new GoogleGeminiTransport(DEFAULT_GEMINI_MODEL, fetchReturning(200, GOOD));
  const result = await transport.send(request({ timeoutMs: 300_000 }), new AbortController().signal);
  const call = calls[0];
  const body = JSON.parse(String(call.init.body));
  const headers = call.init.headers as Record<string, string>;

  check("it posts to the Gemini endpoint", call.url.startsWith("https://generativelanguage.googleapis.com/v1beta/models/"));
  check("naming the configured model", call.url.includes(DEFAULT_GEMINI_MODEL));
  check("as a generateContent call", call.url.endsWith(":generateContent"));
  check("by POST", call.init.method === "POST");

  /* the key: in a header, and nowhere else at all */
  check("the key travels in the x-goog-api-key header", headers["x-goog-api-key"] === FAKE_KEY);
  check("the key is NOT in the URL", !call.url.includes(FAKE_KEY) && !/[?&]key=/.test(call.url));
  check("the key is NOT in the body", !String(call.init.body).includes(FAKE_KEY));

  check("the system prompt is sent as systemInstruction",
    body.systemInstruction.parts[0].text === "You write complete React applications.");
  check("the user prompt is sent as the user turn",
    body.contents[0].role === "user" && body.contents[0].parts[0].text === "Build a setlist tool.");
  check("the output budget is passed through", body.generationConfig.maxOutputTokens === 32_000);
  check("JSON is asked for by MIME type", body.generationConfig.responseMimeType === "application/json");
  check("no response schema is sent when none was given", !("responseSchema" in body.generationConfig));

  check("a good response succeeds", result.ok);
  check("the text is returned", result.ok && result.text === '{"schemaVersion":"app-1"}');
  check("usage is mapped", result.ok && result.usage?.promptTokenCount === 1_484 && result.usage?.candidatesTokenCount === 9_000);
  check("the resolved model version is reported", result.ok && result.modelVersion === "gemini-3.6-flash-001");
}

/* ── 2. a response with no usable text ───────────────────────────────────── */

{
  const transport = new GoogleGeminiTransport(DEFAULT_GEMINI_MODEL, fetchReturning(200, {
    candidates: [{ content: { parts: [{ thought: true, text: "internal reasoning SECRET-GEMINI-CANARY" }] }, finishReason: "MAX_TOKENS" }],
    usageMetadata: { promptTokenCount: 1_484, candidatesTokenCount: 32_000, thoughtsTokenCount: 31_000, cachedContentTokenCount: 0 },
    modelVersion: "gemini-3.6-flash-001",
  }));
  const result = await transport.send(request({ timeoutMs: 300_000 }), new AbortController().signal);
  const d = (!result.ok ? result.diagnostics : undefined) as GeminiEmptyDiagnostics | undefined;

  check("a text-free response fails as empty", !result.ok && result.code === "empty");
  check("the finish reason is kept", d?.finishReason === "MAX_TOKENS");
  check("the output tokens are kept", d?.usage.outputTokens === 32_000);
  // The Anthropic canaries lost 2 paid requests to reasoning eating the budget.
  // On this provider the same fingerprint has a field, and it is captured.
  check("reasoning tokens are captured", d?.usage.thoughtsTokens === 31_000);
  check("part kinds are recorded", d?.parts?.[0]?.type === "thought");
  check("the message names the finish reason", !result.ok && result.message.includes("MAX_TOKENS"));
  check("and the reasoning size", !result.ok && result.message.includes("31000"));

  const serialised = JSON.stringify(d);
  check("reasoning text is NOT persisted", !serialised.includes("SECRET-GEMINI-CANARY"));
  check("the key is NOT persisted", !serialised.includes(FAKE_KEY) && !serialised.includes("AIza"));
  check("the prompt is not echoed back", !serialised.includes("Build a setlist tool"));
}

/* ── 3. a blocked prompt is not an empty one ─────────────────────────────── */

{
  const transport = new GoogleGeminiTransport(DEFAULT_GEMINI_MODEL, fetchReturning(200, {
    promptFeedback: { blockReason: "SAFETY" },
    candidates: [],
  }));
  const result = await transport.send(request(), new AbortController().signal);
  check("a blocked prompt is reported as blocked", !result.ok && result.code === "blocked");
  check("with the reason", !result.ok && result.message.includes("SAFETY"));
}

/* ── 4. http failures ────────────────────────────────────────────────────── */

for (const [status, code] of [[429, "rate_limited"], [500, "server_error"], [503, "server_error"], [400, "client_error"], [403, "client_error"]] as const) {
  const transport = new GoogleGeminiTransport(DEFAULT_GEMINI_MODEL,
    fetchReturning(status, `{"error":{"message":"upstream said no for key=${FAKE_KEY}"}}`));
  const result = await transport.send(request(), new AbortController().signal);
  check(`${status} maps to ${code}`, !result.ok && result.code === code, !result.ok ? result.code : "");
  check(`${status} keeps its status`, !result.ok && result.status === status);
  const serialised = JSON.stringify(!result.ok ? result.diagnostics : {});
  check(`${status} redacts the key out of the provider error`,
    !serialised.includes(FAKE_KEY) && serialised.includes("[redacted]"));
  check(`${status} never puts the key in the user-facing message`,
    !result.ok && !result.message.includes(FAKE_KEY));
}

/* ── 5. both timeouts ────────────────────────────────────────────────────── */

{
  const outer = new AbortController();
  const startedAt = Date.now();
  const transport = new GoogleGeminiTransport(DEFAULT_GEMINI_MODEL, fetchReturning(200, {}, { hang: true }));
  const result = await transport.send(request({ timeoutMs: 120 }), outer.signal);
  check("a request past its budget times out", !result.ok && result.code === "timeout");
  check("naming the per-request budget", !result.ok && result.message.includes("120 ms"));
  check("at the budget, not the deadline", Date.now() - startedAt < 3_000);
  check("without aborting the outer signal", !outer.signal.aborted);
}

{
  const outer = new AbortController();
  setTimeout(() => outer.abort(), 100);
  const transport = new GoogleGeminiTransport(DEFAULT_GEMINI_MODEL, fetchReturning(200, {}, { hang: true }));
  const result = await transport.send(request({ timeoutMs: 60_000 }), outer.signal);
  check("the pipeline deadline still ends a run", !result.ok && result.code === "timeout");
  check("and is named as the cause", !result.ok && /pipeline deadline/i.test(result.message));
}

{
  const transport = new GoogleGeminiTransport(DEFAULT_GEMINI_MODEL, fetchReturning(200, { candidates: [] }));
  const result = await transport.send(request(), new AbortController().signal);
  const d = (!result.ok ? result.diagnostics : undefined) as GeminiEmptyDiagnostics | undefined;
  check("a request with no timeout uses the documented default",
    d?.timeoutMs === GENERATION_LIMITS.requestTimeoutMs, String(d?.timeoutMs));
}

/* ── 6. an unconfigured server fails before it spends anything ───────────── */

{
  const saved = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  calls.length = 0;
  const transport = new GoogleGeminiTransport(DEFAULT_GEMINI_MODEL, fetchReturning(200, GOOD));
  const result = await transport.send(request(), new AbortController().signal);
  check("an unconfigured server refuses", !result.ok && result.code === "client_error");
  check("without making a request", calls.length === 0);
  check("and says so safely", !result.ok && result.message === "Gemini is not configured on this server.");
  process.env.GEMINI_API_KEY = saved;
}

/* ── 7. app-runtime resolves only to Gemini ──────────────────────────────── */

/**
 * Walks the import graph from an entry file, following local imports only.
 *
 * A grep over one directory would pass while a module three hops away pulled
 * the Anthropic SDK in. The property that matters is reachability, so
 * reachability is what is computed.
 */
const SRC = resolve(new URL("../../src", import.meta.url).pathname);

function importGraph(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [resolve(entry)];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    const source = readFileSync(file, "utf8");
    const specifiers = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    for (const specifier of specifiers) {
      let target: string | null = null;
      if (specifier.startsWith(".")) target = resolve(dirname(file), specifier);
      else if (specifier.startsWith("@/")) target = join(SRC, specifier.slice(2));
      if (!target) continue;
      for (const candidate of [`${target}.ts`, `${target}.tsx`, join(target, "index.ts")]) {
        if (existsSync(candidate)) { queue.push(candidate); break; }
      }
    }
  }
  return seen;
}

const APP_ENTRIES = [
  join(SRC, "lib/v2/app/provider.ts"),
  join(SRC, "lib/v2/app/generate.ts"),
  join(SRC, "lib/v2/app/pipeline.ts"),
];

const reachable = new Set<string>();
for (const entry of APP_ENTRIES) for (const file of importGraph(entry)) reachable.add(file);

check("the app-runtime graph is non-trivial", reachable.size >= 8, String(reachable.size));

const offenders: string[] = [];
for (const file of reachable) {
  const source = readFileSync(file, "utf8");
  if (/@anthropic-ai\/sdk|AnthropicCodegenTransport|anthropicTransport/.test(source)) {
    offenders.push(file.replace(SRC, "src"));
  }
}
check("NOTHING reachable from app-runtime imports Anthropic", offenders.length === 0, offenders.join(", "));

check("the Gemini transport IS reachable",
  [...reachable].some((f) => f.endsWith("gemini/googleTransport.ts")));
check("and the Gemini config with it",
  [...reachable].some((f) => f.endsWith("gemini/config.ts")));

// The provider file must be the only place the choice is made.
const providerSource = readFileSync(join(SRC, "lib/v2/app/provider.ts"), "utf8");
check("the provider constructs the Gemini transport", /new GoogleGeminiTransport\(/.test(providerSource));
check("and no other transport", !/new \w*(Anthropic|OpenAI)\w*Transport\(/.test(providerSource));

// The app modules must not name a provider at all: the boundary is one file.
for (const file of reachable) {
  if (!file.includes("/lib/v2/app/")) continue;
  if (file.endsWith("app/provider.ts")) continue;
  const source = readFileSync(file, "utf8");
  check(`${file.split("/app/")[1]} names no provider`,
    !/GoogleGeminiTransport|AnthropicCodegenTransport/.test(source));
}

/* the key must not be reachable as a value from anything but the transport */
const providerExports = providerSource;
check("the provider never reads the key", !/apiKey/.test(providerExports.replace(/\*[\s\S]*?\*\//g, "")));
check("and never returns one", !/GEMINI_API_KEY/.test(providerExports));

/* ── report ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`FAILED ${failures.length} of ${passed + failures.length}`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`gemini transport: ${passed} checks passed`);
