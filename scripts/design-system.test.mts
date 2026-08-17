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
/** The approved shadcn token set lives at `:root` in globals.css. */
const rootBlock = globals.split(":root {")[1]?.split("\n}")[0] ?? "";
const paletteBlocks = [studioBlock, rootBlock];

/** A token is "defined" if it carries any value — hex, oklch or an alias. */
const pick = (block: string, name: string) =>
  (block.match(new RegExp(`${name}:\\s*([^;]+);`)) ?? [])[1]?.trim();

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

/* The radius scale is asserted below, where it is derived from `--radius`. */

/* ── one type scale, one family ──────────────────────────────────────────
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
 * ONE FAMILY. The editorial serif is retired with the direction that asked for
 * it: the platform sets everything in the UI face, and hierarchy comes from
 * size and weight rather than from a second typeface.
 */
for (const cls of ["s-greet", "s-display", "s-opening", "s-title", "s-body", "s-meta", "s-eyebrow"]) {
  const rule = tokens.split(`.${cls} {`)[1]?.split("}")[0] ?? "";
  check(`${cls} does not set its own family`, !/font-family/.test(rule));
}
check("the platform sets one family, on the scope",
  /font-family:\s*var\(--font-ui\), var\(--font-geist-sans\)/.test(studioBlock));

/**
 * FIGTREE HAS NO CYRILLIC, and this product runs in Russian.
 *
 * Geist follows it in the stack so latin renders in Figtree and Cyrillic falls
 * through per glyph. Both halves of that arrangement are asserted, because
 * either one alone is a bug: Figtree without the fallback leaves Russian to
 * whatever the OS picks, and the fallback without Figtree is the old face.
 */
