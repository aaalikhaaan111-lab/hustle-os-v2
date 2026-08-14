/**
 * The preview that went blank after a generation.
 *
 *   npx tsx scripts/preview-nonce.test.mts
 *
 * THE REPORTED BUG. Generate an app: the preview appears, then becomes nothing
 * but the app's background colour. Reloading the frame does not help. Reloading
 * the whole Ventrio page does.
 *
 * THE CAUSE. A `srcdoc` frame inherits the embedding page's CSP, which is a
 * response header and therefore fixed for the life of the document. Ventrio
 * allows scripts only by nonce and uses `'strict-dynamic'`, so `'self'` is
 * inert and the nonce is the only way a script runs. The preview document,
 * however, is rebuilt on every server render from `headers()` — and
 * `router.refresh()`, which the workspace fires the moment a generation
 * succeeds, is a new request carrying a new nonce. The page still trusts only
 * the nonce it was served with, so the rebuilt document's scripts are refused:
 * the stylesheet applies, React never mounts, the frame renders styled and
 * empty. The frame reload re-parses the same rejected document; only a new page
 * load gets a policy and a document that agree.
 *
 * The asymmetry in the symptoms is the whole diagnosis: the broken state
 * survives a frame reload and not a document reload, so it lives in the page's
 * policy, not in the frame.
 *
 * Offline. Pure string work — `withLiveNonce` takes the live nonce as an
 * argument precisely so this needs no DOM.
 */

import { withLiveNonce } from "../src/lib/workspace/previewNonce";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

/** Two nonces of the shape the middleware emits: base64 of a UUID. */
const SERVED = "ZTE2OTE4MWEtMmQ5Yi00YTVjLTlhMmYtMDRmNjNjYWNlMGM1";
const REFRESHED = "ZmYwNmRkOWItNzlmMi00ZWNjLWE2YjMtNzRhYzE1ZjczNThi";

const documentWith = (nonce: string) =>
  `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'">`
  + `<style>body{background:#0e1016}</style>`
  + `<script nonce="${nonce}">window.__ventrioAssets = {};</script>`
  + `</head><body><div id="root"></div>`
  + `<script nonce="${nonce}" type="module">/* bundle */</script>`
  + `<script nonce="${nonce}">/* boot */</script>`
  + `</body></html>`;

/* ── 1. the path that already worked must not change ─────────────────────── */

// First render: the document was built in the same request that set the CSP, so
// the two nonces are one value. Returning anything else here would reboot a
// working frame and, on the server pass, desynchronise hydration.
const fresh = documentWith(SERVED);
check("a document whose nonce matches the page is returned untouched",
  withLiveNonce(fresh, SERVED) === fresh);

// Server render: no DOM, so no live nonce. The server's own nonce is correct
// for the document it is producing at that moment.
check("with no live nonce the document is untouched", withLiveNonce(fresh, undefined) === fresh);
check("and an empty live nonce counts as none", withLiveNonce(fresh, "") === fresh);

/* ── 2. the refreshed document is made runnable ──────────────────────────── */

const refreshed = documentWith(REFRESHED);
const repaired = withLiveNonce(refreshed, SERVED);

check("a document rebuilt under a new nonce is re-stamped", repaired !== refreshed);
check("every Ventrio script carries the page's nonce",
  (repaired.match(new RegExp(`nonce="${SERVED}"`, "g")) ?? []).length === 3,
  repaired.slice(0, 120));
check("and none of the refreshed request's nonce survives",
  !repaired.includes(REFRESHED));

// The point of the exercise: what the page will actually execute.
check("the boot script would now be allowed to run", repaired.includes(`<script nonce="${SERVED}">/* boot */</script>`));
check("the module bundle too", repaired.includes(`<script nonce="${SERVED}" type="module">`));

/* ── 3. nothing else is rewritten ────────────────────────────────────────── */

// Only the exact attribute the builder wrote is replaced. Model-authored markup
// is escaped before it reaches the document and cannot carry a nonce attribute,
// but the replacement is scoped anyway rather than trusting that.
const withProse = documentWith(REFRESHED).replace(
  "<div id=\"root\"></div>",
  `<div id="root">the word nonce="${REFRESHED}x" inside text</div>`,
);
const proseRepaired = withLiveNonce(withProse, SERVED);
check("a nonce-shaped string that is not the builder's attribute is left alone",
  proseRepaired.includes(`nonce="${REFRESHED}x"`));

check("a document with no nonce at all is untouched",
  withLiveNonce("<!doctype html><html><body>nothing</body></html>", SERVED)
    === "<!doctype html><html><body>nothing</body></html>");

/* ── 4. the inner policy and the sandbox are not the mechanism ───────────── */

// Stated so a future reader does not "fix" this by loosening either. The frame
// keeps its own meta CSP and its opaque origin; this only corrects which nonce
// the OUTER policy will accept.
check("the inner Content-Security-Policy survives the rewrite",
  repaired.includes(`<meta http-equiv="Content-Security-Policy"`));
check("and no nonce is invented — the value written is the page's own",
  repaired.includes(SERVED) && !repaired.includes(REFRESHED));

/* ── report ──────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`preview nonce: ${failures.length} failed, ${passed} passed`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`preview nonce: ${passed} checks passed`);
