/**
 * The preview message channel: which window it listens on.
 *
 *   npx tsx --conditions=react-server scripts/v2/preview-channel.test.mts
 *
 * THE DEFECT. `AppPreview` listened on `window`. But `ViewportFrame` renders a
 * same-origin iframe and portals the preview into it, so the sandboxed app's
 * `parent` is that iframe's window — one document below the listener. Nothing
 * ever arrived. Found in production on 2026-08-12 by installing a listener on
 * each window in turn: the viewport window received
 * `{source:"ventrio-preview",type:"ready"}`, the top window received nothing.
 *
 * What that cost: `data-ready` never flipped, and `onRuntimeErrors` never
 * fired, so a generated app that threw at runtime reported nothing at all. The
 * preview looked fine while the one channel that could say otherwise was
 * disconnected — the worst shape a bug can have.
 *
 * WHAT THIS EXECUTES. `subscribePreview` for real, against a fake of the exact
 * three-window nesting production has. The messages are dispatched on the
 * viewport window, which is where a real sandboxed frame posts them, so a
 * listener attached to the wrong window fails here — case 1 asserts that
 * directly, and case 9 is the negative control that pins it.
 *
 * WHAT IT DOES NOT EXECUTE. React. There is no DOM in this repo's test
 * environment and adding one to render a single component is not a trade worth
 * making, so the `onReady → setReady → data-ready` binding inside the component
 * is pinned by reading the source (case 10). The half that broke — which window,
 * and what reaches the callbacks — runs.
 *
 * Offline. No network, no database, no provider.
 */

import { subscribePreview, PREVIEW_SOURCE, PREVIEW_PROTOCOL_VERSION, OPAQUE_ORIGIN } from "../../src/lib/v2/app/protocol";
import { readFileSync } from "node:fs";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

/* ── the nesting, faked exactly ──────────────────────────────────────────── */

/** Just enough Window to add, remove and dispatch a message listener. */
class FakeWindow {
  readonly listeners = new Set<(event: MessageEvent) => void>();
  constructor(readonly label: string) {}

  addEventListener(type: string, handler: EventListener): void {
    if (type === "message") this.listeners.add(handler as (event: MessageEvent) => void);
  }

  removeEventListener(type: string, handler: EventListener): void {
    if (type === "message") this.listeners.delete(handler as (event: MessageEvent) => void);
  }

  dispatch(event: unknown): void {
    for (const handler of [...this.listeners]) handler(event as MessageEvent);
  }
}

/**
 * top ─ the workspace page
 *  └─ viewport ─ ViewportFrame's same-origin iframe, where the preview lives
 *      └─ sandbox ─ the opaque-origin frame running the generated app
 */
function nesting() {
  const top = new FakeWindow("top");
  const viewport = new FakeWindow("viewport");
  const sandbox = new FakeWindow("sandbox");
  const frame = {
    ownerDocument: { defaultView: viewport },
    contentWindow: sandbox,
  } as unknown as HTMLIFrameElement;
  return { top, viewport, sandbox, frame };
}

/** A message shaped the way the sandboxed frame really sends one. */
const fromSandbox = (sandbox: FakeWindow, type: string, payload: unknown) => ({
  source: sandbox,
  origin: OPAQUE_ORIGIN,
  data: { source: PREVIEW_SOURCE, version: PREVIEW_PROTOCOL_VERSION, type, payload },
});

const ERROR = { kind: "TypeError", message: "chart.render is not a function", stack: "at Chart" };

/* ── 1. it listens where the messages actually arrive ────────────────────── */

{
  const { top, viewport, frame } = nesting();
  subscribePreview(frame, {});
  check("subscribes on the frame's own window", viewport.listeners.size === 1);
  check(
    "does not subscribe on the window above it",
    top.listeners.size === 0,
    `top had ${top.listeners.size} listeners — this is the original bug`,
  );
}

/* ── 2. ready reaches the callback that flips data-ready ─────────────────── */

{
  const { viewport, sandbox, frame } = nesting();
  let readyCount = 0;
  subscribePreview(frame, { onReady: () => { readyCount += 1; } });

  check("no ready before the app sends one", readyCount === 0);
  viewport.dispatch(fromSandbox(sandbox, "ready", {}));
  check("ready fires when the app mounts", readyCount === 1, `count ${readyCount}`);
}

/* ── 3. runtime errors reach the callback, described ─────────────────────── */

{
  const { viewport, sandbox, frame } = nesting();
  const seen: string[][] = [];
  subscribePreview(frame, { onRuntimeErrors: (messages) => seen.push(messages) });

  viewport.dispatch(fromSandbox(sandbox, "runtime-error", ERROR));
  check("a runtime error reaches the callback", seen.length === 1, `called ${seen.length} times`);
  check(
    "the error is described, not passed raw",
    seen[0]?.[0] === "TypeError: chart.render is not a function",
    JSON.stringify(seen[0]),
  );
}

/* ── 4. a render loop is deduplicated, not transcribed ───────────────────── */

