/**
 * The database and the provider, faked, so the real stages can be run.
 *
 * `stages.ts` is the code under test in `repair-deadline.test.mts` — not a copy
 * of it — so everything it reaches for has to exist: a Supabase client, the job
 * functions it calls, and a transport. Each is modelled closely enough that the
 * assertions mean something:
 *
 *   - the job row is a real object with a real status, so `persistGeneratedApp`
 *     re-reading it after a timeout observes what production would observe;
 *   - `releaseUsage` obeys the same "only once, and never after success" rule
 *     the database function enforces, so a double refund would show up here;
 *   - `beat` records every heartbeat with a timestamp, which is the only way to
 *     prove the heartbeat kept running during a slow call.
 */

import type { GeminiRequest, GeminiResponse, GeminiTransport } from "../../../src/lib/v2/gemini/transport";

/* ── providers that misbehave, in the three shapes the hang could take ───── */

/**
 * The point is to separate layers the production evidence could not: a request
 * that never returns, one that ignores the abort it was handed, and one whose
 * fetch resolves and then stalls reading the body. Only the first is what
 * "timeout" normally means; the other two are the ones that leave a consumer
 * with no control to regain.
 */

export type HangKind = "never-resolves" | "ignores-abort" | "stalls-after-start";

export interface HangingTransport extends GeminiTransport {
  /** Set once the request has actually been issued. */
  readonly started: Promise<void>;
  /** How many requests this transport was asked to make. */
  readonly requestCount: number;
  /** Resolves the pending call, as a late provider completion would. */
  finishLate(text: string): void;
}

export function hangingTransport(kind: HangKind): HangingTransport {
  let count = 0;
  let markStarted: () => void;
  const started = new Promise<void>((resolve) => { markStarted = resolve; });
  let lateResolve: ((value: GeminiResponse) => void) | null = null;

  return {
    get requestCount() { return count; },
    started,
    finishLate(text: string) {
      lateResolve?.({ ok: true, text, latencyMs: 1, modelVersion: "fake" } as GeminiResponse);
    },
    async send(_request: GeminiRequest, signal: AbortSignal): Promise<GeminiResponse> {
      count += 1;
      markStarted();

      if (kind === "never-resolves") {
        // No abort listener at all: the provider simply never answers. This is
        // the shape a hung socket takes once the request is on the wire.
        return new Promise<GeminiResponse>((resolve) => { lateResolve = resolve; });
      }

      if (kind === "ignores-abort") {
        // The signal is handed over and deliberately disregarded, which is what
        // a fetch layer that does not honour cancellation looks like from here.
        void signal;
        return new Promise<GeminiResponse>((resolve) => { lateResolve = resolve; });
      }

      // stalls-after-start: the request "returns headers" and then the body
      // read never completes. This is the case the production timing fits, and
      // the one the transport's own abort would have to interrupt mid-read.
      await new Promise((resolve) => setTimeout(resolve, 5));
      return new Promise<GeminiResponse>((resolve) => { lateResolve = resolve; });
    },
  };
}


export interface JobRow {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  errorCode: string | null;
  errorMessage: string | null;
  reserved: boolean;
  released: boolean;
  providerRequests: number;
}

interface Infra {
  job: JobRow;
  beats: Array<{ at: number; stage: string }>;
  snapshot: Record<string, unknown>;
  projectMissing: boolean;
  transport: HangingTransport | null;
  transportOk: boolean;
  saves: number;
}

const KEY = Symbol.for("ventrio.fakeInfra");
const globals = globalThis as unknown as Record<symbol, Infra>;

function fresh(): Infra {
  return {
    job: { id: "job-1", status: "running", errorCode: null, errorMessage: null, reserved: true, released: false, providerRequests: 1 },
    beats: [],
    snapshot: {},
    projectMissing: false,
    transport: null,
    transportOk: true,
    saves: 0,
  };
}

const state = (globals[KEY] ??= fresh());

export function __reset(options: { hang?: HangKind; transportOk?: boolean } = {}): Infra {
  const next = fresh();
  next.transport = options.hang ? hangingTransport(options.hang) : null;
  next.transportOk = options.transportOk ?? true;
  Object.assign(state, next);
  return state;
}

export function __state(): Infra {
  return state;
}

/* ── @/lib/jobs/generationJobs ───────────────────────────────────────────── */

export async function beat(jobId: string, stage: string): Promise<void> {
  void jobId;
  state.beats.push({ at: Date.now(), stage });
}

export async function finishFailed(jobId: string, code: string, message: string): Promise<void> {
  void jobId;
  // Mirrors the real update: terminal, and it does not un-finish a finished job.
  if (state.job.status === "succeeded") return;
  state.job.status = "failed";
  state.job.errorCode = code;
  state.job.errorMessage = message;
}

export async function finishSucceeded(jobId: string): Promise<void> {
  void jobId;
  state.job.status = "succeeded";
}

export async function releaseUsage(jobId: string): Promise<boolean> {
  void jobId;
  // The database's rules, not a stub: nothing to give back if it was never
  // reserved, already returned, or earned by a job that succeeded.
  if (!state.job.reserved) return false;
  if (state.job.released) return false;
  if (state.job.status === "succeeded") return false;
  state.job.released = true;
  return true;
}

export async function claimProviderRequest(jobId: string, expected: number): Promise<boolean> {
  void jobId;
  if (state.job.status !== "running" && state.job.status !== "queued") return false;
  if (state.job.providerRequests !== expected) return false;
  state.job.providerRequests = expected + 1;
  return true;
}

/* ── @/lib/v2/app/provider ───────────────────────────────────────────────── */

export function createAppTransport() {
  if (!state.transportOk) return { ok: false as const, message: "Gemini is not configured on this server." };
  return { ok: true as const, model: "gemini-3.6-flash", transport: state.transport! };
}

/* ── @/lib/supabase/public ───────────────────────────────────────────────── */

/**
 * Just enough of the query builder for the two reads and one write the persist
 * stage performs. Chainable, and every terminal returns the shape the real
 * client returns — `{ data, error }` — because that is what the code branches on.
 */
export function createServiceClient() {
  return {
    from(table: string) {
      const builder = {
        _table: table,
        _columns: "",
        select(columns: string) { builder._columns = columns; return builder; },
        eq() { return builder; },
        update() { state.saves += 1; return { eq: () => ({ eq: async () => ({ error: null }) }) }; },
        upsert: async () => ({ error: null }),
        async maybeSingle() {
          if (builder._table === "generation_jobs") {
            return { data: { status: state.job.status }, error: null };
          }
          if (builder._table === "projects") {
            if (state.projectMissing) return { data: null, error: null };
            return { data: { snapshot_fields: state.snapshot, locale: "en" }, error: null };
          }
          return { data: null, error: null };
        },
      };
      return builder;
    },
  };
}
