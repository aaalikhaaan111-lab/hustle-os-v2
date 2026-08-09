/**
 * Regression tests for per-project design strategy.
 *
 *   npx tsx scripts/design-strategy.test.mts
 *
 * Different ideas produced sites with the same underlying composition. The
 * cause was not the prompt: the page was a fixed JSX sequence — hero with the
 * headline left and a visual right, an identity/audience/value grid, sections,
 * a form, a launch block, a footer — and the model only chose a theme, three
 * colours and which section kinds appeared. Every decision a designer actually
 * makes was already made, in code, identically for every project.
 *
 * The strategy is a closed set of enumerations the model picks from, validated
 * server-side and turned into layout by CSS. It is not a licence to emit
 * markup, styles, URLs or script — those boundaries are unchanged.
 */

import { readFileSync } from "node:fs";
import {
  sanitizeDesignStrategy,
  sanitizeStage3Output,
  DEFAULT_DESIGN_STRATEGY,
  buildStage3OutputJsonSchema,
} from "../src/lib/build/stage3Types";
import { CHRONOVERSE_OUTPUT, DESIGN_VARIANTS } from "../src/lib/build/outputFixtures";
import { ART_DIRECTIONS, resolveArtDirection } from "../src/lib/build/artDirection";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const renderer = read("src/components/build/ProjectOutputRenderer.tsx");
const css = read("src/app/globals.css");
const prompt = read("src/lib/actions/stage3.ts");

/* ── 1. the decisions exist, are validated, and degrade safely ──────────── */

const schema = buildStage3OutputJsonSchema() as unknown as {
  required: string[];
  properties: { design: { properties: Record<string, unknown>; required: string[] } };
};
check("design is part of the model's schema", schema.required.includes("design"));
check("the model chooses one direction, not fourteen knobs", schema.properties.design.required.length === 1 && schema.properties.design.required[0] === "artDirection");

// Every field is a closed enumeration — the model never writes CSS or markup.
const directionField = schema.properties.design.properties.artDirection as { enum?: string[] };
check("the direction is a closed enumeration, never free text", Array.isArray(directionField.enum) && directionField.enum.length === 8);

// An artifact from before the strategy existed still renders.
check("a missing strategy falls back to a coherent default", sanitizeDesignStrategy(undefined).archetype === DEFAULT_DESIGN_STRATEGY.archetype);
// Layout is no longer assembled field by field, so a stray value cannot
// produce an incoherent page: the direction supplies the whole system.
check(
  "a direction supplies the whole system",
  sanitizeDesignStrategy({ artDirection: "technical_data" }).typeSystem === "technical_mono",
);
check(
  "a legacy per-field artifact still renders",
  sanitizeDesignStrategy({ density: "tight" }).artDirection === DEFAULT_DESIGN_STRATEGY.artDirection,
);

/* ── 2. the artifact is internally coherent ─────────────────────────────── */

// Observed while testing: warm_archive is the stat-led direction, and it can
// land on content with no stat. Rendered literally that set a whole sentence at
// stat size; ignored, it silently fell back to the default hero, which is how
// sameness returns. The coherence pass runs after the direction resolves.
const statLedNoStat = sanitizeStage3Output({
  ...CHRONOVERSE_OUTPUT,
  design: { artDirection: "warm_archive" },
});
check(
  "a stat-led direction without a stat is downgraded, not faked",
  statLedNoStat?.design.heroComposition === "panel",
  statLedNoStat?.design.heroComposition,
);

const statLedWithStat = sanitizeStage3Output({
  ...CHRONOVERSE_OUTPUT,
  hero: { ...CHRONOVERSE_OUTPUT.hero, visualKind: "stat", visualPrompt: "1943 → earliest year" },
  design: { artDirection: "warm_archive" },
});
check("a stat-led direction with a real stat is kept", statLedWithStat?.design.heroComposition === "stat_led");

// A typographic composition renders no visual, so an imagery decision would
// have nothing to apply to.
const lede = sanitizeStage3Output({
  ...CHRONOVERSE_OUTPUT,
  design: { artDirection: "editorial_magazine" },
});
check("a typographic hero carries no imagery", lede?.design.imageryStrategy === "none");

/* ── 3. the renderer acts on the decisions ──────────────────────────────── */

