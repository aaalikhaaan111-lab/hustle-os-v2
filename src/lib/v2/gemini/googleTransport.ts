import "server-only";

/**
 * The Gemini transport: the network implementation the seam was built for.
 *
 * `GeminiTransport`, `BudgetedTransport`, `sanitiseTransportError` and the
 * pinned-model config have all been here since the prototype — everything
 * except the code that actually talks to Google. The only concrete
 * implementation of the interface was the Anthropic one, so "the Gemini
 * pipeline" was a seam with no adapter behind it. This is that adapter, and
 * nothing else changes: the same interface, the same budgets, the same
 * request and response types, the same repair loop above it.
 *
 * NO SDK. The REST endpoint is one POST with a JSON body, and adding a
 * provider SDK to send it would be a larger change than the adapter itself —
 * a new dependency in the build, a second client to keep current, and another
 * place for a key to be read from the environment. `fetch` is in the runtime.
 *
 * THE KEY TRAVELS IN A HEADER, never in the URL. This API accepts `?key=`,
 * which is why `sanitiseTransportError` exists to scrub URLs out of provider
 * errors. A key that was never in a URL cannot leak through one, so the whole
 * class of failure is removed rather than filtered. It is read from
 * `resolveGeminiConfig` inside `send`, held in a local, and never logged,
 * serialised, returned or attached to a diagnostic.
 */

import { GENERATION_LIMITS } from "./config";
import { resolveGeminiConfig } from "./config";
import type { GeminiRequest, GeminiResponse, GeminiTransport } from "./transport";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/** Only the fields this adapter reads. Everything else is ignored, not typed. */
interface GeminiApiResponse {
  candidates?: Array<{
    content?: { parts?: Array<Record<string, unknown>> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
    thoughtsTokenCount?: number;
    cachedContentTokenCount?: number;
  };
  modelVersion?: string;
}

/** Injected only by tests; production always uses the runtime's own fetch. */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/**
 * What a Gemini response that produced no usable text is allowed to tell us.
 *
 * The same discipline as the Anthropic diagnostics, for the same reason: a
 * paid request that cannot say what happened to it has to be bought twice.
 * Scalars, enums and type names only — never part text, never the prompt,
 * never anything derived from the key.
 *
 * `thoughtsTokenCount` is carried deliberately. Two paid Anthropic canaries
 * were lost to reasoning silently consuming the entire output budget, and this
 * field is the same failure's fingerprint on this provider. Reported, not
 * pre-empted: the request is unchanged and the evidence is free.
 */
export type GeminiEmptyDiagnostics = {
  finishReason?: string;
  blockReason?: string;
  modelVersion?: string;
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    thoughtsTokens?: number;
    cachedTokens?: number;
  };
  /** One entry per response part: its kind and how many characters it held. */
  parts: Array<{ type: string; chars: number }>;
  candidates: number;
  elapsedMs: number;
  timeoutMs: number;
  /** Sanitised provider error, when the failure came from a response body. */
  error?: string;
  httpStatus?: number;
};

