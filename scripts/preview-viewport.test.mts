/**
 * Regression tests for the preview viewport and the fullscreen exit control.
 *
 *   npx tsx scripts/preview-viewport.test.mts
 *
 * Production reported that selecting the phone preview shredded the generated
 * headline into one or two letters per line. The cause was that the device
 * switcher set `maxWidth: 390` on a div in the workspace document. That narrows
 * the box and nothing else — `vw` units and `@media` queries are answered by
 * the browser viewport, which was still desktop-width. So the generated site
 * kept its desktop stylesheet inside a 390px column: multi-column grids never
 * collapsed and the hero stayed at 49px in a 132px box.
 *
 * Only a nested browsing context has its own viewport, so the fix is an iframe.
 * These tests cannot prove that at the pixel level without a browser — that was
 * verified by measuring `frameInnerWidth`, `matchMedia` and line-box widths in
 * Chrome at 390/768/1280. What they pin is the source-level invariant that made
 * the defect possible, so it cannot quietly come back: the preview must be
 * sized by a real frame width, never by a max-width on an ancestor div.
 */

import { readFileSync } from "node:fs";
import { DEVICE_WIDTHS } from "../src/lib/build/deviceWidths";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const buildScreen = read("src/components/workspace/BuildScreen.tsx");
const viewportFrame = read("src/components/workspace/ViewportFrame.tsx");
const parts = read("src/components/workspace-ui/parts.tsx");

/* ── 1. the device widths are real device widths ────────────────────────── */

check("mobile is 390", DEVICE_WIDTHS.mobile === 390, String(DEVICE_WIDTHS.mobile));
check("tablet is 768", DEVICE_WIDTHS.tablet === 768, String(DEVICE_WIDTHS.tablet));
check("desktop is 1280", DEVICE_WIDTHS.desktop === 1280, String(DEVICE_WIDTHS.desktop));

// The app's own mobile styles live behind `max-width: 639px`. A phone preview
// wider than that would render the desktop stylesheet again — the whole defect.
check("mobile width activates the app's mobile breakpoint", DEVICE_WIDTHS.mobile <= 639);
check("tablet width clears the 640px breakpoint", DEVICE_WIDTHS.tablet >= 640);

/* ── 2. the preview is sized by a frame, not by an ancestor's max-width ─── */

check(
  "BuildScreen renders the preview through ViewportFrame",
  /<ViewportFrame[\s\S]{0,400}\{preview\}/.test(buildScreen),
);

// The exact shape of the bug: a width derived from `device` applied as a CSS
// max-width. Any reappearance of that pattern means the frame was bypassed.
check(
  "no device-conditional maxWidth remains on the preview container",
  !/maxWidth:\s*device\s*===/.test(buildScreen),
  buildScreen.match(/maxWidth:\s*device[^,\n]*/)?.[0] ?? "",
);

// The iframe's own width is the layout viewport. It must be the raw selected
// width — not a fitted, clamped or scaled value.
const iframeTag = viewportFrame.match(/<iframe[\s\S]*?>/)?.[0] ?? "";
check("ViewportFrame renders an iframe", iframeTag.length > 0);
check(
  "the iframe's width is the selected width, unmodified",
  /\bwidth,/.test(iframeTag),
  iframeTag.match(/width[^,\n]*/)?.[0] ?? "",
);
check(
  "the iframe is never clamped by a max-width",
  !/maxWidth/.test(iframeTag),
);

// Fitting a wide preview into a narrow panel must scale, never narrow —
// narrowing would change the frame's viewport and reintroduce the same lie.
check(
  "an oversized frame is fitted by scaling",
  /transform:[\s\S]{0,60}scale\(\$\{scale\}\)/.test(viewportFrame),
);
check(
  "the scale only ever shrinks",
  /available\s*<\s*width\s*\?\s*available\s*\/\s*width\s*:\s*1/.test(viewportFrame),
);
check(
  "scaling anchors to the top-left so nothing is cropped",
  /transformOrigin:\s*"0 0"/.test(viewportFrame),
);

// The frame measures its parent to pick a scale. If that parent were sized by
// its content, shrinking the frame would shrink the parent, which would report
// less room, which would shrink the frame again — the scale would latch at its
// smallest value and never recover when the panel grew back (verified in
// Chrome: shrinking the frame to 80px dragged a fit-content parent to 80px,
// while the flex container held at its full width).
const frameContainer = buildScreen.match(/<div[^>]*>\s*(?:\{\/\*[\s\S]*?\*\/\}\s*)?<ViewportFrame/);
check("the frame has a container element", frameContainer !== null);
check(
  "the frame's container is not content-sized",
  !/w-fit/.test(frameContainer?.[0] ?? "w-fit"),
  frameContainer?.[0]?.slice(0, 90) ?? "",
);

