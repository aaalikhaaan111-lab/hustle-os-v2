/**
 * One design system, across every platform surface.
 *
 *   npx tsx --conditions=react-server scripts/design-system.test.mts
 *
 * WHY "DIFFERENT GENERATIONS OF THE PRODUCT" WAS LITERALLY TRUE. Ventrio ran
 * two palettes. `globals.css @theme` had a #5d6bff accent, #1a1c28 ink, #e6e8f0
 * borders and a 20/28px radius pair; `workspace-ui/tokens.css` had #6b64f2,
 * #0e1016, #dde1ea and 18/22px — and because the second was scoped to `.wsRoot`,
 * Pricing, Projects, the nav drawer and every auth screen rendered in the first
 * while the workspace rendered in the second.
 *
 * So it was not old components versus new ones. It was components obeying two
 * different sets of numbers, which no amount of restyling one at a time would
 * ever reconcile. This file holds them together.
 *
 * Offline. Whether it looks premium is a real-device judgement.
 */

import { readFileSync } from "node:fs";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const nocss = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "");
/**
 * Comments are stripped before every assertion below. Repeatedly, a check has
 * passed or failed on the prose EXPLAINING the rule rather than on the rule —
 * a doc comment saying "it was `rounded-3xl`" is enough to fail a search for
 * `rounded-3xl` in code that no longer contains it anywhere else.
 */
const nocode = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const globals = nocss(read("src/app/globals.css"));
const tokens = nocss(read("src/components/workspace-ui/tokens.css"));

/* ── the two palettes are one palette ────────────────────────────────────── */

const themeBlock = globals.split("@theme {")[1]?.split("\n}")[0] ?? "";
const wsBlock = tokens.split(".wsRoot {")[1]?.split("\n}")[0] ?? "";

