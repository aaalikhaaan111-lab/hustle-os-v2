/**
 * One design system, across every platform surface.
 *
 *   npx tsx --conditions=react-server scripts/design-system.test.mts
 *
 * WHY "DIFFERENT GENERATIONS OF THE PRODUCT" WAS LITERALLY TRUE. Ventrio ran
 * two palettes. `globals.css @theme` had a #5d6bff accent, #1a1c28 ink and
 * #e6e8f0 borders; `workspace-ui/tokens.css` had #6b64f2, #0e1016 and #dde1ea —
 * and because the second was scoped to `.wsRoot`, Pricing, Projects, the nav
 * drawer and every auth screen rendered in the first while the workspace
 * rendered in the second. It was not old components versus new ones; it was
 * components obeying two different sets of numbers.
 *
 * THIS FILE NO LONGER CHECKS THAT THE TWO AGREE, because there is no longer a
 * second one. `workspace-ui/tokens.css` is deleted and the platform's palette
 * lives once, in `.studio`. What is asserted instead is the invariant that
 * replaced parity:
 *
 *   - the platform palette is defined in exactly one place;
 *   - it is legible (measured, not asserted by eye);
 *   - the type scale is short and nothing redefines a step ad hoc;
 *   - the shared primitives read the palette rather than carrying colours.
 *
 * `@theme` in globals.css is still LIGHT and is deliberately left alone: it is
 * what the frozen public landing page renders in. The platform overrides those
 * same custom properties inside `.studio`, which is why re-skinning the whole
 * product did not require editing a single shared component.
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
const tokens = nocss(read("src/app/studio.css"));

/* ── there is exactly one platform palette ──────────────────────────────── */

const studioBlock = tokens.split(".studio {")[1]?.split("\n}")[0] ?? "";

