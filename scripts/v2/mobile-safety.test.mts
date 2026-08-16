/**
 * The mobile safety floor every generated application gets.
 *
 *   npx tsx --conditions=react-server scripts/v2/mobile-safety.test.mts
 *
 * THE BUG. A published app could be dragged sideways on a real iPhone — the
 * page itself was wider than the viewport. Desktop was fine, which is why it
 * shipped.
 *
 * WHY DESKTOP WAS FINE. `overflow-x: hidden` was set on `body` only. The spec
 * propagates body's overflow to the viewport when `html` is `visible`, so Chrome
 * clipped and there was nothing to see. But propagation also makes the body's
 * own overflow `visible` again, and WebKit will still touch-pan the document
 * when content genuinely sticks out. Body-only is a desktop-shaped fix.
 *
 * WHAT THE GENERATED APPS ACTUALLY DO, measured on two real published projects:
 * they style with Tailwind utilities and cover only some breakpoints. Watch
 * Party Club carries an unconditional `grid-cols-3` and a `w-96` (384 px);
 * Свободный Баланс carries `grid-cols-7` and a hard `min-w-[600px]`. Both also
 * use `overflow-x-auto`, so some of that width is deliberate — a table meant to
 * scroll inside its own container.
 *
 * That distinction is the whole design of this floor: the PAGE must not scroll,
 * and an inner scroller must keep working. Proved in a browser at 390 px and
 * 320 px, with a `min-width: 600px` element present: page overflow 0, inner
 * `overflow-x: auto` still scrolling, the wide element still in the DOM.
 *
 * Offline. The iOS half is a real-device claim and is not asserted here.
 */

import { buildSandboxDocument } from "../../src/lib/v2/app/sandbox";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const doc = buildSandboxDocument({
  code: "",
  runtimeCore: "export const __libs = {};",
  runtimeNames: {},
  lang: "en",
  title: "Mobile safety",
});

/* ── the viewport is respected ───────────────────────────────────────────── */

check("the document declares the device viewport",
  /<meta name="viewport" content="width=device-width, initial-scale=1">/.test(doc));
check("and does not lock zoom",
  !/user-scalable=no/.test(doc) && !/maximum-scale=1/.test(doc),
  "pinch-zoom is an accessibility affordance, not a layout bug to suppress");

/* ── the page cannot scroll sideways ─────────────────────────────────────── */

check("html cannot scroll horizontally",
  /html\{overflow-x:hidden\}/.test(doc),
  "body alone is a desktop-shaped fix: it propagates to the viewport but WebKit still pans the document");
check("body cannot either", /body\{[^}]*overflow-x:hidden/.test(doc));
check("and body is bounded by the viewport", /body\{[^}]*max-width:100%/.test(doc));
check("the mount point is bounded too", /#root\{[^}]*max-width:100%/.test(doc));
check("and clips rather than widening the page", /#root\{[^}]*overflow-x:hidden/.test(doc));

/* ── what must keep working ──────────────────────────────────────────────── */

/**
 * The floor is applied to `html`, `body` and `#root` only. Nothing here touches
 * a descendant's overflow, so a wrapper with `overflow-x: auto` — the shape a
 * model puts around a wide table, present in both apps measured — keeps its own
 * scrollbar. Verified in a browser rather than inferred: at 390 px, with a
 * `min-width: 600px` table inside a scroller, the scroller still scrolled while
 * the page did not.
 */
check("no rule reaches into descendants' overflow",
  !/\*\s*\{[^}]*overflow/.test(doc),
  "a universal overflow rule would break every legitimate inner scroller");
check("media still shrinks to fit", /img,svg,video,canvas\{max-width:100%/.test(doc));
check("and keeps its aspect ratio", /max-width:100%;height:auto/.test(doc));
check("a long unbroken string cannot widen the page", /overflow-wrap:break-word/.test(doc));
check("box-sizing is still border-box everywhere", /\*,\*::before,\*::after\{box-sizing:border-box\}/.test(doc));
check("the app still fills the viewport height", /#root\{min-height:100vh/.test(doc));

/* ── the boundaries this must not have moved ─────────────────────────────── */

check("the inner CSP is unchanged", /connect-src &#39;none&#39;/.test(doc));
check("the document is still a sandbox document", /Content-Security-Policy/.test(doc));

/* ── report ──────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} failed, ${passed} passed\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`✓ mobile safety: ${passed} checks passed`);
