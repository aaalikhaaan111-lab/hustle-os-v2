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
const tokens = read("src/components/workspace-ui/tokens.css");
const hook = read("src/lib/workspace/useAppViewport.ts");
const buildScreen = code(read("src/components/workspace/BuildScreen.tsx"));

/* ── 1. a stable shell ───────────────────────────────────────────────────── */

check("the shell no longer sizes itself with dvh",
  !/h-dvh/.test(shellCode),
  "dvh tracks the URL bar, so the layout resized on every scroll gesture");
check("it uses the app frame", /ventrio-app-frame/.test(shellCode));
check("whose fallback is the stable small viewport", /height:\s*var\(--ventrio-app-height,\s*100svh\)/.test(tokens));
check("with a fallback for engines without svh", /@supports not \(height: 100svh\)/.test(tokens));
check("and the shell still clips its own overflow", /overflow-hidden/.test(shellCode));

/* ── 2. the keyboard is accounted for ────────────────────────────────────── */

check("the visual viewport is measured", /window\.visualViewport/.test(hook),
  "svh and dvh both describe the layout viewport, which a keyboard does not change");
check("its height is published to the shell", /--ventrio-app-height/.test(hook) && /--ventrio-app-height/.test(tokens));
check("and its offset too", /--ventrio-app-offset/.test(hook) && /--ventrio-app-offset/.test(tokens),
  "iOS scrolls the visual viewport inside the layout viewport; ignoring it makes a fixed shell drift behind the keyboard");
check("both resize and scroll are observed", /"resize", schedule/.test(hook) && /"scroll", schedule/.test(hook));
check("updates are coalesced to a frame", /requestAnimationFrame/.test(hook),
  "the keyboard slides, so this fires continuously");
check("the properties are released on unmount", /removeProperty\("--ventrio-app-height"\)/.test(hook));
check("an engine without visualViewport degrades to the CSS fallback",
  /if \(!viewport\) return;/.test(hook));
check("the shell installs the hook", /useAppViewport\(\)/.test(shellCode));

/* ── 3. a phone previews as a phone ──────────────────────────────────────── */

check("the effective device follows the screen", /narrow \? "mobile" : device/.test(buildScreen));
check("the frame is sized from it", /DEVICE_WIDTHS\[effectiveDevice\]/.test(buildScreen));
check("and remounts when it changes", /\$\{reloadKey\}-\$\{effectiveDevice\}/.test(buildScreen));
check("previews that measure themselves get it too", /preview\(effectiveDevice\)/.test(buildScreen));

/* ── 4. the visual system is one system, and legible ─────────────────────── */

/**
 * "Washed out" was a token problem, not a component problem. A border at
 * #e8ebf1 on a #ffffff surface is not a border anyone can see, and small print
 * at #6e7482 on --raised was failing contrast. Retuning the scale lifts every
 * surface at once, which is the opposite of restyling component by component.
 */
const value = (name: string) => (tokens.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i")) ?? [])[1]?.toLowerCase();
const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

const surface = value("surface");
const ink = value("ink");
const ink2 = value("ink-2");
const ink3 = value("ink-3");
const line = value("line");

check("the tokens still define one scale", !!surface && !!ink && !!ink2 && !!ink3 && !!line);
if (surface && ink && ink2 && ink3 && line) {
  check("body text passes AA comfortably", contrast(ink, surface) >= 7,
    contrast(ink, surface).toFixed(2));
  check("secondary text passes AA", contrast(ink2, surface) >= 4.5, contrast(ink2, surface).toFixed(2));
  check("small print passes AA", contrast(ink3, surface) >= 4.5, contrast(ink3, surface).toFixed(2));
  check("a border is actually visible against a surface", contrast(line, surface) >= 1.15,
    `${contrast(line, surface).toFixed(3)} — #e8ebf1 on white was 1.10, which reads as no border at all`);
}

/* ── report ──────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} failed, ${passed} passed\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`✓ mobile shell: ${passed} checks passed`);
