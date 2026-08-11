/**
 * The stages of first-version generation, as the queue consumer runs them.
 *
 * WHY THIS FILE EXISTS. The whole pipeline used to run inside the server action
 * that started it: one Gemini generation, a parse, the gate, one bounded
 * repair, a Tailwind/esbuild compile and the writes, all in a single request.
 * On Vercel that request has a hard ceiling — 300 s on this account's plan,
 * where 300 s is both the default and the maximum — and the first production
 * generation was killed by it at exactly that mark, leaving a `running` job
 * that a later sweep marked stale. The work itself was fine: seventeen measured
 * live Gemini requests top out at 186.5 s. Two of them plus a compile do not
 * fit in one function, and no configuration makes them.
 *
 * So the pipeline is the same pipeline, cut at the boundaries it already had.
 * Each provider call is its own queue message and gets a whole function to
 * itself. Nothing about how generation works changed — same prompts, same
 * framed transport, same validator, same one-repair ceiling, same compile, same
 * persistence format.
 *
 * WHAT A QUEUE CHANGES. Delivery is at least once. A redelivered message
 * re-enters this code with the same arguments and no memory of the first
 * attempt, so every rule that used to be enforced by "there is only one
 * execution" has to be enforced by state instead:
 *
 * 1. The ceiling of two provider requests is a counter on the job row, moved by
 *    a compare-and-swap under a row lock — see `claimProviderRequest`. A second
 *    delivery finds the counter already past its expected value and returns
 *    without calling the provider. The consumer also disables the queue's own
 *    retries, so a throwing handler is not re-run either.
 * 2. Everything else is idempotent. A repeated persist must not write a second
 *    version, and a repeated release must not refund twice; both check state
 *    they do not own before acting.
 *
 * The job row remains the only product/accounting state. This introduces no
 * second job model: the consumer reads and advances the same row the action
 * claimed, and the same quota reservation it made.
 */

import "server-only";

import { createServiceClient } from "@/lib/supabase/public";
import { toJson } from "@/lib/supabase/json";
import { parseStage3ProjectState, mergeStage3ProjectState, type Stage3ProjectState } from "@/lib/build/stage3Types";
import { beat, finishFailed, finishSucceeded, releaseUsage, type JobErrorCode } from "@/lib/jobs/generationJobs";
import { CONSUMER_BUDGETS, GENERATION_LIMITS } from "../gemini/config";
import { createAppTransport } from "./provider";
import {
  accept,
  acceptPatch,
  planRepair,
  transportCode,
  type Attempt,
  type RepairPlan,
} from "./generate";
import { appRepairPrompt, appRewritePrompt, appSystemPrompt, appUserPrompt } from "./prompt";
import { APP_STATE_VERSION, mergeAppState, readAppState, type AppProjectState } from "./projectState";
import type { GeneratedAppV1 } from "./contract";
import enMessages from "../../../../messages/en.json";
import ruMessages from "../../../../messages/ru.json";

/* ── what crosses a message boundary ─────────────────────────────────────── */

/** One provider call's outcome. Plain JSON: it may travel in a message. */
export type ProviderOutcome =
  | { ok: true; text: string; latencyMs: number }
  | { ok: false; code: string; message: string; latencyMs: number };

/** The gate's verdict on one response, with the repair plan already chosen. */
export type Verdict =
  | { ok: true; app: GeneratedAppV1 }
  | {
      ok: false;
      code: string;
      message: string;
      issues: string[];
      /** Null when a second request would not be worth paying for. */
      plan: SerialPlan | null;
    };

/**
 * A repair plan, flattened for transport.
 *
 * `planRepair` returns the base and the echo context as live objects; both are
 * plain data, so they survive the round trip through the queue unchanged and the
 * repair consumer does not have to re-derive a decision that was already made.
 */
export type SerialPlan =
  | { mode: "patch"; base: GeneratedAppV1; manifest: string[]; files: Record<string, string>; partial: boolean }
  | { mode: "rewrite"; reason: string };

/** The three ids every stage is scoped by. Carried in every message. */
export interface JobRef {
  jobId: string;
  projectId: string;
  userId: string;
}

