/**
 * The seam between the pipeline and Gemini.
 *
 * Every network detail lives behind `GeminiTransport` so the deterministic
 * tests can drive the whole pipeline — including timeouts, safety blocks and
 * 5xx sanitisation — without a key, a network, or a cent of spend. The real
 * transport is the only file that imports the SDK.
 *
 * This module is deliberately free of `server-only` so the tests can import the
 * interface and the fake; the *real* transport pulls in config.ts, which is
 * server-only, so the enforcement still lands where the key is.
 */

import { GENERATION_LIMITS } from "./config";

export interface GeminiRequest {
  model: string;
  system: string;
  user: string;
  /**
   * Omitted entirely for stage B and its repair.
   *
   * The provider refuses this pipeline's stage-B schema at every size and shape
   * we could construct — 238 B through 211 KB, flat and recursive alike — while
   * accepting the small stage-A brief schema. So stage B asks for JSON by MIME
   * type and lets the local chain be the authority, which it always was.
   */
  responseJsonSchema?: unknown;
  /** Overrides `GENERATION_LIMITS.requestTimeoutMs` for this request only. */
  timeoutMs?: number;
  maxOutputTokens: number;
  label: "brief" | "artifact" | "repair";
}

export interface GeminiUsage {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

export type GeminiResponse =
  | {
      ok: true;
      text: string;
      modelVersion?: string;
      usage?: GeminiUsage;
      latencyMs: number;
    }
  | {
      ok: false;
      /** Stable machine codes; the pipeline maps these to user-facing copy. */
      code:
        | "timeout"
        | "blocked"
        | "empty"
        | "too_large"
        | "schema_rejected"
        | "rate_limited"
        | "client_error"
        | "server_error"
        | "transport_error";
      /** Already sanitised — safe to surface. Never contains the key. */
      message: string;
      status?: number;
      latencyMs: number;
    };

export interface GeminiTransport {
  send(request: GeminiRequest, signal: AbortSignal): Promise<GeminiResponse>;
}

/**
 * Wraps a transport with the hard request ceiling.
 *
 * The pipeline counts too, but the ceiling belongs here as well: a future
 * change to the pipeline's control flow should not be able to widen it, and a
 * budget enforced in one place is a budget enforced by accident.
 */
export class BudgetedTransport implements GeminiTransport {
  private used = 0;

  constructor(
    private readonly inner: GeminiTransport,
    private readonly maxRequests: number = GENERATION_LIMITS.maxRequests,
  ) {}

  get requestCount(): number {
    return this.used;
  }

  async send(request: GeminiRequest, signal: AbortSignal): Promise<GeminiResponse> {
    if (this.used >= this.maxRequests) {
      return {
        ok: false,
        code: "transport_error",
        message: `Request budget of ${this.maxRequests} exhausted.`,
        latencyMs: 0,
      };
    }
    this.used += 1;
    return this.inner.send(request, signal);
  }
}

/**
 * Strips anything that could carry the key out of a thrown value.
 *
 * SDK errors sometimes echo the request URL, and on this API the key travels as
 * a query parameter — so a naive `String(error)` is a credential leak into a
 * log or a UI. Everything here is allow-listed rather than redacted, because a
 * redaction pass only removes what it thought to look for.
 */
export function sanitiseTransportError(error: unknown): { code: GeminiResponse extends { ok: false; code: infer C } ? C : never; message: string; status?: number } {
  const status = readStatus(error);

  if (isAbortError(error)) {
    return { code: "timeout" as never, message: "The model did not respond in time." };
  }

  if (typeof status === "number") {
    if (status === 429) {
      return { code: "rate_limited" as never, message: "Gemini rate limit reached.", status };
    }
    if (status === 400) {
      // The one 4xx whose cause is worth distinguishing: a schema the API will
      // not compile is a design problem, not a transient failure.
      //
      // This is also the one error whose own text is worth keeping. A blanket
      // allow-list cost a live canary request: the API said precisely what was
      // wrong with the schema and this function threw it away, leaving
      // "rejected the request or response schema" and nothing to act on. The
      // detail is redacted rather than trusted — see `redact`.
      const detail = redact(readApiMessage(error));
      return {
        code: "schema_rejected" as never,
        message: detail
          ? `Gemini rejected the request or response schema: ${detail}`
          : "Gemini rejected the request or response schema.",
        status,
      };
    }
    if (status >= 400 && status < 500) {
      return { code: "client_error" as never, message: `Gemini rejected the request (${status}).`, status };
    }
    if (status >= 500) {
      return { code: "server_error" as never, message: `Gemini is unavailable (${status}).`, status };
    }
  }

  return { code: "transport_error" as never, message: "The Gemini request failed." };
}

/** Longest schema detail worth surfacing; the rest is noise in a UI. */
const MAX_DETAIL_CHARS = 400;

/**
 * Pulls the API's own message off a thrown error, and nothing else.
 *
 * Reads the `message` property specifically rather than stringifying the
 * error, because `String(error)` on some SDK errors includes the request URL —
 * and on this API the key travels in that URL.
 */
function readApiMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const record = error as Record<string, unknown>;
  const message = record.message;
  if (typeof message !== "string") return "";
  return message;
}

/**
 * Removes anything that could be a credential before the message is shown.
 *
 * Belt and braces on top of `readApiMessage`: a 400 body describes the request
 * schema and has no reason to contain a key, but "has no reason to" is not a
 * guarantee, and this string reaches a screen. Both a `key=` parameter and any
 * long opaque token are replaced outright.
 */
function redact(message: string): string {
  if (!message) return "";
  return message
    .replace(/[?&]key=[^&\s"']*/gi, "?key=[redacted]")
    .replace(/\bAIza[0-9A-Za-z_-]{10,}/g, "[redacted]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_DETAIL_CHARS);
}

function isAbortError(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    ("name" in error ? (error as { name?: string }).name === "AbortError" : false)
  );
}

function readStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const record = error as Record<string, unknown>;
  for (const key of ["status", "statusCode", "code"]) {
    const value = record[key];
    if (typeof value === "number" && value >= 100 && value < 600) return value;
  }
  const response = record.response;
  if (response && typeof response === "object") {
    const status = (response as Record<string, unknown>).status;
    if (typeof status === "number") return status;
  }
  return undefined;
}
