import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { GENERATION_LIMITS } from "@/lib/v2/gemini/config";
import type { GeminiRequest, GeminiResponse, GeminiTransport } from "@/lib/v2/gemini/transport";

/**
 * The codegen transport, on the provider the product already uses.
 *
 * The prototype was written against Gemini and kept every network detail behind
 * the `GeminiTransport` seam, so moving providers is an implementation of that
 * interface rather than a rewrite. That matters for productionising it: the
 * rest of Ventrio generates through Anthropic with one key, one quota ledger
 * and one set of job accounting, and a second provider SDK would have meant a
 * second key to hold, a second failure mode to explain and a second bill.
 *
 * The interface name still says Gemini. Renaming it would touch the prototype's
 * whole test surface for no behavioural gain, and the seam is what matters, not
 * what it is called — worth doing later, not as part of a provider swap.
 *
 * No request is made anywhere in this module's construction: the client is only
 * built when `send` is called, so importing this file costs nothing and a
 * missing key fails as a sanitised transport error rather than a throw at
 * module load.
 */

/* ── the shape this transport actually needs from the SDK ────────────────── */

/**
 * Structurally typed rather than taken from the SDK, so a test can supply a
 * stream that never resolves or a message with no text without a network, a key
 * or a mock library. Only the fields this file reads are named.
 */
export interface FinalMessageLike {
  id?: string;
  model?: string;
  stop_reason?: string | null;
  stop_sequence?: string | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
  } | null;
  content?: ReadonlyArray<Record<string, unknown>>;
}

export interface MessageStreamLike {
  on(event: "streamEvent", listener: (event: { type?: string }) => void): unknown;
  finalMessage(): Promise<FinalMessageLike>;
}

export interface AnthropicClientLike {
  messages: {
    stream(params: Record<string, unknown>, options: { signal: AbortSignal }): MessageStreamLike;
  };
}

/* ── what a response with no text is allowed to tell us ──────────────────── */

/**
 * Everything knowable about a response that carried no text, and nothing else.
 *
 * The first paid app canary spent a request, streamed for 283.8 s, returned a
 * message with zero text blocks, and left no evidence of why: this file
 * returned on the `!text.trim()` branch without keeping the response. A paid
 * request that cannot say what happened to it has to be paid for twice.
 *
 * WHAT IS DELIBERATELY ABSENT. Reasoning contents, message text, request
 * headers, the key, and the environment. Thinking is counted and measured but
 * never stored: the size answers "did reasoning consume the output budget",
 * which is the question, and the contents answer nothing this file needs to
 * ask. Everything here is a scalar, an enum or a type name, so the whole record
 * is safe to write to disk and safe to put in a log.
 */
export type EmptyResponseDiagnostics = {
  messageId?: string;
  model?: string;
  stopReason?: string | null;
  stopSequence?: string | null;
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
  };
  /** One entry per content block: its type and how many characters it held. */
  blocks: Array<{ type: string; chars: number }>;
  /** How many of each stream event type arrived, for the shape of the run. */
  events: Record<string, number>;
  /** Present, how many, how large — never what. */
  thinking: { present: boolean; blocks: number; chars: number };
  elapsedMs: number;
  /** The per-request budget in force, so a near-miss is visible as one. */
  timeoutMs: number;
  /** Sanitised, when the failure came from a thrown error rather than a message. */
  error?: string;
};

/** The character count a block carries, without carrying the characters. */
function blockChars(block: Record<string, unknown>): number {
  for (const field of ["text", "thinking", "data"]) {
    const value = block[field];
    if (typeof value === "string") return value.length;
  }
  const input = block.input;
  if (input !== undefined) {
    try { return JSON.stringify(input).length; } catch { return 0; }
  }
  return 0;
}

/**
 * Summarises a message that produced no usable text.
 *
 * Pure and exported so the sanitisation can be asserted directly rather than
 * inferred from a transport that would need a network to exercise.
 */
