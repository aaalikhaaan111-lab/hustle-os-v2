/**
 * The regression for `TypeError: "/" cannot be parsed as a URL`.
 *
 *   npx tsx scripts/v2/preview-base-url.test.mts
 *
 * WHAT WENT WRONG. A generated app runs in a `srcdoc` frame with no
 * `allow-same-origin`, so the document's URL is `about:srcdoc` and its origin
 * serialises as the string `"null"`. Both are cannot-be-a-base URLs. Everything
 * that resolved a path against either one threw — react-router first, during
 * render, which meant one `<Link to="/">` was enough to blank the preview on
 * first paint. Chrome words the throw "Failed to construct 'URL': Invalid URL";
 * WebKit words it '"/" cannot be parsed as a URL', which is what a beta user on
 * iOS reported.
 *
 * This file evaluates the REAL bootstrap script that ships in the document —
 * imported, not re-typed — against a fake global, and checks that the document
 * installs it before anything that depends on it.
 *
 * Offline. No provider, no browser, no network. The claim that a routed
 * application actually mounts and navigates is a browser claim and is proved by
 * `router-proof.mts`, which runs the driver inside a real opaque-origin frame.
 */

import { runInNewContext } from "node:vm";
import {
  BASE_URL_BOOTSTRAP,
  SANDBOX_BASE_URL,
  buildSandboxDocument,
} from "../../src/lib/v2/app/sandbox";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

/* ── 1. the premise: these really do throw without the shim ──────────────── */

/**
 * Pinned deliberately. If a future platform ever makes these resolve on their
 * own, this test fails and tells the next person the shim may be removable —
 * rather than leaving a workaround nobody can justify.
 */
const UNUSABLE_BASES: Array<[string, string | undefined]> = [
  ["no base", undefined],
  ["about:srcdoc", "about:srcdoc"],
  ["about:blank", "about:blank"],
  ['opaque origin ("null")', "null"],
  ["empty string", ""],
];
for (const [label, base] of UNUSABLE_BASES) {
  let threw = false;
  try { void (base === undefined ? new URL("/") : new URL("/", base)); } catch { threw = true; }
  check(`native URL still throws for "/" against ${label}`, threw);
}

/* ── 2. the shipped script, evaluated ────────────────────────────────────── */

/**
 * A context with the real `URL` and nothing else the script needs. Evaluating
 * the exported constant is the point: a test that reimplemented the logic would
 * pass while the document shipped something different.
 */
function installed(): { URL: typeof URL; webkitURL?: unknown } {
  const context: Record<string, unknown> = { URL, webkitURL: URL };
  runInNewContext(BASE_URL_BOOTSTRAP, context);
  return context as { URL: typeof URL; webkitURL?: unknown };
}

const { URL: Patched, webkitURL } = installed();

check("the script replaces URL", Patched !== URL);
check("webkitURL is replaced too", webkitURL === Patched);

/* ── 3. relative paths resolve against the synthetic base ────────────────── */

// Every shape the product promises a generated app may use.
const RELATIVE: Array<[string, string]> = [
  ["/", `${SANDBOX_BASE_URL}`],
  ["/dashboard", `${SANDBOX_BASE_URL}dashboard`],
  ["/settings", `${SANDBOX_BASE_URL}settings`],
  ["/projects/atlas?tab=1#top", `${SANDBOX_BASE_URL}projects/atlas?tab=1#top`],
  ["#/hash-route", `${SANDBOX_BASE_URL}#/hash-route`],
  ["./relative.png", `${SANDBOX_BASE_URL}relative.png`],
  ["nested/thing", `${SANDBOX_BASE_URL}nested/thing`],
];
for (const [input, expected] of RELATIVE) {
  for (const [label, base] of UNUSABLE_BASES) {
    let href = "";
    let error = "";
    try { href = (base === undefined ? new Patched(input) : new Patched(input, base)).href; }
    catch (e) { error = e instanceof Error ? e.message : String(e); }
    check(`"${input}" resolves against ${label}`, href === expected, error || href);
  }
}

/* ── 4. what must NOT change ─────────────────────────────────────────────── */