const pick = (block: string, name: string) =>
  (block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`)) ?? [])[1]?.toLowerCase();

check("the studio defines the platform palette", studioBlock.length > 0);
for (const name of [
  "--color-canvas",
  "--color-surface",
  "--color-surface-elevated",
  "--color-surface-hover",
  "--color-border",
  "--color-border-strong",
  "--color-ink",
  "--color-ink-secondary",
  "--color-ink-muted",
  "--color-accent",
  "--color-accent-hover",
  "--color-accent-foreground",
]) {
  check(`${name} is defined once, in .studio`, !!pick(studioBlock, name), "missing");
}

/**
 * The second palette is GONE, not merely agreed with. A file that defines a
 * competing set of colours is the failure mode this whole exercise was about,
 * so its absence is the assertion.
 */
let secondPaletteExists = true;
try {
  read("src/components/workspace-ui/tokens.css");
} catch {
  secondPaletteExists = false;
}
check("the second palette no longer exists", !secondPaletteExists,
  "workspace-ui/tokens.css defined a full competing colour set scoped to .wsRoot");

check("and there is no second brand colour",
  !/--color-accent-2/.test(studioBlock),
  "a product with two brand colours reads as a product with none");

/**
 * The platform must not paint itself with literal colours. A hex in a component
 * is a value that cannot follow the palette, and enough of them is a second
 * palette growing back one declaration at a time.
 *
 * The generated-app runtime is excluded: those fixtures describe the visitor's
 * application, which has its own design and must not inherit Ventrio's.
 */
const painted: string[] = [];
for (const file of [
  "src/components/workspace-ui/WorkspaceShell.tsx",
  "src/components/workspace-ui/Composer.tsx",
  "src/components/workspace/ProjectsScreen.tsx",
  "src/components/workspace/OverviewScreen.tsx",
  "src/components/build/ConversationTurn.tsx",
  "src/components/layout/StudioTopBar.tsx",
]) {
  if (/#[0-9a-fA-F]{6}\b/.test(nocode(read(file)))) painted.push(file);
}
check("no platform screen hardcodes a colour", painted.length === 0, painted.join(", "));

/* ── one radius scale ────────────────────────────────────────────────────── */

/* Softer than the dark system's 9/12/16. Rounded corners read as friendly,
   and this product is for people who are not sure they belong in a tool like
   it — so the scale is generous on purpose. */
check("the studio defines one radius scale",
  /--r-sm:\s*11px/.test(studioBlock) && /--r-md:\s*14px/.test(studioBlock) && /--r-lg:\s*20px/.test(studioBlock));

/* ── one type scale, in two voices ───────────────────────────────────────
   The `v-*` scale that used to live in globals.css is retired: it was the
   platform's SECOND type system, and its steps are these. There is one place
   now, and it names a display face as well as a UI face — the product had no
   display face at all, every screen set in one grotesk from the wordmark down
   to the timestamps, which is why the typography read as weak. */

const STEPS = ["s-greet", "s-display", "s-opening", "s-title", "s-body", "s-meta"];
for (const cls of STEPS) {
  const count = (tokens.match(new RegExp(`\\.${cls}\\s*\\{`, "g")) ?? []).length;
  check(`${cls} exists`, count >= 1);
  check(`${cls} is not redefined ad hoc`, count <= 2, `${count} definitions`);
}

check("the retired second scale is gone from globals",
  !/\.v-display|\.v-title|\.v-body|\.v-meta|\.v-surface|\.v-panel/.test(globals),
  "two type systems is what made the product read as two products");

/**
 * The voice is a serif and the work is a grotesk. Greetings, screen titles and
 * project names are set in the display face; nothing operational is — a serif
 * button is a costume.
 */
for (const cls of ["s-greet", "s-display", "s-opening", "s-title"]) {
  const rule = tokens.split(`.${cls} {`)[1]?.split("}")[0] ?? "";
  check(`${cls} is set in the display face`, /--font-display/.test(rule));
}
for (const cls of ["s-body", "s-meta", "s-eyebrow", "s-btn"]) {
  const rule = tokens.split(`.${cls} {`)[1]?.split("}")[0] ?? "";
  check(`${cls} is not`, !/--font-display/.test(rule));
}

check("the display face carries Cyrillic",
  /subsets:\s*\["latin",\s*"cyrillic"\]/.test(nocode(read("src/app/layout.tsx")).split("Alegreya({")[1] ?? ""),
  "the product runs in Russian; a display face that falls back on half its users is not one");

/**
 * The greeting is the largest step, and the question the assistant asks is
 * deliberately smaller than it. Both are larger than the title, which is
 * larger than the body — a scale whose steps a person can actually see, unlike
 * the 17px-title-over-15px-body it replaced.
 */
const size = (cls: string) => {
  const rule = tokens.split(`.${cls} {`)[1]?.split("}")[0] ?? "";
  return Number((rule.match(/font-size:\s*([\d.]+)rem/) ?? [])[1]);
};
check("the scale is genuinely stepped",
  size("s-greet") > size("s-display") &&
  size("s-display") > size("s-opening") &&
  size("s-opening") > size("s-title") &&
  size("s-title") > size("s-body") &&
  size("s-body") > size("s-meta"),
  [size("s-greet"), size("s-display"), size("s-opening"), size("s-title"), size("s-body"), size("s-meta")].join(" / "));

/* ── two surface treatments, no decorative shadows ───────────────────────── */

check("there is a panel treatment", /\.s-panel\s*\{/.test(tokens));
check("and a sheet that rises over the field", /\.s-sheet\s*\{/.test(tokens));
check("the panel does not float", !/box-shadow/.test(tokens.split(".s-panel {")[1]?.split("}")[0] ?? ""),
  "a shadow means 'above'; a panel sits on the page");

/* ── the sky ─────────────────────────────────────────────────────────────── */

check("there is a creation field", /\.s-sky\s*\{/.test(tokens) && /\.s-sky-band\s*\{/.test(tokens));
check("built from the accent rather than an invented palette",
  /--sky-1:\s*rgb\(91 75 214/.test(tokens),
  "the field is the brand colour at low alpha, not a second identity");

/* ── the legacy marketing chrome is gone from shared components ──────────── */

const header = nocode(read("src/components/ui/PageHeader.tsx"));
check("the page header uses the shared scale", /s-display/.test(header));
check("its uppercase accent eyebrow is retired", !/tracking-\[0\.18em\]/.test(header));
check("and its rule is gone", !/border-b border-border/.test(header));

const card = nocode(read("src/components/ui/Card.tsx"));
check("cards use the shared surface", /s-panel/.test(card));
check("and have no drop shadow", !/shadow-\[/.test(card));

/* ── touch targets on the surfaces a phone actually uses ─────────────────── */

/**
 * THE DRAWER IS GONE, so the checks that guarded its row heights are too.
 *
 * On a phone the whole product used to hide behind one unlabelled hamburger
 * that opened a sheet over the page. It is a bottom tab bar now — four
 * destinations, shown rather than disclosed — so what has to clear the touch
 * floor is the tab, and the tab is what is measured.
 */
const shell = nocode(read("src/components/workspace-ui/WorkspaceShell.tsx"));
check("the phone navigation is a tab bar, not a drawer",
  /s-tab/.test(shell) && !/drawerOpen/.test(shell) && !/ws-scrim/.test(shell));
check("its tabs clear the touch floor", /min-h-\[56px\]/.test(shell));
check("and every tab carries a word", /text-\[11\.5px\] font-medium/.test(shell));
/**
 * The desktop rail says words too. It was 68px of bare icons with tooltips,
 * which is fine for someone who uses a tool daily and learns the glyphs, and
 * hostile to a person who has never opened a builder before.
 */
/**
 * `.s-nav-item` SETS `display: flex`, AND IT IS UNLAYERED.
 *
 * That is deliberate — the same reasoning as the button sheet, where putting
 * the rules in `@layer components` let Tailwind's unlayered preflight reset
 * them. But an unlayered rule beats a layered utility whatever its
 * specificity, so `hidden`, `md:hidden` and `md:flex` all lose to it SILENTLY.
 *
 * The header carried two back arrows side by side, on a phone and on a 1440px
 * screen, for exactly this reason: one control was `md:hidden` and the other
 * `hidden md:flex`, and neither instruction had any effect.
 *
 * Responsive display on these has to be a render decision, not a class.
 */
const navDisplayUtility = /className="[^"]*s-nav-item[^"]*\b(?:hidden|(?:sm|md|lg|xl):(?:flex|hidden|block|inline-flex))\b/;
check("no s-nav-item is shown or hidden with a utility",
  !navDisplayUtility.test(shell),
  "s-nav-item's own display is unlayered and wins over Tailwind's");

check("the desktop rail is labelled, not a column of glyphs",
  /\{label\}<\/span>/.test(shell) && !/aria-label=\{label\}/.test(shell));

/**
 * The touch floor itself moved from a viewport query to a POINTER query. A
 * narrow window on a laptop is still a mouse and does not need 44px of button;
 * a wide tablet is a thumb and does.
 */
const buttonCss = nocss(read("src/components/ui/VentrioButton.css"));
check("the touch floor is keyed on the pointer", /@media \(pointer: coarse\)/.test(buttonCss));
check("and raises icon-only controls to 44px", /width: 44px;\s*\n\s*height: 44px;/.test(buttonCss));

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

const accent = pick(studioBlock, "--color-accent")!;
const accentFg = pick(studioBlock, "--color-accent-foreground")!;
const surfaceHex = pick(studioBlock, "--color-surface")!;
const canvasHex = pick(studioBlock, "--color-canvas")!;
const inkHex = pick(studioBlock, "--color-ink")!;
const ink2Hex = pick(studioBlock, "--color-ink-secondary")!;
const ink3Hex = pick(studioBlock, "--color-ink-muted")!;
const borderHex = pick(studioBlock, "--color-border")!;
const hoverHex = pick(studioBlock, "--color-surface-hover")!;

/**
 * `--color-accent-soft` is a translucent tint, not a hex, so it has to be
 * COMPOSITED against the surface it sits on before it can be measured. Reading
 * the alpha off the declaration keeps the test honest if the tint is retuned.
 */
const softAlpha = Number(
  (studioBlock.match(/--color-accent-soft:\s*rgb\([^/]+\/\s*([\d.]+)\s*\)/) ?? [])[1] ?? "0",
);
const over = (fg: string, bg: string, alpha: number) => {
  const [f, b] = [parseInt(fg.slice(1), 16), parseInt(bg.slice(1), 16)];
  const mix = (shift: number) => {
    const a = (f >> shift) & 255;
    const c = (b >> shift) & 255;
    return Math.round(a * alpha + c * (1 - alpha));
  };
  return `#${[16, 8, 0].map((sh) => mix(sh).toString(16).padStart(2, "0")).join("")}`;
};
const accentSoftOnSurface = over(accent, surfaceHex, softAlpha);

check("the soft tint has a real alpha", softAlpha > 0, String(softAlpha));
check("body text is legible", contrast(inkHex, surfaceHex) >= 7, contrast(inkHex, surfaceHex).toFixed(2));
check("secondary text passes AA", contrast(ink2Hex, surfaceHex) >= 4.5, contrast(ink2Hex, surfaceHex).toFixed(2));
check("muted text passes AA on a surface",
  contrast(ink3Hex, surfaceHex) >= 4.5, contrast(ink3Hex, surfaceHex).toFixed(2));
check("and still passes on a hovered row",
  contrast(ink3Hex, hoverHex) >= 4.5, contrast(ink3Hex, hoverHex).toFixed(2),
);
check("a hairline is visible against a panel",
  contrast(borderHex, surfaceHex) >= 1.15,
  `${contrast(borderHex, surfaceHex).toFixed(3)} — on a dark ground the edge must be LIGHTER than the panel`);

/**
 * The accent has to carry text in BOTH directions: as a fill behind the button
 * label, and as text itself. Passing one way says nothing about the other —
 * white on this violet is 3.27:1 and fails, which is why the button label is
 * near-black rather than white.
 */
check("a primary button label is legible on the accent",
  contrast(accentFg, accent) >= 4.5, contrast(accentFg, accent).toFixed(2));
check("accent text is legible on a surface",
  contrast(accent, surfaceHex) >= 4.5, contrast(accent, surfaceHex).toFixed(2));
check("accent text is legible on the canvas",
  contrast(accent, canvasHex) >= 4.5, contrast(accent, canvasHex).toFixed(2));
check("and on the soft tint, composited",
  contrast(accent, accentSoftOnSurface) >= 4.5, contrast(accent, accentSoftOnSurface).toFixed(2));

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
  /s-panel/.test(empty) && /s-title/.test(empty) && /s-body/.test(empty));

const skeleton = nocode(read("src/components/ui/Skeleton.tsx"));
check("a placeholder has the geometry of the thing it replaces",
  /s-panel/.test(skeleton) && !/rounded-3xl/.test(skeleton),
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