export function summariseEmptyResponse(
  message: FinalMessageLike,
  context: { events: Record<string, number>; elapsedMs: number; timeoutMs: number; error?: string },
): EmptyResponseDiagnostics {
  const content = message.content ?? [];
  const blocks = content.map((block) => ({
    type: typeof block.type === "string" ? block.type : "unknown",
    chars: blockChars(block),
  }));
  const thinkingBlocks = blocks.filter((b) => b.type === "thinking" || b.type === "redacted_thinking");

  return {
    messageId: message.id,
    model: message.model,
    stopReason: message.stop_reason ?? null,
    stopSequence: message.stop_sequence ?? null,
    usage: {
      inputTokens: message.usage?.input_tokens,
      outputTokens: message.usage?.output_tokens,
      cacheReadTokens: message.usage?.cache_read_input_tokens ?? undefined,
      cacheWriteTokens: message.usage?.cache_creation_input_tokens ?? undefined,
    },
    blocks,
    events: { ...context.events },
    thinking: {
      present: thinkingBlocks.length > 0,
      blocks: thinkingBlocks.length,
      chars: thinkingBlocks.reduce((total, b) => total + b.chars, 0),
    },
    elapsedMs: context.elapsedMs,
    timeoutMs: context.timeoutMs,
    ...(context.error ? { error: context.error } : {}),
  };
}

/** The one-line version, for a message a human reads first. */
export function describeEmptyResponse(diagnostics: EmptyResponseDiagnostics): string {
  const shape = diagnostics.blocks.length > 0
    ? diagnostics.blocks.map((b) => `${b.type}×${b.chars}c`).join(", ")
    : "no content blocks";
  return `The provider returned no text (stop_reason=${diagnostics.stopReason ?? "none"}, ` +
    `output=${diagnostics.usage.outputTokens ?? "?"} tokens, ${shape}).`;
}

/**
 * Anything a thrown provider error is allowed to contribute.
 *
 * The SDK's errors can echo request context, so this takes the message field
 * only — never `String(error)`, never headers, never the request — and redacts
 * anything key-shaped out of it before it reaches a disk or a screen.
 */