/** Redacts anything key-shaped before a provider string reaches a disk. */
function redact(text: string): string {
  return text
    .replace(/\bAIza[0-9A-Za-z_-]{10,}/g, "[redacted]")
    .replace(/[?&]key=[^&\s"']*/gi, "?key=[redacted]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

/** A part's size, without its contents. */
function partKind(part: Record<string, unknown>): { type: string; chars: number } {
  // Reasoning first: a thought part carries text too, and calling it "text"
  // here would disagree with the extraction below, which excludes it. The
  // size is kept — that is the evidence — and the contents never are.
  if (part.thought === true) {
    return { type: "thought", chars: typeof part.text === "string" ? part.text.length : 0 };
  }
  if (typeof part.text === "string") return { type: "text", chars: part.text.length };
  if (part.inlineData) return { type: "inlineData", chars: 0 };
  if (part.functionCall) return { type: "functionCall", chars: 0 };
  return { type: Object.keys(part)[0] ?? "unknown", chars: 0 };
}

export class GoogleGeminiTransport implements GeminiTransport {
  constructor(
    private readonly model: string,
    private readonly fetchImpl: FetchLike = ((url, init) => fetch(url, init)) as FetchLike,
  ) {}

  async send(request: GeminiRequest, signal: AbortSignal): Promise<GeminiResponse> {
    const startedAt = Date.now();
    const latency = () => Date.now() - startedAt;

    const config = resolveGeminiConfig();
    if (!config.ok) {
      // `message` is written to be safe to show verbatim and contains no key.
      return { ok: false, code: "client_error", message: config.message, latencyMs: latency() };
    }

    /**
     * Two limits, as on the other transport: the per-request budget the
     * pipeline hands down, inside the pipeline's own deadline. The timer is
     * owned and cleared rather than `AbortSignal.timeout`, whose timer is
     * unref'd — with nothing else pending the event loop drains and the await
     * never settles.
     */
    const timeoutMs = request.timeoutMs ?? GENERATION_LIMITS.requestTimeoutMs;
    const perRequest = new AbortController();
    const timer = setTimeout(() => perRequest.abort(), timeoutMs);
    const effective = AbortSignal.any([signal, perRequest.signal]);

    const body = {
      systemInstruction: { parts: [{ text: request.system }] },
      contents: [{ role: "user", parts: [{ text: request.user }] }],
      generationConfig: {
        maxOutputTokens: request.maxOutputTokens,
        // The pipeline is a JSON pipeline: asking for JSON by MIME type is what
        // this request has always documented itself as doing, and the local
        // chain — envelope, validator, compiler — remains the authority.
        responseMimeType: "application/json",
        ...(request.responseJsonSchema ? { responseSchema: request.responseJsonSchema } : {}),
      },
    };

    try {
      const response = await this.fetchImpl(
        `${ENDPOINT}/${encodeURIComponent(this.model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            // Header, never a query parameter. See the note at the top.
            "x-goog-api-key": config.apiKey,
          },
          body: JSON.stringify(body),
          signal: effective,
        },
      );

      if (!response.ok) {
        const detail = redact(await response.text().catch(() => ""));
        const diagnostics: GeminiEmptyDiagnostics = {
          usage: {}, parts: [], candidates: 0,
          elapsedMs: latency(), timeoutMs, error: detail, httpStatus: response.status,
        };
        if (response.status === 429) {
          return { ok: false, code: "rate_limited", message: "Gemini rate limit reached.", status: 429, latencyMs: latency(), diagnostics };
        }
        if (response.status >= 500) {
          return { ok: false, code: "server_error", message: `Gemini is unavailable (${response.status}).`, status: response.status, latencyMs: latency(), diagnostics };
        }
        return { ok: false, code: "client_error", message: `Gemini refused the request (${response.status}).`, status: response.status, latencyMs: latency(), diagnostics };
      }

      const payload = (await response.json()) as GeminiApiResponse;
      const candidate = payload?.candidates?.[0];
      const parts: Array<Record<string, unknown>> = candidate?.content?.parts ?? [];
      const usage = payload?.usageMetadata ?? {};

      const diagnostics: GeminiEmptyDiagnostics = {
        finishReason: candidate?.finishReason,
        blockReason: payload?.promptFeedback?.blockReason,
        modelVersion: payload?.modelVersion,
        usage: {
          inputTokens: usage.promptTokenCount,
          outputTokens: usage.candidatesTokenCount,
          totalTokens: usage.totalTokenCount,
          thoughtsTokens: usage.thoughtsTokenCount,
          cachedTokens: usage.cachedContentTokenCount,
        },
        parts: parts.map(partKind),
        candidates: payload?.candidates?.length ?? 0,
        elapsedMs: latency(),
        timeoutMs,
      };

      // A prompt refused before generation is a distinct outcome from a run
      // that produced nothing: one is about the request, the other about the
      // budget, and only the second is worth a repair.
      if (payload?.promptFeedback?.blockReason) {
        return {
          ok: false,
          code: "blocked",
          message: `Gemini blocked the prompt (${payload.promptFeedback.blockReason}).`,
          latencyMs: latency(),
          diagnostics,
        };
      }

      /**
       * A response that ran out of output budget is not a successful one.
       *
       * THE DEFECT THIS FIXES. A live canary asked for a project-management
       * app, the model wrote 30,436 tokens against a 32,000 budget and was cut
       * off mid-string, and this transport returned `ok: true` with the
       * truncated body. The pipeline then reported "the model's response was
       * not valid JSON" — true, and useless: the model wrote valid JSON and we
       * stopped it halfway. The operator needed to know the budget was too
       * small, and was told the model was at fault.
       *
       * Reported before the text is looked at, because a truncated body is
       * usually non-empty and would otherwise sail through as a success.
       */
      if (candidate?.finishReason === "MAX_TOKENS") {
        return {
          ok: false,
          code: "too_large",
          message:
            `Gemini stopped at the ${request.maxOutputTokens}-token output limit ` +
            `(${usage.candidatesTokenCount ?? "?"} used). The response is truncated, not malformed.`,
          latencyMs: latency(),
          diagnostics,
        };
      }

      const text = parts
        .filter((part) => typeof part.text === "string" && part.thought !== true)
        .map((part) => part.text as string)
        .join("");

      if (!text.trim()) {
        return {
          ok: false,
          code: "empty",
          message:
            `Gemini returned no text (finish_reason=${candidate?.finishReason ?? "none"}, ` +
            `output=${usage.candidatesTokenCount ?? "?"} tokens` +
            `${usage.thoughtsTokenCount ? `, thoughts=${usage.thoughtsTokenCount}` : ""}, ` +
            `${diagnostics.parts.length} part(s)).`,
          latencyMs: latency(),
          diagnostics,
        };
      }

      return {
        ok: true,
        text,
        modelVersion: payload?.modelVersion,
        usage: {
          promptTokenCount: usage.promptTokenCount,
          candidatesTokenCount: usage.candidatesTokenCount,
          totalTokenCount: usage.totalTokenCount,
        },
        latencyMs: latency(),
      };
    } catch (cause) {
      const diagnostics: GeminiEmptyDiagnostics = {
        usage: {}, parts: [], candidates: 0, elapsedMs: latency(), timeoutMs,
        error: cause instanceof Error ? redact(cause.message) : undefined,
      };
      // Which limit fired is the difference between "too slow for this stage"
      // and "the whole pipeline ran out", and they have different fixes.
      if (signal.aborted) {
        return { ok: false, code: "timeout", message: "The pipeline deadline elapsed.", latencyMs: latency(), diagnostics };
      }
      if (perRequest.signal.aborted) {
        return { ok: false, code: "timeout", message: `The request exceeded its ${timeoutMs} ms budget.`, latencyMs: latency(), diagnostics };
      }
      return { ok: false, code: "transport_error", message: "The Gemini request failed.", latencyMs: latency(), diagnostics };
    } finally {
      clearTimeout(timer);
    }
  }
}
