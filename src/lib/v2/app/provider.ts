import "server-only";

/**
 * The app-runtime's provider boundary. One function, one provider.
 *
 * WHY THIS FILE EXISTS. `generateApp` takes a transport as an argument and
 * names no provider anywhere — that is the design, and it is why nothing under
 * `src/lib/v2/app/` ever had to change to move providers. But "provider-
 * agnostic" also meant the choice was made by whichever caller happened to
 * construct a transport, and the only caller that existed picked Anthropic.
 * A boundary nobody owns is a boundary that drifts, so this owns it: every
 * app-runtime generation resolves its provider here, and the regression test
 * asserts that the import graph reachable from this file cannot reach
 * Anthropic at all.
 *
 * The key is never handled here. `resolveGeminiConfig` reads it inside the
 * transport, in the same process, and this function returns only the model id.
 */

import { resolveGeminiConfig } from "../gemini/config";
import { GoogleGeminiTransport } from "../gemini/googleTransport";
import type { GeminiTransport } from "../gemini/transport";

export type AppProvider =
  | { ok: true; transport: GeminiTransport; model: string }
  | { ok: false; message: string };

/**
 * Builds the transport an app generation runs on.
 *
 * Fails closed and fails early: an unconfigured server is told so before a
 * request is attempted rather than after one is spent.
 */
export function createAppTransport(): AppProvider {
  const config = resolveGeminiConfig();
  if (!config.ok) return { ok: false, message: config.message };
  // Only the model id crosses this boundary. The key stays inside the
  // transport, which reads it from the environment itself.
  return { ok: true, transport: new GoogleGeminiTransport(config.model), model: config.model };
}

/**
 * The provider and model, for an operator who needs to see which is in force.
 *
 * Deliberately returns a boolean for the key rather than any part of its
 * value: not a prefix, not a length, not a hash. A fingerprint is still a
 * property of a secret, and nothing here needs one.
 */
export function describeAppProvider(): { provider: "gemini"; model: string | null; configured: boolean } {
  const config = resolveGeminiConfig();
  return {
    provider: "gemini",
    model: config.ok ? config.model : null,
    configured: config.ok,
  };
}
