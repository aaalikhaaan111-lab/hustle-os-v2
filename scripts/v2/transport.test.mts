/**
 * The Anthropic transport: two timeouts, and evidence when nothing comes back.
 *
 *   npx tsx --conditions=react-server scripts/v2/transport.test.mts
 *
 * Offline and deterministic. The client is injected, so a stream that never
 * resolves, a message made entirely of reasoning, and a throwing provider are
 * all ordinary local objects — no network, no key, no recorded fixtures.
 *
 * WHAT THIS EXISTS TO PREVENT. The first paid app canary streamed for 283.8 s,
 * returned a message with no text blocks, and left nothing behind: the
 * transport returned on `!text.trim()` without keeping the response, so the
 * question "did reasoning eat the output budget?" could not be answered
 * without paying again. Everything below is either that evidence, or proof
 * that collecting it does not leak what must not be written down.
 */

import {
  AnthropicCodegenTransport,
  summariseEmptyResponse,
  describeEmptyResponse,
  type AnthropicClientLike,
  type EmptyResponseDiagnostics,
  type FinalMessageLike,
} from "../../src/lib/v2/codegen/anthropicTransport";
import { GENERATION_LIMITS } from "../../src/lib/v2/gemini/config";
import type { GeminiRequest } from "../../src/lib/v2/gemini/transport";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

// The transport refuses before it builds a client when this is absent, so the
// tests set an obviously fake one. It is also the string every sanitisation
// check below searches for.
const FAKE_KEY = "sk-ant-testkey-000000000000000000000000000000000000";
process.env.ANTHROPIC_API_KEY = FAKE_KEY;

/** The secret this suite proves never reaches disk. */
const SECRET_REASONING =
  "Let me carefully consider the user's private business plan before answering. " +
  "TOP-SECRET-REASONING-CANARY-STRING";

const request = (over: Partial<GeminiRequest> = {}): GeminiRequest => ({
  model: "claude-sonnet-5",
  system: "You write applications.",
  user: "Build a setlist tool.",
  maxOutputTokens: 32_000,
  label: "artifact",
  ...over,
});

function client(behaviour: {
  message?: FinalMessageLike;
  throws?: unknown;
  hang?: boolean;
  events?: Array<{ type: string }>;
}): AnthropicClientLike {
  return {
    messages: {
      stream(_params, options) {
        const listeners: Array<(event: { type?: string }) => void> = [];
        return {
          on(_event, listener) { listeners.push(listener); return this; },
          finalMessage() {
            for (const event of behaviour.events ?? []) {
              for (const listener of listeners) listener(event);
            }
            if (behaviour.hang) {
              return new Promise<FinalMessageLike>((_, reject) => {
                const abort = () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
                if (options.signal.aborted) abort();
                else options.signal.addEventListener("abort", abort, { once: true });
              });
            }
            if (behaviour.throws) return Promise.reject(behaviour.throws);
            return Promise.resolve(behaviour.message ?? {});
          },
        };
      },
    },
  };
}

/* ── 1. a message made entirely of reasoning ─────────────────────────────── */

const THINKING_ONLY: FinalMessageLike = {
  id: "msg_01CanaryEmpty",
  model: "claude-sonnet-5-20260101",
  stop_reason: "max_tokens",
  stop_sequence: null,
  usage: {
    input_tokens: 1_204,
    output_tokens: 32_000,
    cache_read_input_tokens: 900,
    cache_creation_input_tokens: 120,
  },
  content: [{ type: "thinking", thinking: SECRET_REASONING, signature: "sig" }],
};

