/**
 * What a failing preview says, and to whom.
 *
 *   npx tsx --conditions=react-server scripts/v2/preview-failure.test.mts
 *
 * TWO DEFECTS THIS PINS, both of which turned a runtime error into a blank
 * screen with nothing to explain it.
 *
 *   1. `ready` was posted on the line after `render()`. React 19 renders
 *      concurrently: `render()` returns before anything is committed and does
 *      not throw when a component does, so an app that crashed on its first
 *      pass still announced itself ready. The host cleared its boot overlay and
 *      the person was left with a white rectangle. Every first-render crash
 *      looked like this, including the "/" URL failure.
 *   2. The published page listened for nothing at all. A visitor to a broken
 *      app got the same white rectangle, with no way to tell a slow app from a
 *      dead one, and the owner had no idea it was happening.
 *
 * Offline. That the entry actually behaves this way in a browser is a browser
 * claim and is proved by `router-proof.mts`, which crashes a real app inside a
 * real opaque-origin frame and checks that `ready` never arrives.
 */

import { readFileSync } from "node:fs";
import { describedFailureOrigin, runtimeFailureOrigin } from "../../src/lib/v2/app/protocol";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

/* ── 1. the entry announces readiness only when something rendered ───────── */

const compile = code(read("src/lib/v2/app/compile.ts"));

check(
  "readiness is gated on the root having children",
  /childElementCount\s*(===\s*0|>\s*0)/.test(compile),
  "a ready posted before the first commit is a claim the app is running when it may have died",
);
check(
  "the ready message is not posted immediately after render()",
  !/\.render\([^)]*\)\s*;?\s*window\.parent\.postMessage/.test(compile),
);
/**
 * Observed, not polled on a frame budget. The first version of this fix gave up
 * after about a second of animation frames, which made a real 2.3 MB
 * application — measured booting in roughly three seconds — never announce
 * readiness at all. That trades a preview that lies about being ready for one
 * that lies about never starting.
 */
check("readiness is observed rather than polled on a frame budget",
  /MutationObserver/.test(compile) && !/__frames/.test(compile));
check("the observer watches the mount point for children",
  /childList: true/.test(compile));
