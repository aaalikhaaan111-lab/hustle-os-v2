/**
 * The only channel between a generated app and Ventrio.
 *
 * A sandboxed frame with an opaque origin can still call
 * `parent.postMessage`. That is deliberate — it is how a generated app reports
 * that it mounted, or that it threw — and it is also the one place where bytes
 * chosen by a model arrive inside Ventrio's origin. So every message is treated
 * as hostile input from an untrusted program, because that is exactly what it
 * is.
 *
 * FOUR CHECKS, and the reason each one is not optional:
 *
 *   1. SOURCE. `event.source !== frame.contentWindow` means some other frame
 *      or window sent it. Any page that has a handle on this tab can post to
 *      it, so without this check a third party can forge a "ready" or feed the
 *      repair loop invented diagnostics.
 *   2. ORIGIN. An opaque origin serialises as the string "null". We require
 *      exactly that: a message arriving with a real origin did not come from
 *      the sandbox, whatever else it claims. Note this is a *necessary* check
 *      and not a sufficient one — "null" is forgeable by any other sandboxed
 *      frame — which is why the source check above carries the real weight.
 *   3. SHAPE. Validated field by field, with bounded strings, before anything
 *      reads a payload. An error message goes into a repair prompt and into
 *      logs; an unbounded one is a denial-of-service on both.
 *   4. TYPE. A closed set. An unknown `type` is dropped, never dispatched.
 *
 * Nothing here trusts a field to be the type it claims. Every read is checked.
 */

export const PREVIEW_PROTOCOL_VERSION = 1;
export const PREVIEW_SOURCE = "ventrio-preview";

/** The opaque origin a sandboxed frame reports. */
export const OPAQUE_ORIGIN = "null";

export type PreviewMessage =
  | { type: "ready"; payload: Record<string, never> }
  | { type: "runtime-error"; payload: RuntimeErrorPayload }
  | { type: "size"; payload: { height: number } };

export interface RuntimeErrorPayload {
  kind: string;
  message: string;
  stack: string;
}

const MAX_MESSAGE_CHARS = 2_000;
const MAX_STACK_CHARS = 4_000;
const MAX_KIND_CHARS = 40;
/** A generated page taller than this is a runaway layout, not a long page. */
const MAX_REPORTED_HEIGHT = 200_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  return value.length <= max ? value : value.slice(0, max);
}

export interface ParseContext {
  /** The frame this preview owns. A message from anywhere else is discarded. */
  expectedSource: MessageEventSource | null;
}

/**
 * Validates one message. Returns null for anything that is not ours.
 *
 * Null rather than throwing: a page receives messages from extensions, dev
 * tools and other frames all the time, and throwing on each would turn normal
 * background noise into an error stream.
 */
export function parsePreviewMessage(
  event: MessageEvent,
  context: ParseContext,
): PreviewMessage | null {
  // 1. source
  if (!context.expectedSource || event.source !== context.expectedSource) return null;
  // 2. origin
  if (event.origin !== OPAQUE_ORIGIN) return null;

  // 3. shape
  const data = event.data;
  if (!isRecord(data)) return null;
  if (data.source !== PREVIEW_SOURCE) return null;
  if (data.version !== PREVIEW_PROTOCOL_VERSION) return null;
  const payload = isRecord(data.payload) ? data.payload : null;
  if (!payload) return null;

  // 4. type
  switch (data.type) {
    case "ready":
      return { type: "ready", payload: {} };

    case "runtime-error": {
      const message = boundedString(payload.message, MAX_MESSAGE_CHARS);
      if (message === null) return null;
      return {
        type: "runtime-error",
        payload: {
          kind: boundedString(payload.kind, MAX_KIND_CHARS) ?? "error",
          message,
          stack: boundedString(payload.stack, MAX_STACK_CHARS) ?? "",
        },
      };
    }

    case "size": {
      const height = payload.height;
      if (typeof height !== "number" || !Number.isFinite(height)) return null;
      if (height <= 0 || height > MAX_REPORTED_HEIGHT) return null;
      return { type: "size", payload: { height: Math.round(height) } };
    }

    default:
      return null;
  }
}

export interface PreviewHandlers {
  /** The app inside signalled that it mounted. */
  onReady?: () => void;
  /** Distinct runtime errors so far, most frequent first. */
  onRuntimeErrors?: (messages: string[]) => void;
}

/**
 * Listens for one preview frame's messages. Returns the teardown.
 *
 * WHICH WINDOW, AND WHY IT IS NOT `window`. A sandboxed frame posts to its
 * `parent`. That is the window of the document the frame lives in — which in
 * the workspace is *not* the top window, because `ViewportFrame` renders the
 * preview inside a same-origin iframe of its own and portals React into it. So
 * a listener on the page's `window` sits one document above where the messages
 * arrive and hears nothing at all.
 *
 * That was a real defect, found in production on 2026-08-12: `data-ready` never
 * flipped, and every runtime error a generated app reported was dropped on the
 * floor — the preview looked fine while the one channel that says otherwise was
 * disconnected. Resolving the window from the frame itself is what makes this
 * correct at any nesting depth, including none.
 *
 * A frame with no owning window is not an error: it is a frame that was never
 * inserted into a document, and there is nothing to listen to yet.
 */
export function subscribePreview(
  frame: Pick<HTMLIFrameElement, "ownerDocument" | "contentWindow"> | null,
  handlers: PreviewHandlers,
): () => void {
  const target = frame?.ownerDocument?.defaultView;
  if (!frame || !target) return () => {};

  const log = new RuntimeErrorLog();
  const handler = (event: MessageEvent): void => {
    // Every check lives in `parsePreviewMessage`: source, origin, shape and
    // type. Anything that is not this frame's own message is dropped.
    const message = parsePreviewMessage(event, { expectedSource: frame.contentWindow });
    if (!message) return;
    if (message.type === "ready") handlers.onReady?.();
    if (message.type === "runtime-error") {
      log.add(message.payload);
      handlers.onRuntimeErrors?.(log.describe());
    }
  };

  target.addEventListener("message", handler as EventListener);
  return () => target.removeEventListener("message", handler as EventListener);
}

/**
 * Runtime errors collected from one preview session.
 *
 * Bounded and de-duplicated. A render loop can throw the same error thousands
 * of times a second, and the repair prompt needs the distinct problems, not a
 * transcript of one of them repeated until the budget is gone.
 */
export class RuntimeErrorLog {
  private readonly seen = new Map<string, { count: number; error: RuntimeErrorPayload }>();
  constructor(private readonly limit = 20) {}

  add(error: RuntimeErrorPayload): void {
    const key = `${error.kind}:${error.message}`;
    const existing = this.seen.get(key);
    if (existing) { existing.count += 1; return; }
    if (this.seen.size >= this.limit) return;
    this.seen.set(key, { count: 1, error });
  }

  get entries(): Array<{ count: number; error: RuntimeErrorPayload }> {
    return [...this.seen.values()];
  }

  get isEmpty(): boolean { return this.seen.size === 0; }

  /** Formatted for a repair prompt: distinct problems, most frequent first. */
  describe(): string[] {
    return [...this.seen.values()]
      .sort((a, b) => b.count - a.count)
      .map(({ count, error }) =>
        `${error.kind}: ${error.message}${count > 1 ? ` (x${count})` : ""}`);
  }
}