{
  const transport = new AnthropicCodegenTransport("claude-sonnet-5", () =>
    client({
      message: THINKING_ONLY,
      events: [
        { type: "message_start" },
        { type: "content_block_start" },
        { type: "content_block_delta" },
        { type: "content_block_delta" },
        { type: "message_delta" },
      ],
    }));
  const result = await transport.send(request({ timeoutMs: 5_000 }), new AbortController().signal);

  check("a text-free response fails", !result.ok);
  check("as empty, not as a transport error", !result.ok && result.code === "empty");

  const d = (!result.ok ? result.diagnostics : undefined) as EmptyResponseDiagnostics | undefined;
  check("diagnostics are attached", !!d);
  if (d) {
    check("the message id survives", d.messageId === "msg_01CanaryEmpty");
    check("the resolved model survives", d.model === "claude-sonnet-5-20260101");
    check("the stop reason is recorded", d.stopReason === "max_tokens", String(d.stopReason));
    check("the stop sequence is recorded", d.stopSequence === null);
    check("input tokens", d.usage.inputTokens === 1_204);
    check("output tokens", d.usage.outputTokens === 32_000);
    check("cache-read tokens", d.usage.cacheReadTokens === 900);
    check("cache-write tokens", d.usage.cacheWriteTokens === 120);
    check("block types and sizes", d.blocks.length === 1 && d.blocks[0].type === "thinking");
    check("the block's size is its character count", d.blocks[0].chars === SECRET_REASONING.length);
    check("thinking is flagged present", d.thinking.present === true && d.thinking.blocks === 1);
    check("and measured", d.thinking.chars === SECRET_REASONING.length);
    check("stream events are counted by type", d.events.content_block_delta === 2, JSON.stringify(d.events));
    check("every event type is counted", d.events.message_start === 1 && d.events.message_delta === 1);
    check("elapsed is recorded", typeof d.elapsedMs === "number");
    check("the effective timeout is recorded", d.timeoutMs === 5_000, String(d.timeoutMs));

    /* ── the sanitisation, asserted against the whole serialised record ─── */
    const serialised = JSON.stringify(d);
    check("the reasoning contents are NOT persisted", !serialised.includes("TOP-SECRET-REASONING-CANARY-STRING"));
    check("nor any of the reasoning prose", !serialised.includes("private business plan"));
    check("the API key is NOT persisted", !serialised.includes(FAKE_KEY) && !serialised.includes("sk-ant"));
    check("the prompt is not echoed back", !serialised.includes("Build a setlist tool"));
    check("the system prompt is not echoed back", !serialised.includes("You write applications"));
  }

  // The one-line message a human reads first has to carry the finding.
  check("the failure message names the stop reason", !result.ok && result.message.includes("max_tokens"));
  check("and the output token count", !result.ok && result.message.includes("32000"));
  check("and the block shape", !result.ok && result.message.includes("thinking"));
  check("and still leaks nothing", !result.ok && !result.message.includes("TOP-SECRET"));
}

/* ── 2. the per-request timeout ──────────────────────────────────────────── */

{
  const outer = new AbortController();
  const startedAt = Date.now();
  const transport = new AnthropicCodegenTransport("claude-sonnet-5", () => client({ hang: true }));
  const result = await transport.send(request({ timeoutMs: 120 }), outer.signal);
  const elapsed = Date.now() - startedAt;

  check("a request that runs past its budget fails", !result.ok);
  check("as a timeout", !result.ok && result.code === "timeout");
  check("naming the per-request budget", !result.ok && result.message.includes("120 ms"), !result.ok ? result.message : "");
  check("and it fires at the budget, not at the pipeline deadline", elapsed < 3_000, `${elapsed}ms`);
  check("the outer signal was never aborted", !outer.signal.aborted);
  check("diagnostics survive a timeout", !result.ok && !!result.diagnostics);
}

/* ── 3. the pipeline deadline, still the outer limit ─────────────────────── */

{
  const outer = new AbortController();
  setTimeout(() => outer.abort(), 100);
  const transport = new AnthropicCodegenTransport("claude-sonnet-5", () => client({ hang: true }));
  // A per-request budget far larger than the outer deadline: the outer one must
  // still end the run, and must be the one named.
  const result = await transport.send(request({ timeoutMs: 60_000 }), outer.signal);

  check("the pipeline deadline still ends a run", !result.ok && result.code === "timeout");
  check("and is named as the cause", !result.ok && /pipeline deadline/i.test(result.message), !result.ok ? result.message : "");
  check("neither timeout swallows the other", !result.ok && !result.message.includes("60000"));
}