check("it stops observing eventually", /__observer\.disconnect\(\)/.test(compile));
check("readiness is also checked synchronously first",
  /if \(!__announceReady\(\)/.test(compile),
  "a small app can commit before the observer is installed");

/**
 * React 19 surfaces render failures through these options rather than by
 * throwing from `render()`. Without them a component that dies on its first
 * pass produces only an anonymous window error with no React context.
 */
check("createRoot is given onUncaughtError", /onUncaughtError/.test(compile));
check("createRoot is given onCaughtError", /onCaughtError/.test(compile));
check("render failures are reported", /report\("render"/.test(compile));

/**
 * The document's watchdog cancels itself when it sees the app start. The entry
 * has to tell it, or a healthy but slow app gets reported as never having
 * started.
 */
check("the entry marks the document's watchdog", /__ventrioStarted/.test(compile));
check("the entry sets the ready flag the watchdog reads", /__ventrioReady/.test(compile));

/* ── 2. whose failure it was ─────────────────────────────────────────────── */

/**
 * Delivery failures are Ventrio's: the module graph is Ventrio's bytes and the
 * import map is Ventrio's. These are the wordings the three engines produce,
 * and none of them is catchable in the app's own code.
 */
const DELIVERY = [
  "Failed to resolve module specifier 'recharts'",
  "TypeError: Failed to fetch dynamically imported module",
  "Error resolving module specifier – 'lucide-react'",
  "Importing a module script failed.",
  "Failed to load module script: expected a JavaScript module",
  "Unable to resolve specifier 'date-fns'",
  "The requested module does not provide an export named 'motion'",
];
for (const message of DELIVERY) {
  check(
    `"${message.slice(0, 44)}…" is Ventrio's`,
    runtimeFailureOrigin({ kind: "TypeError", message, stack: "" }) === "runtime",
  );
}

/**
 * Everything else belongs to the app. That is the safe default: calling a
 * generated bug ours is a smaller error than calling ours theirs.
 */
const APP = [
  "Cannot read properties of undefined (reading 'map')",
  "x is not a function",
  "Maximum update depth exceeded",
  "The application did not start. Its code loaded but nothing rendered.",
  'Failed to construct \'URL\': Invalid URL',
  '"/" cannot be parsed as a URL',
];
for (const message of APP) {
  check(
    `"${message.slice(0, 44)}…" is the app's`,
    runtimeFailureOrigin({ kind: "TypeError", message, stack: "" }) === "app",
  );
}

/* ── 3. the two surfaces classify identically ────────────────────────────── */

/**
 * The workspace and the published page both receive `describe()` output rather
 * than payloads. They must reach the same verdict about the same failure, or a
 * visitor and an owner are told different things about one event.
 */
check(
  "a delivery failure in a described log is Ventrio's",
  describedFailureOrigin(["TypeError: Failed to resolve module specifier 'clsx' (x3)"]) === "runtime",
);
check(
  "an app failure in a described log is the app's",
  describedFailureOrigin(["TypeError: x is not a function (x2)"]) === "app",
);
check(
  "one delivery failure anywhere decides the whole log",
  describedFailureOrigin([
    "TypeError: x is not a function",
    "TypeError: Failed to resolve module specifier 'clsx'",
  ]) === "runtime",
  "everything else is downstream of a graph that never resolved",
);
check("an empty log is not a Ventrio failure", describedFailureOrigin([]) === "app");

/* ── 4. the published page states the failure ────────────────────────────── */

const publicFrame = read("src/components/publishing/PublicAppMonitor.tsx");
const publicView = read("src/components/publishing/PublicAppView.tsx");

check("the published frame subscribes to the preview protocol", /subscribePreview/.test(publicFrame));
check("it listens for runtime errors", /onRuntimeErrors/.test(publicFrame));
check("it uses the shared classifier", /describedFailureOrigin/.test(publicFrame));
check(
  "it does not carry its own copy of the classification",
  !/failed to resolve module specifier/i.test(publicFrame),
  "a second copy of the pattern would answer differently the first time either was edited",
);
check("it renders a failure state", /role="alert"/.test(publicFrame));
check("it offers a reload", /location\.reload/.test(publicFrame));
check("it distinguishes the two origins", /runtimeFailedTitle/.test(publicFrame) && /appFailedTitle/.test(publicFrame));

/**
 * An app that mounted and then threw is still usable. Covering a working page
 * with an error panel would be a worse outcome than the error itself.
 */
check(
  "the failure state only replaces an app that never appeared",
  /!running\s*&&\s*\(failure !== null \|\| stalled\)/.test(code(publicFrame)),
);

/** No stack traces, no internal detail, to a stranger. */
check("no stack is shown to a visitor", !/\bstack\b/.test(code(publicFrame)));

check("the copy is resolved on the server", /getTranslations/.test(publicView));
check("the view passes the publication's locale", /locale/.test(publicView));

/* ── 5. the sandbox boundary is unchanged ────────────────────────────────── */

// The frame is rendered by the server view; the monitor fills it. Each half is
// asserted where it actually lives.
check("the published frame still uses the shared sandbox attribute", /SANDBOX_ATTRIBUTE/.test(publicView));
// Comments stripped: the files' doc comments explain that same-origin is never
// granted, and matching that sentence would pass the check by describing it.
check("the view never asks for same-origin", !/allow-same-origin/.test(code(publicView)));
check("the monitor never asks for same-origin", !/allow-same-origin/.test(code(publicFrame)));
check("neither hardcodes sandbox tokens of its own",
  !/allow-scripts/.test(code(publicView)) && !/allow-scripts/.test(code(publicFrame)));
check("it is still a srcdoc frame, never given an address",
  /\.srcdoc\s*=/.test(code(publicFrame)) && !/<iframe[^>]*\ssrc=/.test(code(publicView)));

/* ── 6. the copy exists in both locales ──────────────────────────────────── */

const KEYS = ["appLoading", "appFailedTitle", "appFailedBody", "appRuntimeFailedTitle", "appRuntimeFailedBody", "appReload"];
for (const locale of ["en", "ru"]) {
  const messages = JSON.parse(read(`messages/${locale}.json`)) as { publishing: Record<string, string> };
  for (const key of KEYS) {
    const value = messages.publishing[key];
    check(`${locale}: publishing.${key} exists`, typeof value === "string" && value.trim().length > 0);
  }
}

/* ── report ──────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} failed, ${passed} passed\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`✓ preview failure: ${passed} checks passed`);