for (const attr of ["data-hero", "data-density", "data-type-scale", "data-grid", "data-cards", "data-corners", "data-color-logic", "data-imagery", "data-motion", "data-cta", "data-nav"]) {
  check(`the renderer exposes ${attr}`, renderer.includes(attr));
}
check("the identity grid is no longer unconditional", /\{design\.showIdentityBlock && \(/.test(renderer));
check("the launch block is no longer unconditional", /\{design\.showLaunchBlock && \(/.test(renderer));
check(
  "typographic compositions render no hero visual",
  /design\.heroComposition !== "editorial_lede" && design\.heroComposition !== "full_bleed_type"/.test(renderer),
);
// The placeholder box shown as if it were finished content is gone.
check("the diamond placeholder is gone", !renderer.includes("◆"));
check('"no imagery" renders nothing rather than a box', /design\.imageryStrategy === "none"\) return null/.test(renderer));

/* ── 4. the stylesheet turns decisions into layout ──────────────────────── */

for (const selector of ['[data-hero="stacked_center"]', '[data-hero="editorial_lede"]', '[data-hero="stat_led"]', '[data-hero="panel"]', '[data-hero="full_bleed_type"]', '[data-density="tight"]', '[data-density="airy"]', '[data-type-scale="compact"]', '[data-type-scale="dramatic"]', '[data-grid="asymmetric"]', '[data-cards="raised"]', '[data-corners="pill"]']) {
  check(`css honours ${selector}`, css.includes(selector));
}
// Mobile safety is not negotiable: no composition may reintroduce columns.
check(
  "every composition collapses to one column on mobile",
  /@media \(max-width: 859px\)[\s\S]{0,240}grid-template-columns: minmax\(0, 1fr\)/.test(css),
);

/* ── 5. the model is told to decide, not to fill a template ─────────────── */

check("the prompt asks for an art direction", /CHOOSE THE ART DIRECTION/.test(prompt));
check("all eight directions are described to the model", ART_DIRECTIONS.every((d) => prompt.includes(d)));
check(
  "and it is told not to keep picking the same one",
  /Do not default to the same direction repeatedly/.test(prompt),
);

/* ── 7. typography and surface actually differ in the stylesheet ────────── */

for (const sys of ["editorial_serif", "expressive_display", "condensed_poster", "luxury_oldstyle", "technical_mono", "geometric_sans"]) {
  check(`css defines the ${sys} type system`, css.includes(`[data-type-system="${sys}"]`));
}
for (const surf of ["editorial_paper", "deep_canvas", "atmospheric_gradient", "geometric_grid", "grain_field", "radial_glow", "colour_fields", "mono_contrast"]) {
  check(`css defines the ${surf} surface`, css.includes(`[data-surface="${surf}"]`));
}
// Six distinct display faces, not six sizes of one.
const faceVars = ["--font-display-editorial", "--font-display-expressive", "--font-display-condensed", "--font-display-luxury", "--font-display-technical", "--font-body-geometric"];
for (const v of faceVars) check(`${v} is wired to a real face`, css.includes(v));
const layout = read("src/app/layout.tsx");
for (const v of faceVars) check(`${v} is loaded by the app`, layout.includes(v));
check("every loaded face declares Cyrillic", (layout.match(/subsets: \["latin", "cyrillic"\]/g) ?? []).length >= 9);
// Long copy is never set in a display-only face.
check(
  "condensed and mono do not set body copy",
  /\[data-type-system="condensed_poster"\] \.project-output-subtitle[\s\S]{0,160}--font-body-geometric/.test(css),
);
check("reduced motion is honoured", /prefers-reduced-motion: reduce[\s\S]{0,200}animation: none/.test(css));

/* ── 6. the art directions really are different systems ────────────────── */

const variants = ART_DIRECTIONS;
check("eight art directions are defined", variants.length === 8);

// Diversity is judged on the whole system, not on colour. Typography and
// surface are the two the previous attempt did not vary at all, which is why
// the outputs still read as one template family.
const systems = ["typeSystem", "surface", "graphic", "motion"] as const;
for (const s of systems) {
  const distinct = new Set(variants.map((v) => DESIGN_VARIANTS[v][s])).size;
  check(`${s} varies across directions`, distinct >= 4, `${distinct} distinct values`);
}

const layoutDims = ["heroComposition", "typeScale", "density", "grid", "cardTreatment", "cornerStyle", "colorLogic"] as const;
for (const d of layoutDims) {
  const distinct = new Set(variants.map((v) => DESIGN_VARIANTS[v][d])).size;
  check(`${d} varies across directions`, distinct >= 3, `${distinct} distinct values`);
}

// No two directions may be the same system wearing a different name.
const fingerprints = variants.map((v) =>
  [...systems, ...layoutDims].map((k) => DESIGN_VARIANTS[v][k]).join("|"),
);
check("no two directions resolve to the same system", new Set(fingerprints).size === variants.length);

// Coherence is by construction: the layout is not assembled field by field.
check(
  "a direction resolves the whole strategy",
  resolveArtDirection("luxury_minimal").typeSystem === "luxury_oldstyle"
    && resolveArtDirection("luxury_minimal").grid === "wide_gutter",
);
check(
  "an unknown direction cannot be smuggled in",
  sanitizeDesignStrategy({ artDirection: "gamer_rgb" }).artDirection === DEFAULT_DESIGN_STRATEGY.artDirection,
);

/* ── report ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`FAILED ${failures.length} of ${passed + failures.length}`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`design strategy: ${passed} checks passed`);
