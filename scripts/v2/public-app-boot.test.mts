/**
 * How a published application is delivered, and what happens when it does not
 * start.
 *
 *   npx tsx --conditions=react-server scripts/v2/public-app-boot.test.mts
 *
 * THE FAILURE THIS EXISTS FOR. On a real iPhone — Safari and Chrome alike, so
 * WebKit, not a browser UI — a published app that works on desktop showed
 * "Starting the app…" indefinitely and then iOS's own "This page couldn't load".
 * The same app rendered fine in the authenticated workspace on the same phone.
 *
 * Two causes, both measured rather than guessed:
 *
 *   1. SIZE. The document was embedded in the page, and React Server Components
 *      serialise the server tree as flight data alongside the HTML — so it
 *      shipped twice. One real publication was 5.6 MB of markup for a 2.4 MB
 *      document, parsed in one go, on a dynamic route that pays it every visit.
 *      The workspace escapes this because its preview is behind a toggle, so the
 *      frame is never server-rendered. That is the whole difference.
 *
 *   2. THE RUNTIME WAS BUILT FROM THE DECLARATION. Models declare every library
 *      on the menu; the apps measured imported two or three. Watch Party Club
 *      shipped 1956 kB of runtime to use 1110 kB of it.
 *
 * And one behaviour that turned both into a hang rather than a message: the boot
 * overlay was cleared by the frame's `load` event, which never fires when the
 * renderer is in trouble.
 *
 * Offline. Real-device behaviour is a real-device claim and is not asserted here.
 */

import { readFileSync } from "node:fs";
import { APP_FIXTURES } from "../../src/lib/v2/app/fixtures";
import { compileGeneratedApp } from "../../src/lib/v2/app/compile";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const view = read("src/components/publishing/PublicAppView.tsx");
const monitor = read("src/components/publishing/PublicAppMonitor.tsx");
const monitorCode = code(monitor);
const route = read("src/app/p/[slug]/app-document/route.ts");
const page = code(read("src/app/p/[slug]/page.tsx"));
const css = read("src/app/globals.css");
const pipeline = code(read("src/lib/v2/app/pipeline.ts"));

/* ── 1. the document is not embedded in the page ─────────────────────────── */

check("the public page no longer builds the document",
  !/buildGeneratedApp/.test(page),
  "embedding it is what shipped it twice");