function safeErrorText(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const message = (error as { message?: unknown }).message;
  if (typeof message !== "string" || message.length === 0) return undefined;
  return message
    .replace(/\bsk-[A-Za-z0-9_-]{8,}/g, "[redacted]")
    .replace(/[?&]key=[^&\s"']*/gi, "?key=[redacted]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

export class AnthropicCodegenTransport implements GeminiTransport {
  constructor(
    private readonly model: string = "claude-sonnet-5",
    /**
     * How the client is built. Defaults to the real SDK.
     *
     * The seam exists so the timeout behaviour and the empty-response path can
     * be proved deterministically. It is not a general injection point: the
     * default is the only thing production ever passes.
     */
    private readonly clientFactory: () => AnthropicClientLike = () => new Anthropic() as unknown as AnthropicClientLike,
    /**
     * Per-caller request options. Empty by default, which is the request this
     * transport has always sent.
     *
     * `thinking: "disabled"` exists for exactly one measured reason. Two paid
     * app canaries on the same prompt returned `stop_reason: max_tokens` with
     * all 32,000 output tokens spent, one content block of type `thinking`, and
     * no text block ever started — reasoning consumed the entire budget before
     * a single character of the project was written. Codegen has never shown
     * this, so nothing here changes for it: the option is opt-in and the
     * default request is byte-for-byte what it was.
     */
    private readonly options: { thinking?: "disabled" } = {},
  ) {}

  async send(request: GeminiRequest, signal: AbortSignal): Promise<GeminiResponse> {
    const startedAt = Date.now();
    const latency = () => Date.now() - startedAt;

    if (!process.env.ANTHROPIC_API_KEY) {
      return {
        ok: false,
        code: "client_error",
        message: "No provider key is configured.",
        latencyMs: latency(),
      };
    }

    /**
     * Two limits, and the inner one was missing.
     *
     * `request.timeoutMs` documents itself as the per-request budget and this
     * transport ignored it entirely, so a single call could occupy the whole
     * pipeline deadline and leave a repair no room — the exact failure the
     * stage budgets were introduced to prevent. The pipeline's signal stays as
     * the outer limit; neither replaces the other, and the two are told apart
     * on the way out so the failure names which one fired.
     */
    const timeoutMs = request.timeoutMs ?? GENERATION_LIMITS.requestTimeoutMs;
    /**
     * An owned timer rather than `AbortSignal.timeout`, whose timer is unref'd:
     * with nothing else pending the event loop drains and the await never
     * settles. Cleared in `finally`, so a fast response leaves nothing behind.
     */
    const perRequest = new AbortController();
    const timer = setTimeout(() => perRequest.abort(), timeoutMs);
    const effective = AbortSignal.any([signal, perRequest.signal]);

    /** Counted as they arrive; kept even if the run ends in a throw. */
    const events: Record<string, number> = {};

    try {
      const client = this.clientFactory();
      /**
       * Streamed, because a bundle request is not a small one.
       *
       * The codegen budget is 32k output tokens, and the SDK refuses a
       * non-streaming request whose `max_tokens` implies it could run past ten
       * minutes — it throws synchronously, before any network call. The first
       * canary found this the only way it could be found: three runs, three
       * failures, 0 ms latency each, no request ever reaching the provider.
       *
       * `finalMessage()` reassembles the stream into the same shape the
       * non-streaming call returned, so nothing downstream changes. The stream
       * is not surfaced to callers: there is no partial-bundle rendering to do,
       * because a bundle is only meaningful once the gate has accepted all of
       * it.
       */
      const stream = client.messages.stream(
        {
          model: this.model,
          max_tokens: request.maxOutputTokens,
          system: request.system,
          messages: [{ role: "user", content: request.user }],
          // Absent unless a caller asked for it, so the default request is
          // unchanged. See the constructor for what asked and why.
          ...(this.options.thinking === "disabled" ? { thinking: { type: "disabled" as const } } : {}),
        },
        { signal: effective },
      );

      // Event types only — never the deltas, which are the response itself.
      stream.on("streamEvent", (event) => {
        const type = typeof event?.type === "string" ? event.type : "unknown";
        events[type] = (events[type] ?? 0) + 1;
      });

      const response = await stream.finalMessage();

      const text = (response.content ?? [])
        .filter((block): block is Record<string, unknown> & { type: "text"; text: string } =>
          block.type === "text" && typeof block.text === "string")
        .map((block) => block.text)
        .join("");

      if (!text.trim()) {
        const diagnostics = summariseEmptyResponse(response, { events, elapsedMs: latency(), timeoutMs });
        return {
          ok: false,
          code: "empty",
          message: describeEmptyResponse(diagnostics),
          latencyMs: latency(),
          diagnostics,
        };
      }

      return {
        ok: true,
        text,
        modelVersion: response.model,
        usage: {
          promptTokenCount: response.usage?.input_tokens,
          candidatesTokenCount: response.usage?.output_tokens,
          totalTokenCount:
            (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
        },
        latencyMs: latency(),
      };
    } catch (cause) {
      // Sanitised on the way out. A provider error can carry request context,
      // and this string reaches a surface a user may see.
      const status = typeof cause === "object" && cause !== null && "status" in cause
        ? Number((cause as { status?: unknown }).status)
        : undefined;
      const error = safeErrorText(cause);
      // The same envelope as the empty path, minus a message there never was.
      const diagnostics = summariseEmptyResponse({}, { events, elapsedMs: latency(), timeoutMs, error });

      // Which limit fired is the difference between "the model is too slow for
      // this stage" and "the whole pipeline ran out", and they have different
      // fixes. The outer signal is checked first: if both aborted, the pipeline
      // deadline is the one that ends the run.
      if (signal.aborted) {
        return { ok: false, code: "timeout", message: "The pipeline deadline elapsed.", latencyMs: latency(), diagnostics };
      }
      if (perRequest.signal.aborted) {
        return {
          ok: false,
          code: "timeout",
          message: `The request exceeded its ${timeoutMs} ms budget.`,
          latencyMs: latency(),
          diagnostics,
        };
      }
      if (cause instanceof Error && (cause.name === "AbortError" || cause.name === "TimeoutError")) {
        return { ok: false, code: "timeout", message: "The request timed out.", latencyMs: latency(), diagnostics };
      }
      if (status === 429) {
        return { ok: false, code: "rate_limited", message: "The provider is rate limiting.", status, latencyMs: latency(), diagnostics };
      }
      if (status && status >= 500) {
        return { ok: false, code: "server_error", message: "The provider is unavailable.", status, latencyMs: latency(), diagnostics };
      }
      if (status && status >= 400) {
        return { ok: false, code: "client_error", message: "The request was refused.", status, latencyMs: latency(), diagnostics };
      }
      return { ok: false, code: "transport_error", message: "The request did not complete.", latencyMs: latency(), diagnostics };
    } finally {
      clearTimeout(timer);
    }
  }
}
