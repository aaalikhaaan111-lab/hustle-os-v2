/**
 * The workspace as an app window rather than a web page.
 *
 *   npx tsx --conditions=react-server scripts/mobile-shell.test.mts
 *
 * THREE THINGS A REAL IPHONE SHOWED, which look like one thing and are not.
 *
 *   1. THE SHELL JUMPED. It was sized with `100dvh`, and `dvh` *tracks* the
 *      viewport as Safari collapses and expands its URL bar — so the layout
 *      resized on every scroll gesture. `100svh` is the stable one.
 *   2. THE KEYBOARD HID THE CONVERSATION. Neither `svh` nor `dvh` reacts to a
 *      keyboard: both describe the LAYOUT viewport, and iOS opens the keyboard
 *      over the page without changing it. The shell stayed full height, iOS
 *      scrolled the composer into view, and the conversation went off the top —
 *      a screen that was mostly composer. `visualViewport` is the only thing
 *      that knows, so its height is published and the shell uses it.
 *   3. THE PREVIEW OPENED AS A DESKTOP. `device` defaulted to `"desktop"`, so a
 *      phone showed its own app rendered at desktop width and scaled down — and
 *      the device toggles are hidden on narrow screens, so that default was not
 *      merely wrong, it was unreachable.
 *
 * Offline. Whether it feels stable under a thumb is a real-device question.
 */

import { readFileSync } from "node:fs";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const shell = read("src/components/workspace-ui/WorkspaceShell.tsx");
const shellCode = code(shell);
const tokens = read("src/app/studio.css");
const hook = read("src/lib/workspace/useAppViewport.ts");
const buildScreen = code(read("src/components/workspace/BuildScreen.tsx"));

/* ── 1. a stable shell ───────────────────────────────────────────────────── */

check("the shell no longer sizes itself with dvh",
  !/h-dvh/.test(shellCode),
  "dvh tracks the URL bar, so the layout resized on every scroll gesture");
check("it uses the app frame", /studio-frame/.test(shellCode));
check("whose fallback is the stable small viewport", /height:\s*var\(--ventrio-app-height,\s*100svh\)/.test(tokens));
check("with a fallback for engines without svh", /@supports not \(height: 100svh\)/.test(tokens));
check("and the shell still clips its own overflow", /overflow-hidden/.test(shellCode));

/* ── 2. the keyboard is accounted for ────────────────────────────────────── */

check("the visual viewport is measured", /window\.visualViewport/.test(hook),
  "svh and dvh both describe the layout viewport, which a keyboard does not change");
check("its height is published to the shell", /--ventrio-app-height/.test(hook) && /--ventrio-app-height/.test(tokens));
/**
 * The offset is deliberately NOT used. Translating the frame by it moved the
 * app during any drag with the keyboard open, because the value oscillates
 * throughout a gesture — and a transform additionally re-bases every
 * `position: fixed` descendant, including the mobile nav drawer. The frame is
 * anchored instead, so there is nothing to compensate for.
 */
// Scoped to the frame's own rule, with comments stripped: other components
// translate legitimately, and the rule's own comment explains what it no longer
// does — matching either would pass the check by describing it.
const cssCode = tokens.replace(/\/\*[\s\S]*?\*\//g, "");
const frameRule = cssCode.split(".studio-frame {")[1]?.split("}")[0] ?? "";
check("the frame is not translated", !/transform/.test(frameRule),
  "the compensation was itself the thing that moved the app");
check("it is anchored to the viewport instead", /position: fixed/.test(frameRule));
check("and no offset is published", !/--ventrio-app-offset/.test(hook));
check("both resize and scroll are observed", /"resize", schedule/.test(hook) && /"scroll", schedule/.test(hook));
check("updates are coalesced to a frame", /requestAnimationFrame/.test(hook),
  "the keyboard slides, so this fires continuously");
check("the property is released on unmount", /removeProperty\("--ventrio-app-height"\)/.test(hook));

/* ── the composer is a field, not a slab ─────────────────────────────────── */

/* `.wsRoot .ws-composer` became `.s-composer` when the second palette was
   retired. The properties being protected are unchanged. */
const composerRule = cssCode.split(".s-composer {")[1]?.split("}")[0] ?? "";
check("the composer does not force a compositing layer",
  composerRule.length > 0 && !/backdrop-filter/.test(composerRule),
  "a 20px blur the width of the conversation is what read as a large white surface");
check("it has a solid surface with a visible edge",
  /background: var\(--background\)/.test(composerRule) && /border: 1px solid/.test(composerRule));
/**
 * A SHADOW IS ALLOWED; REACHING THE CONVERSATION IS NOT.
 *
 * This asserted no box-shadow at all, which was right while the composer sat
 * on a near-black ground and needed none. On warm paper a white field against
 * a white page needs some separation, so the rule is now the thing that was
 * actually wrong: the original `0 8px 30px` had no negative spread and
 * extended ~15px upward over the last message.
 *
 * Computed, not eyeballed: a shadow's top edge sits at (blur/2 − y + spread).
 * If that is not negative, it reaches up into the conversation.
 */
const shadow = composerRule.match(/box-shadow:[^;]+/)?.[0] ?? "";
const layer = shadow.match(/0 (\d+)px (\d+)px (-?\d+)(?:px)?/);
check("the composer has some separation from the page", /box-shadow/.test(composerRule));
check("and its shadow cannot reach the conversation", !!layer && (() => {
  const [, y, blur, spread] = layer.map(Number);
  return blur / 2 - y + spread <= 0;
})(), shadow.slice(0, 90));
check("an engine without visualViewport degrades to the CSS fallback",
  /if \(!viewport\) return;/.test(hook));
check("the shell installs the hook", /useAppViewport\(\)/.test(shellCode));

/* ── 3. a phone previews as a phone ──────────────────────────────────────── */

check("the effective device follows the screen", /narrow \? "mobile" : device/.test(buildScreen));
check("the frame is sized from it", /DEVICE_WIDTHS\[effectiveDevice\]/.test(buildScreen));
check("and remounts when it changes", /\$\{reloadKey\}-\$\{effectiveDevice\}/.test(buildScreen));
check("previews that measure themselves get it too", /preview\(effectiveDevice\)/.test(buildScreen));

/* ── 4. the visual system ────────────────────────────────────────────────
   The contrast maths that used to live here has moved to
   `design-system.test.mts`, which owns the palette and can actually read it:
   the token set is written in oklch now, and this copy parsed hex, so it had
   silently stopped measuring anything. Two contrast suites where one can no
   longer see the colours is worse than one that can. */

/* ── report ──────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} failed, ${passed} passed\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`✓ mobile shell: ${passed} checks passed`);