/* ── heartbeats ──────────────────────────────────────────────────────────── */

/**
 * How often a long stage reports that it is still alive.
 *
 * A job with no heartbeat for `STALE_AFTER_MS` is presumed dead and swept, and
 * generation can legitimately spend four minutes inside one `await`. A
 * beat at the boundaries alone would leave the run one slow request away from
 * having its own quota refunded out from under it, so the beat runs *during*
 * the call. It is also the honest signal: the row says "still working" because
 * work is still happening, not because a timer has not expired yet.
 */
const HEARTBEAT_MS = 30_000;

export async function withHeartbeat<T>(jobId: string, stage: "generating" | "saving", run: () => Promise<T>): Promise<T> {
  await beat(jobId, stage);
  const timer = setInterval(() => {
    void beat(jobId, stage).catch(() => {});
  }, HEARTBEAT_MS);
  try {
    return await run();
  } finally {
    clearInterval(timer);
  }
}

/* ── the guard ───────────────────────────────────────────────────────────── */

/**
 * Decides whether this run should do anything at all.
 *
 * Redelivery safety starts here. A message that arrives twice, or after a stale
 * sweep already ended the job, must not generate again — so the job has to still
 * be in flight and the project must not already hold an application. Both are
 * read from the database rather than from anything the message carries.
 */
export async function beginGeneration(ref: JobRef): Promise<{ proceed: boolean; reason?: string }> {
  const service = createServiceClient();

  const { data: job } = await service
    .from("generation_jobs")
    .select("status")
    .eq("id", ref.jobId)
    .maybeSingle();
  if (!job) return { proceed: false, reason: "the job row is gone" };
  if (job.status !== "running" && job.status !== "queued") {
    return { proceed: false, reason: `the job is already ${job.status}` };
  }

  const { data: project } = await service
    .from("projects")
    .select("snapshot_fields")
    .eq("id", ref.projectId)
    .eq("user_id", ref.userId)
    .maybeSingle();
  if (!project) return { proceed: false, reason: "the project is gone" };
  if (readAppState(project.snapshot_fields)) {
    return { proceed: false, reason: "the project already has an application" };
  }

  await beat(ref.jobId, "generating");
  return { proceed: true };
}

/* ── the generation request ──────────────────────────────────────────────── */

/**
 * One Gemini generation. Exactly one, ever.
 *
 * The timeout is the consumer-safe budget rather than `STAGE_BUDGETS.generate`,
 * which is 300 s and therefore exactly the function ceiling — a request allowed
 * to spend the whole ceiling leaves nothing for the return and gets the
 * invocation killed instead of timing out cleanly. See `CONSUMER_BUDGETS`.
 *
 * Callers must have won `claimProviderRequest` before reaching here. That is
 * what makes "exactly one" true across a redelivered message, not this comment.
 */
export async function requestGeneration(
  ref: JobRef,
  input: { brief: string },
): Promise<ProviderOutcome> {
  const provider = createAppTransport();
  if (!provider.ok) {
    return { ok: false, code: "not_configured", message: provider.message, latencyMs: 0 };
  }

  return withHeartbeat(ref.jobId, "generating", async () => {
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), CONSUMER_BUDGETS.generate);
    try {
      const response = await provider.transport.send(
        {
          model: provider.model,
          system: appSystemPrompt("react-spa"),
          user: appUserPrompt(input.brief),
          timeoutMs: CONSUMER_BUDGETS.generate,
          maxOutputTokens: GENERATION_LIMITS.maxOutputTokensArtifact,
          label: "artifact",
        },
        controller.signal,
      );
      return response.ok
        ? { ok: true as const, text: response.text, latencyMs: response.latencyMs }
        : {
            ok: false as const,
            code: transportCode(response),
            message: response.message,
            latencyMs: response.latencyMs,
          };
    } finally {
      clearTimeout(deadline);
    }
  });
}

/* ── the gate ────────────────────────────────────────────────────────────── */