/* ── 4. the default budget ───────────────────────────────────────────────── */

{
  const transport = new AnthropicCodegenTransport("claude-sonnet-5", () => client({ message: THINKING_ONLY }));
  const result = await transport.send(request(), new AbortController().signal);
  const d = (!result.ok ? result.diagnostics : undefined) as EmptyResponseDiagnostics | undefined;
  check("a request with no timeout falls back to the documented default",
    d?.timeoutMs === GENERATION_LIMITS.requestTimeoutMs, String(d?.timeoutMs));
}

/* ── 5. a throwing provider still explains itself ────────────────────────── */

{
  const transport = new AnthropicCodegenTransport("claude-sonnet-5", () =>
    client({ throws: Object.assign(new Error(`503 upstream failed for key=${FAKE_KEY}`), { status: 503 }) }));
  const result = await transport.send(request({ timeoutMs: 5_000 }), new AbortController().signal);

  check("a 5xx is a server error", !result.ok && result.code === "server_error");
  check("with the status kept", !result.ok && result.status === 503);
  const d = (!result.ok ? result.diagnostics : undefined) as EmptyResponseDiagnostics | undefined;
  check("the sanitised provider error is kept", typeof d?.error === "string" && d.error.includes("503"));
  check("with the key redacted out of it", !JSON.stringify(d).includes(FAKE_KEY));
  check("and the user-facing message never carried it", !result.ok && !result.message.includes("sk-ant"));
}

/* ── 6. the success path is unchanged ────────────────────────────────────── */

{
  const transport = new AnthropicCodegenTransport("claude-sonnet-5", () =>
    client({
      message: {
        id: "msg_ok",
        model: "claude-sonnet-5-20260101",
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 20 },
        content: [
          { type: "thinking", thinking: SECRET_REASONING },
          { type: "text", text: '{"schemaVersion":"app-1"}' },
        ],
      },
    }));
  const result = await transport.send(request({ timeoutMs: 5_000 }), new AbortController().signal);

  check("a response with text succeeds", result.ok);
  check("text blocks are joined, reasoning is not", result.ok && result.text === '{"schemaVersion":"app-1"}');
  check("usage is mapped", result.ok && result.usage?.promptTokenCount === 10 && result.usage?.candidatesTokenCount === 20);
  check("the resolved model version is reported", result.ok && result.modelVersion === "claude-sonnet-5-20260101");
  check("no diagnostics on success", result.ok && !("diagnostics" in result));
}

/* ── 7. the summariser itself, on the shapes that are not the happy one ──── */

{
  const empty = summariseEmptyResponse({}, { events: {}, elapsedMs: 5, timeoutMs: 100 });
  check("a message with no content at all is summarisable", empty.blocks.length === 0);
  check("and says so in one line", describeEmptyResponse(empty).includes("no content blocks"));
  check("thinking is absent, not unknown", empty.thinking.present === false && empty.thinking.chars === 0);

  const redacted = summariseEmptyResponse(
    { content: [{ type: "redacted_thinking", data: "AAAA-encrypted-reasoning-AAAA" }] },
    { events: {}, elapsedMs: 1, timeoutMs: 1 },
  );
  check("redacted reasoning counts as thinking", redacted.thinking.present && redacted.thinking.blocks === 1);
  check("and its payload is measured, not stored",
    redacted.thinking.chars === 29 && !JSON.stringify(redacted).includes("encrypted-reasoning"));

  const tool = summariseEmptyResponse(
    { content: [{ type: "tool_use", input: { path: "/etc/passwd" } }] },
    { events: {}, elapsedMs: 1, timeoutMs: 1 },
  );
  check("a non-text block is typed and sized", tool.blocks[0].type === "tool_use" && tool.blocks[0].chars > 0);
  check("without its input being persisted", !JSON.stringify(tool).includes("passwd"));
}

/* ── report ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`FAILED ${failures.length} of ${passed + failures.length}`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`transport: ${passed} checks passed`);