const pick = (block: string, name: string) =>
  (block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`)) ?? [])[1]?.toLowerCase();

for (const [themeName, wsName, label] of [
  ["--color-accent", "--accent", "accent"],
  ["--color-ink", "--ink", "ink"],
  ["--color-ink-secondary", "--ink-2", "secondary ink"],
  ["--color-ink-muted", "--ink-3", "muted ink"],
  ["--color-border", "--line", "border"],
  ["--color-border-strong", "--line-2", "strong border"],
  ["--color-canvas", "--bg", "canvas"],
  ["--color-surface", "--surface", "surface"],
] as const) {
  const a = pick(themeBlock, themeName);
  const b = pick(wsBlock, wsName);
  check(`${label} is the same colour on both sides`, !!a && a === b, `${a} vs ${b}`);
}

check("the retired accent is gone from the theme", !/#5d6bff/.test(themeBlock));
check("and there is no second brand colour",
  !/--color-accent-2/.test(themeBlock),
  "a product with two brand colours reads as a product with none");

/* ── one radius scale ────────────────────────────────────────────────────── */

check("shared radii match the workspace's surface radii",
  /--radius-lg:\s*16px/.test(themeBlock) && /--radius-xl:\s*22px/.test(themeBlock),
  "20px/28px made shared components visibly softer than workspace ones beside them");

/* ── one type scale, and it is short ─────────────────────────────────────── */

/**
 * Each step exists, and no step is defined more than twice: once at the base
 * and at most one responsive override. The point is that a screen cannot invent
 * a fifth size, not that the scale is unable to change at a breakpoint.
 */
for (const cls of ["v-display", "v-title", "v-body", "v-meta"]) {
  const count = (globals.match(new RegExp(`\\.${cls}\\s*\\{`, "g")) ?? []).length;
  check(`${cls} exists`, count >= 1);
  check(`${cls} is not redefined ad hoc`, count <= 2, `${count} definitions`);
}
/**
 * The BASE is the mobile size, because the base is what a phone gets. Scoped to
 * the first definition on purpose: the desktop override is also `.v-body {` and
 * also carries a font-size, so an unscoped regex passes on the desktop rule
 * while the phone renders whatever it likes.
 */
const bodyBase = globals.split(".v-body {")[1]?.split("}")[0] ?? "";
const bodyRem = Number((bodyBase.match(/font-size:\s*([\d.]+)rem/) ?? [])[1]);
check("mobile body type is not desktop-dashboard small", bodyRem >= 1,
  `${bodyRem}rem — 15px is normal on a desktop dashboard and small at arm's length`);
check("and desktop steps back down rather than up",
  /@media[^{]*min-width:\s*768px[\s\S]*?\.v-body\s*\{\s*font-size:\s*0\.9375rem/.test(globals));

/* ── two surface treatments, no decorative shadows ───────────────────────── */

check("there is a surface treatment", /\.v-surface\s*\{/.test(globals));
check("and a panel treatment", /\.v-panel\s*\{/.test(globals));
for (const cls of ["v-surface", "v-panel"]) {
  const rule = globals.split(`.${cls} {`)[1]?.split("}")[0] ?? "";
  check(`${cls} does not float`, !/box-shadow/.test(rule),
    "a shadow means 'above'; almost nothing in a workspace is above anything");
}

/* ── the legacy marketing chrome is gone from shared components ──────────── */

const header = nocode(read("src/components/ui/PageHeader.tsx"));
check("the page header uses the shared scale", /v-display/.test(header));
check("its uppercase accent eyebrow is retired", !/tracking-\[0\.18em\]/.test(header));
check("and its rule is gone", !/border-b border-border/.test(header));

const card = nocode(read("src/components/ui/Card.tsx"));
check("cards use the shared surface", /v-surface/.test(card));
check("and have no drop shadow", !/shadow-\[/.test(card));

/* ── touch targets on the surfaces a phone actually uses ─────────────────── */

check("the tap floor exists", /\.v-tap\s*\{/.test(globals) || /\.v-tap\b/.test(globals));
const drawer = nocode(read("src/components/layout/NavDrawer.tsx"));
check("drawer rows meet it", /v-tap/.test(drawer));
check("and the drawer close control is not a 32px circle", !/h-8 w-8 items-center justify-center rounded-full/.test(drawer));

/* ── publish feedback cannot move the toolbar ────────────────────────────── */

const inlineRule = globals.split(".publication-message--inline {")[1]?.split("}")[0] ?? "";
check("the publish message is out of flow", /position: absolute/.test(inlineRule),
  "in flow it was up to 15rem wide and pushed the pinned controls sideways");
check("anchored below the controls", /top: 100%/.test(inlineRule));
check("and the control group is its positioning context",
  /relative flex shrink-0/.test(nocode(read("src/components/publishing/PublicationControls.tsx"))));

/* ── the accent has to carry text in both directions ─────────────────────── */

/**
 * A colour used BOTH as a fill behind white text and as text itself has to pass
 * twice, and passing one way says nothing about the other.
 *
 * #6b64f2 — the brand violet — passed neither: white on it was 4.44:1 and it on
 * --accent-soft was 3.91:1. That is the label on every primary button in the
 * product and every accent badge, all sitting just under AA. Worth stating
 * plainly: this is the one place the redesign changed a brand colour, and it
 * changed it by one step of lightness at the same hue.
 */
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

const accent = pick(themeBlock, "--color-accent")!;
const accentFg = pick(themeBlock, "--color-accent-foreground")!;
const accentSoft = pick(themeBlock, "--color-accent-soft")!;
const surfaceHex = pick(themeBlock, "--color-surface")!;

check("a primary button label is legible on the accent",
  contrast(accentFg, accent) >= 4.5, contrast(accentFg, accent).toFixed(2));
check("accent text is legible on a surface",
  contrast(accent, surfaceHex) >= 4.5, contrast(accent, surfaceHex).toFixed(2));
check("and an accent badge is legible on the soft tint",
  contrast(accent, accentSoft) >= 4.5, contrast(accent, accentSoft).toFixed(2));

/* ── the shared primitives obey the same system ──────────────────────────── */

const field = nocode(read("src/components/ui/Field.tsx"));
check("a field's message is announced with the control",
  /aria-describedby/.test(field),
  "a loose <p> after the input is read by sighted people and nobody else");
check("only a validation failure interrupts", /role=\{error \? "alert" : undefined\}/.test(field));

const input = nocode(read("src/components/ui/Input.tsx"));
check("inputs clear the touch floor", /min-h-\[46px\]/.test(input));
check("and never drop below 16px, on any screen",
  /text-\[16px\]/.test(input) && !/md:text-sm/.test(input),
  "iOS zooms a smaller field on focus and does not zoom back out");

const button = nocss(read("src/components/ui/VentrioButton.css"));
check("buttons grow for a thumb, not for a narrow window",
  /@media \(pointer: coarse\)/.test(button),
  "a narrow laptop window is still a mouse; a wide tablet is still a thumb");
const coarse = button.split("@media (pointer: coarse) {")[1] ?? "";
check("every icon-only control reaches 44px", /width: 44px;\s*\n\s*height: 44px;/.test(coarse));

const empty = nocode(read("src/components/ui/EmptyState.tsx"));
check("the empty state is not a drop zone", !/border-dashed/.test(empty),
  "a dashed outline is the web's convention for somewhere to drag a file");
check("and uses the shared surface and scale",
  /v-surface/.test(empty) && /v-title/.test(empty) && /v-body/.test(empty));

const skeleton = nocode(read("src/components/ui/Skeleton.tsx"));
check("a placeholder has the geometry of the thing it replaces",
  /v-surface/.test(skeleton) && !/rounded-3xl/.test(skeleton),
  "rounded-3xl against a 16px card re-flowed the list the moment data arrived");

const badge = nocode(read("src/components/ui/Badge.tsx"));
check("badge text is meta-sized, not the product's smallest",
  /text-\[0\.8125rem\]/.test(badge));

/* ── report ──────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} failed, ${passed} passed\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`✓ design system: ${passed} checks passed`);