/** Parse, validate and compile — the deterministic half, unchanged. */
export async function evaluateGeneration(ref: JobRef, text: string): Promise<Verdict> {
  return withHeartbeat(ref.jobId, "generating", async () => {
    const attempt = await accept(text, {});
    return verdictOf(attempt);
  });
}

/* ── the one repair ──────────────────────────────────────────────────────── */

export async function requestRepair(
  ref: JobRef,
  input: { brief: string; issues: string[]; plan: SerialPlan },
): Promise<ProviderOutcome> {
  const provider = createAppTransport();
  if (!provider.ok) {
    return { ok: false, code: "not_configured", message: provider.message, latencyMs: 0 };
  }

  return withHeartbeat(ref.jobId, "generating", async () => {
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), CONSUMER_BUDGETS.repair);
    try {
      const response = await provider.transport.send(
        {
          model: provider.model,
          system: appSystemPrompt("react-spa"),
          user:
            input.plan.mode === "patch"
              ? appRepairPrompt(input.issues, {
                  manifest: input.plan.manifest,
                  files: input.plan.files,
                  partial: input.plan.partial,
                })
              : appRewritePrompt(appUserPrompt(input.brief), input.issues),
          timeoutMs: CONSUMER_BUDGETS.repair,
          // A rewrite is a generation and needs a generation's room; a patch
          // keeps the smaller budget. Unchanged from the inline pipeline.
          maxOutputTokens:
            input.plan.mode === "patch"
              ? GENERATION_LIMITS.maxOutputTokensRepair
              : GENERATION_LIMITS.maxOutputTokensArtifact,
          label: "repair",
        },
        controller.signal,
      );
      return response.ok
        ? { ok: true as const, text: response.text, latencyMs: response.latencyMs }
        : {
            ok: false as const,
            code: transportCode(response),
            message: response.message,
            latencyMs: response.latencyMs,
          };
    } finally {
      clearTimeout(deadline);
    }
  });
}

export async function evaluateRepair(
  ref: JobRef,
  input: { text: string; plan: SerialPlan },
): Promise<Verdict> {
  return withHeartbeat(ref.jobId, "generating", async () => {
    const attempt =
      input.plan.mode === "patch"
        ? await acceptPatch(input.text, input.plan.base, {})
        : await accept(input.text, {});
    return verdictOf(attempt);
  });
}

/* ── persistence ─────────────────────────────────────────────────────────── */

/**
 * Stores the application and marks the job succeeded.
 *
 * Idempotent on purpose, because a message may arrive twice: a project that
 * already holds an application is left exactly as it is and the job is simply
 * marked succeeded again. That makes a duplicate a no-op rather than a second
 * version, which is the property the whole design turns on.
 *
 * Writes go through the service client. There is no request and no session here
 * — the consumer outlives both — so every statement is scoped by `user_id`
 * explicitly rather than relying on RLS to do it.
 */
export async function persistGeneratedApp(
  ref: JobRef,
  input: { app: GeneratedAppV1; model: string; locale: string },
): Promise<{ ok: boolean; message?: string }> {
  return withHeartbeat(ref.jobId, "saving", async () => {
    const service = createServiceClient();

    const { data: project } = await service
      .from("projects")
      .select("snapshot_fields, locale")
      .eq("id", ref.projectId)
      .eq("user_id", ref.userId)
      .maybeSingle();
    if (!project) return { ok: false, message: "The project is gone." };

    // Already written by an earlier delivery. Finish the job and
    // touch nothing else — re-saving would replace a version the person may
    // already be looking at.
    if (readAppState(project.snapshot_fields)) {
      await finishSucceeded(ref.jobId);
      return { ok: true };
    }

    const state: AppProjectState = {
      version: APP_STATE_VERSION,
      kind: "app",
      app: input.app,
      generatedAt: new Date().toISOString(),
      model: input.model,
    };

    const existing = parseStage3ProjectState(project.snapshot_fields);
    const base: Stage3ProjectState = existing
      ? { ...existing, status: "first_version_ready" }
      : {
          version: 1,
          kind: "stage3",
          sessionId: ref.projectId,
          status: "first_version_ready",
          startingPoint: null,
          conversationId: ref.projectId,
          lastRequestId: null,
          turn: null,
          direction: null,
          output: null,
        };

    const snapshot = mergeAppState(mergeStage3ProjectState(project.snapshot_fields, base), state);
    snapshot.solution = input.app.metadata.description;

    const { error: saveError } = await service
      .from("projects")
      .update({ name: input.app.metadata.name, snapshot_fields: toJson(snapshot) })
      .eq("id", ref.projectId)
      .eq("user_id", ref.userId);
    if (saveError) return { ok: false, message: "Saving the generated application failed." };

    await announce(service, ref, base.conversationId, input.app.metadata.name, input.locale);
    await finishSucceeded(ref.jobId);
    return { ok: true };
  });
}

