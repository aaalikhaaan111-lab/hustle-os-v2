import "server-only";

/**
 * The creation assistant, on the same provider as everything else.
 *
 * WHY THIS EXISTS. Discovery was the last thing in the user's path still
 * calling Anthropic, and on 2026-08-12 that account ran out of credit. The
 * product did not degrade — it stopped: `/create` answered "The creation
 * assistant is briefly unavailable", no project could be started, and because
 * only discovery sets a project's direction, no *existing* project could reach
 * generation either. App generation was on Gemini and perfectly healthy the
 * whole time, and none of it was reachable.
 *
 * A single provider outage taking out the entire funnel is not something a
 * launch can carry, so the one call in the way moved to the provider the rest
 * of the product already depends on.
 *
 * WHAT DID NOT CHANGE. The prompt, the schema, the validation and the turn
 * shape are all the caller's, exactly as before. This module owns one thing:
 * turning a system prompt and a conversation into one JSON object, or a reason
 * it could not. It has no opinion about what a discovery turn means.
 */

import { resolveGeminiConfig } from "./config";
import { GoogleGeminiTransport } from "./googleTransport";
import { parseModelJsonSafe } from "../json/modelJson";

/**
 * Short. A discovery turn is a few hundred tokens of conversation, and the
 * person is waiting on it with a cursor blinking — this is not the place for
 * the multi-minute budgets generation runs on.
 */
const DISCOVERY_TIMEOUT_MS = 45_000;
const DISCOVERY_MAX_OUTPUT_TOKENS = 4_096;

/**
 * One retry, and only for a provider that said it was unavailable.
 *
 * A single 503 became a user-visible failure: production returned
 * `Gemini is unavailable (503)` for a first discovery turn, and the Retry the
 * person pressed 3.7 seconds later hit the same degraded window. Nothing in
 * this path retried, so a transient outage read as "the creation assistant is
 * unavailable".
 *
 * ONLY 5xx. A 429 means the account is over its allowance and asking again
 * makes it worse; a 4xx means the request itself is wrong and will be wrong
 * again; a timeout has already spent the person's patience. Those are answers,
 * not accidents, and each is returned as it was.
 *
 * The delay is short and fixed. A longer backoff would be better for a server
 * and worse for the person waiting on one turn of a conversation — and both
 * attempts share the deadline below, so retrying cannot extend the worst case.
 */
const RETRY_ON: ReadonlySet<string> = new Set(["server_error"]);
const RETRY_DELAY_MS = 600;

export interface DiscoveryMessage {
  role: "user" | "assistant";
  content: string;
}

export type DiscoveryResult =
  | { ok: true; value: unknown; model: string; latencyMs: number; inputTokens?: number; outputTokens?: number }
  | { ok: false; reason: string };

/**
 * Flattens the conversation into one turn.
 *
 * The transport sends a single user message by design, and a discovery turn is
 * a single-shot request: the model is given the exchange so far and asked for
 * the next move. Roles are labelled so the model can still tell who said what.
 */
function flatten(history: readonly DiscoveryMessage[]): string {
  return history
    .map((entry) => `${entry.role === "user" ? "PERSON" : "YOU"}: ${entry.content}`)
    .join("\n\n");
}

export async function requestDiscoveryTurn(input: {
  system: string;
  history: readonly DiscoveryMessage[];
}): Promise<DiscoveryResult> {
  const config = resolveGeminiConfig();
  if (!config.ok) return { ok: false, reason: `unconfigured:${config.code}` };
  if (input.history.length === 0) return { ok: false, reason: "empty_history" };

  console.info("[ventrio-discovery]", JSON.stringify({
    systemChars: input.system.length,
    turns: input.history.length,
    userChars: input.history.reduce((total, entry) => total + entry.content.length, 0),
  }));

  const transport = new GoogleGeminiTransport(config.model);
  const user = flatten(input.history);
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), DISCOVERY_TIMEOUT_MS + 5_000);

  const send = () => transport.send(
    {
      model: config.model,
      system: input.system,
      user,
      timeoutMs: DISCOVERY_TIMEOUT_MS,
      maxOutputTokens: DISCOVERY_MAX_OUTPUT_TOKENS,
      /**
       * The least reasoning the API offers, for the same reason the repair
       * uses it: this turn asks one short structured question about what the
       * person just said. The depth the model spends by default is latency a
       * waiting user pays for.
       */
      thinkingLevel: "minimal",
      label: "brief",
    },
    controller.signal,
  );

  try {
    let response = await send();

    /**
     * The one retry. Quota is untouched by it: the caller reserves a discovery
     * turn once, before this function is entered, so both attempts belong to
     * the same reservation and one turn still costs one.
     */
    if (!response.ok && RETRY_ON.has(response.code) && !controller.signal.aborted) {
      console.info("[ventrio-discovery]", JSON.stringify({ retrying: response.code, status: response.status }));
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      if (!controller.signal.aborted) response = await send();
    }

    if (!response.ok) {
      /**
       * The code alone is not diagnosable.
       *
       * `server_error` says the provider refused and nothing about why, which
       * cost a deploy to discover the first time. The transport's message has
       * already been through `sanitiseTransportError`, so it carries no URL and
       * no key; it is truncated here because a provider error body can be long
       * and this is a log line, not a report.
       */
      const detail = response.message.replace(/\s+/g, " ").slice(0, 240);
      return { ok: false, reason: `${response.code}:${detail}` };
    }

    /**
     * The same tolerant parse the generation path uses.
     *
     * A model asked for JSON occasionally wraps it in a fence or leaves a stray
     * escape, and `parseModelJsonSafe` repairs exactly those without accepting
     * anything structurally different. The caller's own validator is still the
     * authority over what the object may contain.
     */
    const parsed = parseModelJsonSafe(response.text);
    if (!parsed.ok) {
      return { ok: false, reason: `unparseable:${response.text.length}b` };
    }

    return {
      ok: true,
      value: parsed.value,
      model: response.modelVersion ?? config.model,
      latencyMs: response.latencyMs,
      inputTokens: response.usage?.promptTokenCount,
      outputTokens: response.usage?.candidatesTokenCount,
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error
        ? `threw:${error.name}:${String(error.message).slice(0, 160)}`
        : "threw:unknown",
    };
  } finally {
    clearTimeout(deadline);
  }
}
