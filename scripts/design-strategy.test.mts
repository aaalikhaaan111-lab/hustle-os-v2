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
check("all 14 decisions are required of the model", schema.properties.design.required.length === 14);

// Every field is a closed enumeration — the model never writes CSS or markup.
const enumerated = Object.values(schema.properties.design.properties).filter(
  (field) => typeof field === "object" && field !== null && ("enum" in field || (field as { type?: string }).type === "boolean"),
);
check("every decision is an enum or boolean, never free text", enumerated.length === 14, String(enumerated.length));

// An artifact from before the strategy existed still renders.
check("a missing strategy falls back to a coherent default", sanitizeDesignStrategy(undefined).archetype === DEFAULT_DESIGN_STRATEGY.archetype);
check("an unknown value falls back per field", sanitizeDesignStrategy({ density: "cosmic" }).density === DEFAULT_DESIGN_STRATEGY.density);
check(
  "a known value is kept",
  sanitizeDesignStrategy({ density: "tight", cornerStyle: "pill" }).density === "tight",
);

/* ── 2. the artifact is internally coherent ─────────────────────────────── */

// Observed while testing: a "stat_led" strategy arrived on content with no
// stat. Rendered literally it set a whole sentence at stat size; ignored, it
// silently fell back to the default hero, which is how sameness returns.
const statLedNoStat = sanitizeStage3Output({
  ...CHRONOVERSE_OUTPUT,
  design: { ...DEFAULT_DESIGN_STRATEGY, heroComposition: "stat_led" },
});
check(
  "a stat-led hero without a stat is downgraded, not faked",
  statLedNoStat?.design.heroComposition === "panel",
  statLedNoStat?.design.heroComposition,
);

const statLedWithStat = sanitizeStage3Output({
  ...CHRONOVERSE_OUTPUT,
  hero: { ...CHRONOVERSE_OUTPUT.hero, visualKind: "stat", visualPrompt: "1943 → earliest year" },
  design: { ...DEFAULT_DESIGN_STRATEGY, heroComposition: "stat_led" },
});
check("a stat-led hero with a real stat is kept", statLedWithStat?.design.heroComposition === "stat_led");

// A typographic composition renders no visual, so an imagery decision would
// have nothing to apply to.
const lede = sanitizeStage3Output({
  ...CHRONOVERSE_OUTPUT,
  design: { ...DEFAULT_DESIGN_STRATEGY, heroComposition: "editorial_lede", imageryStrategy: "photographic" },
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

check("the prompt names the decision step", /DESIGN THE PAGE, DO NOT FILL A TEMPLATE/.test(prompt));
check(
  "and warns against the old universal default",
  /"split" is the old default for everything/.test(prompt),
);
check(
  'and treats "no image" as a strong answer',
  /"none" and "typographic" are strong answers/.test(prompt),
);

/* ── 6. the three test strategies really are different ──────────────────── */

const variants = Object.keys(DESIGN_VARIANTS);
check("three strategies are defined for comparison", variants.length === 3);
const dimensions = ["heroComposition", "typeScale", "density", "grid", "cardTreatment", "cornerStyle", "colorLogic", "imageryStrategy", "motionLevel", "ctaPattern"] as const;
const distinct = dimensions.filter(
  (d) => new Set(variants.map((v) => DESIGN_VARIANTS[v][d])).size === variants.length,
);
// Recolouring is not diversity: the composition dimensions must differ.
check(
  "all three differ on most design dimensions",
  distinct.length >= 8,
  `${distinct.length}/${dimensions.length} fully distinct: ${distinct.join(", ")}`,
);
check(
  "they do not share a hero composition",
  new Set(variants.map((v) => DESIGN_VARIANTS[v].heroComposition)).size === 3,
);

/* ── report ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`FAILED ${failures.length} of ${passed + failures.length}`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`design strategy: ${passed} checks passed`);
