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

  const transport = new GoogleGeminiTransport(config.model);
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), DISCOVERY_TIMEOUT_MS + 5_000);

  try {
    const response = await transport.send(
      {
        model: config.model,
        system: input.system,
        user: flatten(input.history),
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

    if (!response.ok) return { ok: false, reason: `${response.code}` };

    /**
     * The same tolerant parse the generation path uses.
     *
     * A model asked for JSON occasionally wraps it in a fence or leaves a stray
     * escape, and `parseModelJsonSafe` repairs exactly those without accepting
     * anything structurally different. The caller's own validator is still the
     * authority over what the object may contain.
     */
    const parsed = parseModelJsonSafe(response.text);
    if (!parsed.ok) return { ok: false, reason: "unparseable" };

    return {
      ok: true,
      value: parsed.value,
      model: response.modelVersion ?? config.model,
      latencyMs: response.latencyMs,
      inputTokens: response.usage?.promptTokenCount,
      outputTokens: response.usage?.candidatesTokenCount,
    };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? `threw:${error.name}` : "threw:unknown" };
  } finally {
    clearTimeout(deadline);
  }
}