// A flex item shrinks below its width by default, which would crop the scaled
// frame's right edge while leaving the scale untouched.
check(
  "the frame does not shrink as a flex item",
  /flexShrink:\s*0/.test(viewportFrame),
);

// Remounting on device change is what makes the frame re-adopt styles and
// re-measure; without it the iframe keeps the previous document's layout.
check(
  "the frame remounts when the device changes",
  /key=\{`\$\{reloadKey\}-\$\{device\}`\}/.test(buildScreen),
);

// All three modes must be reachable from the rail, or tablet is dead code.
for (const device of Object.keys(DEVICE_WIDTHS)) {
  check(`the rail offers ${device}`, new RegExp(`setDevice\\("${device}"\\)`).test(buildScreen));
}

/* ── 3. the fullscreen exit glyph corners inward ────────────────────────── */

// The reported control looked malformed because two of its four brackets
// cornered the wrong way. Each subpath is `M x y H|V a … `; the elbow is the
// vertex between the two segments, and for a "minimize" glyph every elbow must
// sit on the inner ring, toward the centre of the 18×18 box.
const minimize = parts.match(/IconMinimize[\s\S]*?<path d="([^"]+)"/)?.[1] ?? "";
check("IconMinimize has a path", minimize.length > 0);

const subpaths = minimize.split("M").filter(Boolean);
check("IconMinimize has four brackets", subpaths.length === 4, String(subpaths.length));

const CENTRE = 9;

/**
 * The elbow of one bracket, in absolute coordinates.
 *
 * Handles relative `h`/`v` as well as absolute `H`/`V`, because the broken
 * glyph mixed both — and the two notations can describe the same stroke, so
 * rejecting relative syntax would test spelling rather than shape.
 */
function elbowOf(subpath: string): { x: number; y: number } | null {
  const start = subpath.match(/^\s*([\d.]+)\s+([\d.]+)/);
  const horizontal = subpath.match(/([Hh])\s*(-?[\d.]+)/);
  if (!start || !horizontal || !/[Vv]/.test(subpath)) return null;
  const x0 = Number(start[1]);
  const y0 = Number(start[2]);
  const dx = Number(horizontal[2]);
  // The pen moves horizontally first, then turns: the elbow is (x after H, y0).
  return { x: horizontal[1] === "H" ? dx : x0 + dx, y: y0 };
}

for (const [index, subpath] of subpaths.entries()) {
  const elbow = elbowOf(subpath);
  if (!elbow) {
    failures.push(`bracket ${index} is not an H-then-V elbow — "${subpath}"`);
    continue;
  }
  const inward = Math.abs(elbow.x - CENTRE) === 2 && Math.abs(elbow.y - CENTRE) === 2;
  check(
    `bracket ${index} corners toward the centre`,
    inward,
    `elbow at (${elbow.x}, ${elbow.y}), expected 2 units from centre on both axes`,
  );
}

// Every bracket must occupy a different quadrant, so the glyph reads as a
// square being pulled in rather than as three arrows and a stray mark.
const quadrants = new Set(
  subpaths.map((subpath) => {
    const elbow = elbowOf(subpath);
    if (!elbow) return `unparsed:${subpath}`;
    return `${elbow.x > CENTRE ? "R" : "L"}${elbow.y > CENTRE ? "B" : "T"}`;
  }),
);
check("the four brackets cover four quadrants", quadrants.size === 4, [...quadrants].join(","));

/* ── 4. the rail's toggles expose their state, not just their colour ────── */

// To the start of the next declaration: RailButton's props type closes with a
// brace in the first column, so stopping at the first one would cut the body.
const railButton = buildScreen.match(/function RailButton[\s\S]*?(?=\n\/\*\*|\nfunction )/)?.[0] ?? "";
check("RailButton is defined, with its body", /VentrioButton/.test(railButton));

// `on` only paints the button. Without aria-pressed the selected device and the
// fullscreen state are conveyed by colour alone.
check(
  "a toggle in the rail reports its pressed state",
  /"aria-pressed":\s*active/.test(railButton),
);

// Buttons that simply act — reload, copy link — pass no `active`, and must not
// claim a pressed state they do not have.
check(
  "a plain action in the rail stays a plain button",
  /active === undefined \? \{\}/.test(railButton),
);

/* ── report ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`FAILED ${failures.length} of ${passed + failures.length}`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`preview viewport: ${passed} checks passed`);
