import "server-only";

import Anthropic from "@anthropic-ai/sdk";
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
export class AnthropicCodegenTransport implements GeminiTransport {
  constructor(private readonly model: string = "claude-sonnet-5") {}

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

    try {
      const client = new Anthropic();
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
      const response = await client.messages
        .stream(
          {
            model: this.model,
            max_tokens: request.maxOutputTokens,
            system: request.system,
            messages: [{ role: "user", content: request.user }],
          },
          { signal },
        )
        .finalMessage();

      const text = response.content
        .filter((block): block is Extract<typeof block, { type: "text" }> => block.type === "text")
        .map((block) => block.text)
        .join("");

      if (!text.trim()) {
        return { ok: false, code: "empty", message: "The provider returned no text.", latencyMs: latency() };
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
      const aborted = signal.aborted
        || (cause instanceof Error && (cause.name === "AbortError" || cause.name === "TimeoutError"));

      if (aborted) {
        return { ok: false, code: "timeout", message: "The request timed out.", latencyMs: latency() };
      }
      if (status === 429) {
        return { ok: false, code: "rate_limited", message: "The provider is rate limiting.", status, latencyMs: latency() };
      }
      if (status && status >= 500) {
        return { ok: false, code: "server_error", message: "The provider is unavailable.", status, latencyMs: latency() };
      }
      if (status && status >= 400) {
        return { ok: false, code: "client_error", message: "The request was refused.", status, latencyMs: latency() };
      }
      return { ok: false, code: "transport_error", message: "The request did not complete.", latencyMs: latency() };
    }
  }
}