const layout = nocode(read("src/app/layout.tsx"));
check("Figtree is loaded for the UI", /Figtree\(\{[\s\S]{0,160}--font-ui/.test(layout));
check("and a Cyrillic-capable face follows it in the stack",
  /var\(--font-ui\), var\(--font-geist-sans\)/.test(studioBlock),
  "Figtree ships latin only; Russian would fall back to the OS default");
check("Geist still declares Cyrillic",
  /Geist\(\{[\s\S]{0,140}"cyrillic"/.test(layout));

/**
 * THE RADIUS SCALE IS DERIVED, not restated. Every step is computed from the
 * supplied `--radius`, so changing that one number moves the whole product and
 * no component can drift to a hand-picked corner.
 */
check("the radius scale derives from the supplied --radius",
  /--radius:\s*0\.625rem/.test(rootBlock) &&
  /--r-sm:\s*calc\(var\(--radius\)/.test(studioBlock) &&
  /--r-md:\s*var\(--radius\)/.test(studioBlock) &&
  /--r-lg:\s*calc\(var\(--radius\)/.test(studioBlock));

/**
 * THE COLOUR FIELD IS RETIRED. The classes stay so no call site breaks, but
 * they must paint the plain background — a gradient left behind under a new
 * token system is exactly the kind of leftover this pass exists to remove.
 */
const skyRule = tokens.split(".s-sky-band { ")[1]?.split("}")[0]
  ?? tokens.split(".s-sky,\n.s-sky-band {")[1]?.split("}")[0] ?? "";
check("the retired colour field paints nothing",
  !/gradient/.test(skyRule), skyRule.slice(0, 80));

/* ── two surface treatments, no decorative shadows ───────────────────────── */

check("there is a panel treatment", /\.s-panel\s*\{/.test(tokens));
check("and a sheet that rises over the field", /\.s-sheet\s*\{/.test(tokens));
check("the panel does not float", !/box-shadow/.test(tokens.split(".s-panel {")[1]?.split("}")[0] ?? ""),
  "a shadow means 'above'; a panel sits on the page");

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
 * THE BOTTOM TAB BAR IS GONE, and the checks that guarded it with it.
 *
 * It could not be shown on the build route — the composer owns the bottom edge
 * of a phone — so the one screen people spend the most time in had no
 * navigation at all. Mobile navigation is a real drawer now, opened from a
 * trigger that is present on every route, holding exactly the destinations the
 * desktop rail holds. One navigation, two presentations.
 */
const shell = nocode(read("src/components/workspace-ui/WorkspaceShell.tsx"));
check("the phone navigation is a drawer, not a bottom tab bar",
  !/s-tab/.test(shell) && /toggleSidebar/.test(shell) && /isMobile/.test(shell),
  "a tab bar that cannot render on the busiest route is not navigation");
check("its trigger is labelled for screen readers",
  /aria-label=\{t\("navOpen"\)\}/.test(shell),
  "an unlabelled icon button is the thing the drawer was replaced for");
check("and every destination carries a word, not just a glyph",
  /<span>\{label\}<\/span>/.test(shell));

/**
 * The drawer closes when you pick something. A sheet left open over the page
 * you just asked for is the most common mobile-navigation defect there is.
 */
check("choosing a destination closes the drawer",
  /onClick=\{\(\) => setOpenMobile\(false\)\}/.test(shell));

/* ── the collapsed rail, and the sidebar's own furniture ─────────────────── */

/**
 * COLLAPSED, THE WORDMARK IS HIDDEN, not clipped.
 *
 * `size="lg"` sets `p-0!` in icon mode while the base rule still forces
 * `size-8`, so "Ventrio" began at 24px inside a 32px box and roughly eight
 * pixels of a "V" survived the overflow — a sliver of a letter that read as a
 * rendering fault rather than as a collapsed state.
 */
check("the wordmark is hidden when the rail collapses, not clipped",
  /Ventrio[\s\S]{0,120}group-data-\[collapsible=icon\]:hidden|group-data-\[collapsible=icon\]:hidden[\s\S]{0,60}Ventrio/.test(shell),
  "eight pixels of a letter is not a collapsed state");
check("and the mark centres in the rail",
  /group-data-\[collapsible=icon\]:justify-center/.test(shell));

/**
 * The rail's own padding (`p-2`) plus a `size-8` button is exactly 48px. Any
 * other icon width leaves every glyph sitting off-centre against one edge.
 */
check("the icon rail is as wide as its contents",
  /"--sidebar-width-icon":\s*"3rem"/.test(shell),
  "3.25rem left a 4px bias that made the whole rail look misaligned");

check("search is reachable from the rail", /setSearchOpen\(true\)/.test(shell));

/**
 * The footer is the signed-in person, not two more destinations. It was a
 * "Settings" row and an "Account" row that looked like navigation; the account
 * menu is where the settings sections and signing out actually live.
 */
check("the account footer opens a menu rather than linking away",
  /DropdownMenuTrigger/.test(shell) && /signOutAction/.test(shell),
  "a footer of loose links is not an account");
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
/**
 * CONTRAST, MEASURED FROM THE oklch TOKENS.
 *
 * The palette is the supplied shadcn set and is written in oklch, so the old
 * hex parser could not read it — and a contrast suite that silently stops
 * measuring is worse than none. This converts oklch → linear sRGB → relative
 * luminance, which is what WCAG is defined on.
 */
const oklchToRgb = (L: number, C: number, H: number): [number, number, number] => {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const bb = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * bb) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * bb) ** 3;
  const s2 = (L - 0.0894841775 * a - 1.291485548 * bb) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s2,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s2,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s2,
  ];
  return lin.map((v) => Math.min(1, Math.max(0, v))) as [number, number, number];
};

/**
 * Reads `oklch(L C H)` out of a declaration, following aliases.
 *
 * Two blocks, in order: `.studio` holds the platform's own `--color-*` names,
 * and those alias onto the shadcn token set, which lives at `:root` in
 * globals.css. Resolving only the first one made every alias a dead end.
 */
const oklch = (name: string): [number, number, number] => {
  for (const block of paletteBlocks) {
    const direct = block.match(new RegExp(`${name}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\)`));
    if (direct) return oklchToRgb(Number(direct[1]), Number(direct[2]), Number(direct[3]));
  }
  for (const block of paletteBlocks) {
    const alias = block.match(new RegExp(`${name}:\\s*var\\((--[\\w-]+)\\)`));
    if (alias) return oklch(alias[1]);
  }
  throw new Error(`no oklch value for ${name}`);
};

const luminance = (c: [number, number, number]) => {
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: [number, number, number], b: [number, number, number]) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

const background = oklch("--background");
const muted = oklch("--muted");
const foreground = oklch("--foreground");
const inkSecondary = oklch("--color-ink-secondary");
const inkMuted = oklch("--color-ink-muted");
const primary = oklch("--primary");
const primaryFg = oklch("--primary-foreground");
const borderTok = oklch("--border");

check("body text is legible", contrast(foreground, background) >= 7,
  contrast(foreground, background).toFixed(2));
check("secondary text passes AA", contrast(inkSecondary, background) >= 4.5,
  contrast(inkSecondary, background).toFixed(2));
check("small print passes AA on the background", contrast(inkMuted, background) >= 4.5,
  contrast(inkMuted, background).toFixed(2));
check("and on a muted row", contrast(inkMuted, muted) >= 4.5,
  contrast(inkMuted, muted).toFixed(2));

/**
 * THE ONE DOCUMENTED DEVIATION FROM THE SUPPLIED SET.
 *
 * `--muted-foreground` is 4.26:1 on the background and 3.86:1 on `--muted` —
 * under AA for text. It is kept verbatim because the token set is the source of
 * truth, and it is used for icons, placeholders and rules where the text rule
 * does not bind. Small TEXT reads `--color-ink-muted`, which is checked above.
 * This asserts the two are genuinely different, so a later edit cannot quietly
 * point body copy back at the failing one.
 */
check("the AA-safe muted ink is not just an alias of --muted-foreground",
  !/--color-ink-muted:\s*var\(--muted-foreground\)/.test(studioBlock));

check("a primary button label is legible", contrast(primaryFg, primary) >= 4.5,
  contrast(primaryFg, primary).toFixed(2));
check("a hairline is visible against the background",
  contrast(borderTok, background) >= 1.15,
  contrast(borderTok, background).toFixed(3));

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

const empty = nocode(read("src/components/ui/shadcn/empty.tsx"));
check("the empty state is not a drop zone",
  !/\bborder(-[0-9]|-x|-y|-t|-r|-b|-l)?\s/.test(empty.replace(/border-dashed/g, "")),
  "border-dashed alone sets a style on a zero-width border and draws nothing; " +
  "adding any border width would turn every empty state into a file drop target");

const skeleton = nocode(read("src/components/ui/shadcn/skeleton.tsx"));
check("a placeholder has the geometry of the thing it replaces",
  /rounded-md/.test(skeleton) && !/rounded-3xl/.test(skeleton),
  "rounded-3xl against a 16px card re-flowed the list the moment data arrived");

const badge = nocode(read("src/components/ui/shadcn/badge.tsx"));
check("badge text is meta-sized, not the product's smallest",
  /text-\[0\.8125rem\]/.test(badge));

/* ── report ──────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} failed, ${passed} passed\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`✓ design system: ${passed} checks passed`);
