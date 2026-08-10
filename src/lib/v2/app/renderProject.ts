import "server-only";

/**
 * The app runtime, as the product calls it.
 *
 * One function between `generateFirstVersionAction` and everything the ship
 * gate proved. It exists so the action stays a job/quota lifecycle and does not
 * grow a second copy of provider handling, and so this path can be turned on
 * per deploy exactly the way codegen was.
 *
 * It runs *inside* the caller's job. The bounded repair is a second provider
 * request, but from the person's side one generation happened: one job row, one
 * reserved unit, one refund path, one retry count. A separate action would have
 * meant a second unit for the same button.
 *
 * There is no fallback to the old renderer. A failure here refunds and surfaces
 * like any other generation failure — falling back would record a failure as a
 * success and make the whole gate meaningless.
 */

import { createAppTransport } from "./provider";
import { generateApp, type AppTelemetry } from "./generate";
import { APP_STATE_VERSION, type AppProjectState } from "./projectState";

/** Off unless a deploy turns it on, exactly like `VENTRIO_CODEGEN_RENDER`. */
export function appRuntimeEnabled(): boolean {
  return process.env.VENTRIO_APP_RUNTIME === "1";
}

export type AppRenderResult =
  | { ok: true; state: AppProjectState; document: string; telemetry: AppTelemetry }
  | { ok: false; code: string; message: string; issues?: string[]; telemetry?: AppTelemetry };

export interface AppRenderInput {
  /** What to build, in the person's own terms. */
  brief: string;
  locale: string;
}

/**
 * Composes the brief the model sees.
 *
 * The person's idea comes first and unedited. The intake answers follow as two
 * short lines because that is what they are — a product type and a visual
 * direction — and nothing else is added. Ventrio does not author the brief; it
 * passes on what it was told and says which language the copy is in.
 */
export function composeAppBrief(input: {
  idea: string;
  productType?: string | null;
  designDirection?: string | null;
  locale: string;
}): string {
  const lines = [input.idea.trim()];
  if (input.productType) lines.push("", `The person asked for: ${input.productType}.`);
  if (input.designDirection) lines.push(`They chose this visual direction: ${input.designDirection}.`);
  lines.push("", `Write the interface copy in ${input.locale === "ru" ? "Russian" : "English"}.`);
  return lines.join("\n");
}

export async function renderProjectWithAppRuntime(input: AppRenderInput): Promise<AppRenderResult> {
  const provider = createAppTransport();
  if (!provider.ok) return { ok: false, code: "not_configured", message: provider.message };

  const result = await generateApp({ model: provider.model, brief: input.brief }, provider.transport);

  if (!result.ok) {
    return {
      ok: false,
      code: result.code,
      message: result.message,
      issues: result.issues,
      telemetry: result.telemetry,
    };
  }

  return {
    ok: true,
    document: result.document,
    telemetry: result.telemetry,
    state: {
      version: APP_STATE_VERSION,
      kind: "app",
      app: result.app,
      generatedAt: new Date().toISOString(),
      model: provider.model,
    },
  };
}