// An absolute URL keeps its own origin even when the base is unusable.
check(
  "absolute URL is untouched",
  new Patched("https://example.com/a?b#c", "null").href === "https://example.com/a?b#c",
);
check(
  "protocol-relative URL keeps the base's scheme",
  new Patched("//cdn.example.com/x", "https://real.example/deep").href === "https://cdn.example.com/x",
);
// A usable base still wins; the synthetic one is a fallback, not an override.
check(
  "a real base still resolves normally",
  new Patched("/z", "https://real.example/deep/page").href === "https://real.example/z",
);
check(
  "a real base with a path resolves relatively",
  new Patched("sibling", "https://real.example/deep/page").href === "https://real.example/deep/sibling",
);

/**
 * A malformed URL must still throw.
 *
 * The temptation with a shim like this is to make it never fail. That would
 * mean a generated app with a genuine URL bug renders something wrong instead
 * of reporting something broken, and the runtime error channel — the only way
 * anyone finds out — goes quiet.
 */
// Note what is NOT in this list: "ht tp://x" and similar. Those are valid
// *relative references* — a path segment containing a space — and resolving
// them is correct, not a swallowed error.
for (const garbage of ["http://", "https://", "http://[", "https://%"]) {
  let threw = false;
  try { new Patched(garbage); } catch { threw = true; }
  check(`malformed "${garbage}" still throws`, threw);
}

/* ── 5. the platform surface the rest of the document depends on ─────────── */

check("createObjectURL is still reachable", typeof Patched.createObjectURL === "function");
check("revokeObjectURL is still reachable", typeof Patched.revokeObjectURL === "function");
check("canParse is still reachable", typeof Patched.canParse === "function");
check("instances are instanceof the patched URL", new Patched("/") instanceof Patched);
check("instances are still instanceof native URL", new Patched("/") instanceof URL);
check("searchParams still works", new Patched("/a?x=1").searchParams.get("x") === "1");
check("pathname is what a router reads", new Patched("/a/b?c#d").pathname === "/a/b");

/* ── 6. the document installs it, and installs it first ──────────────────── */

const document_ = buildSandboxDocument({
  code: "console.log('app');",
  runtimeCore: "export const __libs = {};",
  runtimeNames: { react: ["useState"] },
  lang: "en",
  title: "Ordering",
  nonce: "dGVzdC1ub25jZS12YWx1ZS0xMjM0",
});

check("the document carries the bootstrap", document_.includes(SANDBOX_BASE_URL));

const atBootstrap = document_.indexOf(SANDBOX_BASE_URL);
const atImportMap = document_.indexOf("createObjectURL");
const atModule = document_.indexOf('<script type="module"');
const atReporter = document_.indexOf("DidNotStart");

check("bootstrap comes before the import-map shim", atBootstrap > -1 && atBootstrap < atImportMap,
  `${atBootstrap} vs ${atImportMap}`);
check("bootstrap comes before the app module", atBootstrap > -1 && atBootstrap < atModule,
  `${atBootstrap} vs ${atModule}`);
check("bootstrap comes before the error reporter", atBootstrap > -1 && atBootstrap < atReporter,
  `${atBootstrap} vs ${atReporter}`);

/**
 * The bootstrap is Ventrio's own script, so it carries the request nonce like
 * the other two. Without it the page's CSP refuses it and the document loses
 * the shim silently — which is the failure mode `previewNonce.ts` exists for.
 */
const bootstrapTag = document_.slice(document_.lastIndexOf("<script", atBootstrap), atBootstrap);
check("the bootstrap script carries the nonce", bootstrapTag.includes('nonce="dGVzdC1ub25jZS12YWx1ZS0xMjM0"'),
  bootstrapTag);

/* ── 7. the boundaries this must not have moved ──────────────────────────── */

// The policy is written into an HTML attribute, so its quotes are entity-escaped
// by the time they reach the document. Asserting the raw form would pass only by
// accident of how the meta tag is built.
check("the inner CSP still denies the network", document_.includes("connect-src &#39;none&#39;"));
check("the inner CSP still denies a base element", document_.includes("base-uri &#39;none&#39;"));
check("the synthetic origin is unresolvable by construction", SANDBOX_BASE_URL.includes(".invalid/"));

/* ── report ──────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} failed, ${passed} passed\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`✓ preview base URL: ${passed} checks passed`);