check("the view takes a slug, not a document", /slug: string/.test(view) && !/document: string/.test(view));
check("the view passes a document URL to the monitor", /documentUrl=/.test(view));
check("no component renders srcDoc from a prop",
  !/srcDoc=\{/.test(view) && !/srcDoc=\{/.test(monitorCode),
  "a srcdoc prop on a client component is what RSC serialises twice");
check("the frame is attached as a DOM property instead", /\.srcdoc\s*=/.test(monitorCode));

/* ── 2. the document route is inert by construction ──────────────────────── */

check("the document route exists", route.length > 0);
check("it is served as text/plain",
  /"Content-Type":\s*"text\/plain/.test(route),
  "text/html here would make model-written code a loadable page on Ventrio's origin");
check("with nosniff, so that is not merely advisory", /X-Content-Type-Options["\s:]+.{0,4}nosniff/.test(route));
check("and noindex", /X-Robots-Tag/.test(route));
check("it is never prerendered", /dynamic\s*=\s*"force-dynamic"/.test(route));
check("it applies the same slug gate as the page", /isPublicSlug/.test(route));
check("and only serves a live publication", /getPublicProject/.test(route));
check("a missing publication is a 404, not a blank document", /404/.test(route));
check("the 404 is text/plain too", /"Content-Type":\s*"text\/plain[^}]*404|404[\s\S]{0,200}text\/plain/.test(route));

/* ── 3. the sandbox boundary is untouched ────────────────────────────────── */

check("the frame still uses the shared sandbox attribute", /SANDBOX_ATTRIBUTE/.test(view));
check("it never asks for same-origin", !/allow-same-origin/.test(code(view)));
check("the document route does not render an HTML page", !/text\/html/.test(route));

/* ── 4. the nonce survives arriving on a different request ───────────────── */

/**
 * A `srcdoc` frame inherits the EMBEDDING page's CSP. The document is now
 * fetched separately, so the nonce baked into it belongs to that request — and
 * a document whose nonce does not match the page loads, applies its stylesheet,
 * and runs no script at all. That is the exact failure `previewNonce.ts` was
 * written for in the workspace.
 */
check("the monitor re-stamps the nonce before attaching", /withLiveNonce\(/.test(monitorCode));
check("the route still stamps a nonce to re-stamp", /x-nonce/.test(route));

/* ── 5. the page can never spin forever ──────────────────────────────────── */

check("the deadline is a timer, not the frame's load event",
  /setTimeout\(\(\) => setStalled\(true\), deadlineMs\)/.test(monitorCode),
  "load never fires when the renderer is in trouble, which is exactly this case");
check("the overlay is not gated on onLoad", !/onLoad=\{/.test(monitorCode));
check("a stalled boot renders the failure state", /stalled/.test(monitorCode) && /public-app-failed/.test(monitor));
check("with a retry", /location\.reload/.test(monitorCode));

/**
 * The monitor can only speak once it has hydrated, and the failure it reports
 * on is one where hydration may never happen. The CSS fallback is the only
 * thing underneath that, and it must involve no JavaScript at all.
 */
check("a server-rendered fallback exists", /ventrio-boot-fallback/.test(view));
check("it is revealed by CSS, not script", /animation:\s*ventrio-boot-fallback-in/.test(css));
check("after the monitor's own deadline", /ventrio-boot-fallback-in 0s linear 35s forwards/.test(css));
check("and is cancelled when the host is alive",
  /\[data-ventrio-host="alive"\][\s\S]{0,120}display:\s*none/.test(css));
check("which the monitor sets on mount", /data-ventrio-host["'\s,)]*,\s*"alive"/.test(monitorCode));

/* ── 6. a failure says which step it reached ─────────────────────────────── */

for (const phase of ["fetching", "attached", "frame-loaded", "running", "fetch-failed"]) {
  check(`"${phase}" is a distinguishable boot phase`, new RegExp(`"${phase}"`).test(monitorCode));
}
check("the phase is exposed on the failure element", /data-phase=/.test(monitorCode));
check("and shown to the person reporting it", /public-app-diagnostic/.test(monitor));
check("a delivery failure is attributed to Ventrio, not the app",
  /setFailure\("runtime"\)/.test(monitorCode),
  "a document Ventrio could not fetch is not the generated app's bug");
check("no stack is shown to a visitor", !/\bstack\b/.test(monitorCode));

/**
 * `ready` is posted once and never repeated. Subscribing after assigning the
 * document loses it for any app that boots quickly — the workspace lost exactly
 * that race once.
 */
const subscribeAt = monitorCode.indexOf("subscribePreview");
const attachAt = monitorCode.indexOf(".srcdoc =");
check("the monitor subscribes before attaching the document",
  subscribeAt > -1 && attachAt > -1 && subscribeAt < attachAt,
  `${subscribeAt} vs ${attachAt}`);

/* ── 7. the runtime carries only what the graph imports ──────────────────── */

check("the pipeline builds from the compiled graph", /compiled\.externals/.test(pipeline));
check("and no longer from the declaration",
  !/app\.runtime\.dependencies/.test(pipeline),
  "models declare every library on the menu");

/**
 * Measured against the fixtures, which are the only apps whose imports are
 * fixed and known. `router` imports react-router-dom and lucide-react and
 * nothing else; if the resolver ever starts reporting more, the runtime grows
 * silently and this is where it shows up.
 */
const EXPECTED: Record<string, string[]> = {
  router: ["clsx", "lucide-react", "react", "react-dom/client", "react-router-dom", "react/jsx-runtime"],
  timeline: ["clsx", "lucide-react", "react", "react-dom/client", "react/jsx-runtime"],
};
for (const [id, expected] of Object.entries(EXPECTED)) {
  const compiled = await compileGeneratedApp(APP_FIXTURES[id as keyof typeof APP_FIXTURES]);
  if (!compiled.ok) { check(`${id} compiles`, false, compiled.code); continue; }
  check(`${id}: the resolver reports exactly what it imports`,
    JSON.stringify(compiled.externals) === JSON.stringify(expected),
    `got ${JSON.stringify(compiled.externals)}`);
  const declared = APP_FIXTURES[id as keyof typeof APP_FIXTURES].runtime.dependencies;
  check(`${id}: never widens to the declaration`,
    compiled.externals.every((s) => s === "react-dom/client" || s === "react/jsx-runtime" || declared.includes(s)),
    "an external outside the declaration would mean the validator and bundler disagree");
}

/**
 * The heavy libraries are the reason this matters. An app that imports neither
 * must not be paying for them.
 */
const timeline = await compileGeneratedApp(APP_FIXTURES.timeline);
if (timeline.ok) {
  check("an app that charts nothing does not ship recharts", !timeline.externals.includes("recharts"));
  check("an app that animates nothing does not ship framer-motion", !timeline.externals.includes("framer-motion"));
}

/* ── report ──────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} failed, ${passed} passed\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`✓ public app boot: ${passed} checks passed`);