{
  const { viewport, sandbox, frame } = nesting();
  let last: string[] = [];
  subscribePreview(frame, { onRuntimeErrors: (messages) => { last = messages; } });

  for (let i = 0; i < 3; i += 1) viewport.dispatch(fromSandbox(sandbox, "runtime-error", ERROR));
  viewport.dispatch(fromSandbox(sandbox, "runtime-error", { ...ERROR, message: "other" }));

  check("distinct errors are kept apart", last.length === 2, JSON.stringify(last));
  check("repeats are counted, not repeated", last[0]?.endsWith("(x3)") === true, JSON.stringify(last));
}

/* ── 5. the four checks still apply on this path ─────────────────────────── */

{
  const { viewport, sandbox, frame } = nesting();
  const other = new FakeWindow("someone-else");
  let ready = 0;
  let errors = 0;
  subscribePreview(frame, { onReady: () => { ready += 1; }, onRuntimeErrors: () => { errors += 1; } });

  // Another frame in the tab forging a ready.
  viewport.dispatch({ ...fromSandbox(sandbox, "ready", {}), source: other });
  check("a message from another window is dropped", ready === 0);

  // The right source but a real origin: not from the sandbox.
  viewport.dispatch({ ...fromSandbox(sandbox, "ready", {}), origin: "https://ventrio.org" });
  check("a message with a real origin is dropped", ready === 0);

  // Right envelope, unknown type.
  viewport.dispatch(fromSandbox(sandbox, "navigate", { to: "/admin" }));
  check("an unknown type is dropped", ready === 0 && errors === 0);

  // A runtime error whose message is not a string.
  viewport.dispatch(fromSandbox(sandbox, "runtime-error", { kind: "E", message: 42, stack: "" }));
  check("a malformed error payload is dropped", errors === 0);

  viewport.dispatch(fromSandbox(sandbox, "ready", {}));
  check("and a genuine message still gets through", ready === 1);
}

/* ── 6. teardown ─────────────────────────────────────────────────────────── */

{
  const { viewport, sandbox, frame } = nesting();
  let ready = 0;
  const stop = subscribePreview(frame, { onReady: () => { ready += 1; } });
  stop();

  check("teardown removes the listener", viewport.listeners.size === 0);
  viewport.dispatch(fromSandbox(sandbox, "ready", {}));
  check("nothing arrives after teardown", ready === 0);
}

/* ── 7. a frame that is not in a document ────────────────────────────────── */

{
  let threw = false;
  let stop: (() => void) | null = null;
  try {
    stop = subscribePreview(null, { onReady: () => {} });
    stop();
    stop = subscribePreview({ ownerDocument: null, contentWindow: null } as unknown as HTMLIFrameElement, {});
    stop();
  } catch {
    threw = true;
  }
  check("an unmounted frame is a no-op, not a crash", !threw);
}

/* ── 8. handlers are optional ────────────────────────────────────────────── */

{
  const { viewport, sandbox, frame } = nesting();
  let threw = false;
  subscribePreview(frame, {});
  try {
    viewport.dispatch(fromSandbox(sandbox, "ready", {}));
    viewport.dispatch(fromSandbox(sandbox, "runtime-error", ERROR));
  } catch {
    threw = true;
  }
  check("a subscriber with no handlers does not throw", !threw);
}

/* ── 9. negative control: the old wiring must fail ───────────────────────── */

/**
 * Without this the suite would pass against a `subscribePreview` that listened
 * on the top window *as well*, or on a window this fake never dispatches to.
 * This is the defect itself, reconstructed: listen where the old component
 * listened, send what the sandbox really sends, and require silence.
 */
{
  const { top, viewport, sandbox, frame } = nesting();
  let viaTop = 0;
  top.addEventListener("message", (() => { viaTop += 1; }) as EventListener);

  let viaFix = 0;
  subscribePreview(frame, { onReady: () => { viaFix += 1; } });
  viewport.dispatch(fromSandbox(sandbox, "ready", {}));

  check("the pre-fix listener receives nothing", viaTop === 0, `top saw ${viaTop} messages`);
  check("the fixed listener receives it", viaFix === 1, `fixed saw ${viaFix}`);
}

/* ── 10. the component wiring, read from source ──────────────────────────── */

const appPreview = readFileSync(new URL("../../src/components/workspace/AppPreview.tsx", import.meta.url), "utf8");

check(
  "AppPreview no longer listens on the page window",
  !/\bwindow\.addEventListener\b/.test(appPreview),
  "a bare window.addEventListener is back",
);

check("AppPreview subscribes through subscribePreview", /subscribePreview\(frameRef\.current/.test(appPreview));

// The binding this file cannot execute: ready must come from the channel, and
// data-ready must come from ready. Both halves are asserted so neither can be
// quietly decoupled from the other.
check(
  "onReady sets the ready state",
  /onReady:\s*\(\)\s*=>\s*setReady\(true\)/.test(appPreview),
);

check(
  "data-ready renders that state",
  /data-ready=\{ready \? "true" : "false"\}/.test(appPreview),
);

check(
  "the caller's onRuntimeErrors is the one subscribed",
  /subscribePreview\([\s\S]{0,120}onRuntimeErrors\s*[,}]/.test(appPreview),
);

/* ── report ──────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`preview-channel: ${failures.length} failed, ${passed} passed`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`preview-channel: ${passed} checks passed`);