/**
 * The assistant's "it's ready" message, and the conversation title.
 *
 * Best-effort and deliberately after the save: a project with a version and no
 * chat message is a cosmetic gap, while a message promising a version that was
 * never stored is a lie. The message id is derived from the conversation, so a
 * repeated delivery updates one row rather than adding a second message.
 */
async function announce(
  service: ReturnType<typeof createServiceClient>,
  ref: JobRef,
  conversationId: string,
  name: string,
  locale: string,
): Promise<void> {
  const messages = locale === "ru" ? ruMessages : enMessages;
  const template = messages.stage3?.generationReply ?? "{name} now has a complete first version.";
  const reply = template.replace("{name}", name);

  await service.from("project_ai_messages").upsert(
    {
      id: derivedMessageId(conversationId),
      conversation_id: conversationId,
      project_id: ref.projectId,
      user_id: ref.userId,
      role: "assistant",
      content: reply,
    },
    { onConflict: "id" },
  );
  await service
    .from("project_ai_conversations")
    .update({ title: name.slice(0, 60) })
    .eq("id", conversationId)
    .eq("user_id", ref.userId);
}

/**
 * A stable UUID for the readiness message.
 *
 * The same derivation the inline path used, reimplemented without `node:crypto`
 * so the id is a pure function of the conversation and nothing else. FNV-1a over
 * the seed, laid out as a v4-shaped UUID; it only has to be deterministic and
 * collision-free within one conversation, which is what makes a repeated
 * delivery update one row instead of adding a second message.
 */
function derivedMessageId(conversationId: string): string {
  const seed = `${conversationId}:first-version-ready`;
  const words: number[] = [];
  let hash = 0x811c9dc5;
  for (let round = 0; round < 4; round += 1) {
    for (let i = 0; i < seed.length; i += 1) {
      hash ^= seed.charCodeAt(i) + round;
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    words.push(hash);
  }
  const hex = words.map((word) => word.toString(16).padStart(8, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    ((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join("-");
}

/* ── failure ─────────────────────────────────────────────────────────────── */

/**
 * Ends the job and gives back its unit of quota.
 *
 * Both halves are idempotent in the database — `release_generation_job_usage`
 * refuses a second refund and refuses to refund a job that succeeded — so a
 * duplicate delivery, or a stale sweep racing it, cannot double-credit.
 */
export async function failGeneration(
  ref: JobRef,
  input: { code: JobErrorCode; message: string },
): Promise<void> {
  await finishFailed(ref.jobId, input.code, input.message);
  await releaseUsage(ref.jobId, "first_version_generation");
}

/* ── shared ──────────────────────────────────────────────────────────────── */

/** Flattens the gate's own `Attempt` into something a message can hold. */
function verdictOf(attempt: Attempt): Verdict {
  if (attempt.ok) return { ok: true, app: attempt.build.app };

  let plan: SerialPlan | null = null;
  if (attempt.repairable) {
    const chosen: RepairPlan = planRepair(attempt);
    plan =
      chosen.mode === "patch"
        ? {
            mode: "patch",
            base: chosen.base,
            manifest: chosen.context.manifest,
            files: chosen.context.files,
            partial: chosen.context.partial,
          }
        : { mode: "rewrite", reason: chosen.reason };
  }

  return {
    ok: false,
    code: attempt.code,
    message: attempt.message,
    issues: attempt.issues,
    plan,
  };
}
