"use server";

import { notFound } from "next/navigation";
import { AnthropicCodegenTransport } from "@/lib/v2/codegen/anthropicTransport";
import { resolveCodegenConfig } from "@/lib/v2/codegen/config";
import { BudgetedTransport } from "@/lib/v2/gemini/transport";
import {
  generateCodegenBundle,
  CODEGEN_MAX_REQUESTS,
  type CodegenTelemetry,
} from "@/lib/v2/codegen/generate";
import { RELAY_CONTENT } from "@/lib/v2/codegen/contentPacks";
import type { CompiledRoute } from "@/lib/v2/codegen/compile";

/**
 * The server action behind the codegen harness.
 *
 * Same three properties as the artifact harness: the key is read here and
 * never leaves the process, the action refuses to exist in production before it
 * reads anything, and what crosses back to the client is already compiled and
 * gated — the srcDoc strings have passed the full chain in compile.ts.
 *
 * The transport is constructed with the codegen ceiling of two requests rather
 * than the pipeline default of three.
 */

const RELAY_BRIEF =
  "Relay is a build log for solo hardware makers: a running log of what was done, " +
  "the parts actually used, and which revision finally worked. It is a single-user " +
  "tool, deliberately not a team product, and it works offline at the bench.";

const RELAY_ROUTES = [
  { path: "/", purpose: "Explain the problem and how the log works; lead to pricing." },
  { path: "/pricing", purpose: "One plan, the price, and the questions people ask before paying." },
] as const;

export type CodegenState =
  | { status: "idle" }
  | { status: "error"; message: string; issues?: string[]; stage?: string; telemetry?: CodegenTelemetry }
  | { status: "ok"; routes: CompiledRoute[]; telemetry: CodegenTelemetry; report: { cssBytes: number; unusedContentKeys: string[] } };

/**
 * Durable capture of a paid run.
 *
 * A generation costs a provider request and takes over a minute, and the
 * result lived only in React state — so a page reload during the call threw
 * away work that had already been paid for. That happened once. The compiled
 * bundle is now written to disk as well, outside the repository, so a lost
 * client state costs a refresh rather than another request.
 *
 * Development only, like everything else on this route, and the path is a
 * scratch directory rather than anywhere the repo would pick it up.
 */
async function captureRun(payload: unknown): Promise<void> {
  try {
    const { writeFile, mkdir } = await import("node:fs/promises");
    const dir = process.env.CODEGEN_CAPTURE_DIR;
    if (!dir) return;
    await mkdir(dir, { recursive: true });
    await writeFile(`${dir}/codegen-run-${Date.now()}.json`, JSON.stringify(payload, null, 2), "utf8");
  } catch {
    // Capture is a convenience, never a reason to fail a run.
  }
}

/**
 * The per-run request ceiling.
 *
 * Overridable downward so a retry can be given exactly the budget that remains
 * from an earlier partial run, rather than a fresh allowance the caller never
 * authorised. Never allowed above the hard ceiling.
 */
function requestBudget(): number {
  const raw = Number(process.env.CODEGEN_REQUEST_BUDGET ?? CODEGEN_MAX_REQUESTS);
  if (!Number.isInteger(raw) || raw < 1) return CODEGEN_MAX_REQUESTS;
  return Math.min(raw, CODEGEN_MAX_REQUESTS);
}

export async function generateCodegenAction(): Promise<CodegenState> {
  if (process.env.NODE_ENV === "production") notFound();

  const config = resolveCodegenConfig();
  if (!config.ok) return { status: "error", message: config.message };

  const budget = requestBudget();
  const transport = new BudgetedTransport(new AnthropicCodegenTransport(config.model), budget);

  const result = await generateCodegenBundle(
    { model: config.model, brief: RELAY_BRIEF, content: RELAY_CONTENT, routes: RELAY_ROUTES, maxRequests: budget },
    transport,
  );

  if (!result.ok) {
    // `raw` first: a failed run still cost a request, and the model's actual
    // output is the only thing that makes the failure diagnosable offline.
    await captureRun({ ok: false, code: result.code, message: result.message, stage: result.stage, issues: result.issues, telemetry: result.telemetry, raw: result.raw });
    return {
      status: "error",
      message: result.message,
      issues: result.issues,
      stage: result.stage,
      telemetry: result.telemetry,
    };
  }

  // `raw` is captured so a later gate change can be replayed against real
  // model output without another paid request.
  await captureRun({ ok: true, routes: result.routes, report: result.report, telemetry: result.telemetry, raw: result.raw });

  return {
    status: "ok",
    routes: result.routes,
    telemetry: result.telemetry,
    report: { cssBytes: result.report.cssBytes, unusedContentKeys: result.report.unusedContentKeys },
  };
}
