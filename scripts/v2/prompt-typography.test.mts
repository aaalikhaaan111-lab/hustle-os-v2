/**
 * The 12px floor, as the model is told about it.
 *
 *   npx tsx --conditions=react-server scripts/v2/prompt-typography.test.mts
 *
 * THE FAILURE THIS GUARDS. Sub-12px text is the dominant reason a generated
 * project is refused, across the canary corpus and production alike:
 *
 *   c3-final    src/styles.css                      .text-[10px]     1 violation
 *   c3-gate     SubscriptionTiers, CheckoutModal, Footer  text-[11px]   3
 *   2026-08-12  CardPreview, WoodCalculator, PrintSheet,
 *               InteractiveChecklist                text-[10px]/[11px]  8
 *
 * The rule already existed and said "Nothing below 12px" in prose. It never
 * named the utilities the model actually writes, and the model kept writing
 * them. The last of those runs is the sharpest evidence: a *repair* sent to fix
 * a framing error introduced eight fresh violations, because nothing told it
 * that fixing one refusal does not suspend the other rules.
 *
 * So this pins the instruction, not the behaviour — what the model does with it
 * is measured in production, not here. What is checkable is that both prompts
 * name the forbidden values exactly, keep 12px itself legal, and that the
 * validator's own threshold was not quietly moved to make the problem go away.
 *
 * Offline.
 */

import { readFileSync } from "node:fs";
import { appRepairPrompt, appRewritePrompt, appSystemPrompt } from "../../src/lib/v2/app/prompt";
import { MIN_FONT_PX, findUndersizedText, undersizedDiagnostics } from "../../src/lib/v2/app/typography";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const generation = appSystemPrompt("react-spa");
const repair = appRepairPrompt(
  ['src/App.tsx: require — require() is not available; use ES imports.'],
  { manifest: ["src/App.tsx"], files: { "src/App.tsx": "export default function A(){return null;}" }, partial: false },
);
const rewrite = appRewritePrompt("Build a thing.", ["src/App.tsx: something was wrong"]);

/* ── 1. the forbidden values are named, in every prompt ──────────────────── */

/**
 * Named literally, because "nothing below 12px" demonstrably did not connect to
 * "do not write text-[10px]" — that prose was already there through every run
 * in the table above.
 */
const FORBIDDEN = ["text-[10px]", "text-[11px]", "text-[0.625rem]", "text-[0.6875rem]"];

for (const [label, prompt] of [["generation", generation], ["repair", repair], ["rewrite", rewrite]] as const) {
  check(`the ${label} prompt states the 12px minimum`, /12px/.test(prompt));
  for (const token of FORBIDDEN) {
    check(`the ${label} prompt names ${token} as forbidden`, prompt.includes(token), token);
  }
  // The floor is a floor, not a ban on small text: 12px itself must stay legal
  // or the model will over-correct everything to 14px and lose the hierarchy.
  check(`the ${label} prompt keeps 12px itself allowed`, /text-xs/.test(prompt));
  check(`the ${label} prompt says which sizes to use instead`,
    /text-sm/.test(prompt) && /text-base/.test(prompt));
}

/* ── 2. the rule covers px, rem and em — not just the four examples ──────── */

for (const [label, prompt] of [["generation", generation], ["repair", repair], ["rewrite", rewrite]] as const) {
  check(`the ${label} prompt generalises beyond the examples`,
    /computing below 12px|computes below 12px/.test(prompt) && /px, rem or em/.test(prompt));
}

/* ── 3. generation asks for a final self-check ───────────────────────────── */

check("generation asks the model to re-read its own font sizes before finishing",
  /read back every font-size|re-read the font sizes/.test(generation));
check("and says this is the most common refusal",
  /most common reason a\s+project is refused/.test(generation));

/* ── 4. non-text values are explicitly still allowed ─────────────────────── */

/**
 * Without this the rule reads as "no arbitrary values", and a model that
 * believes that will stop using them for spacing and borders too — which is
 * both wrong and a visible quality loss.
 */
check("generation exempts spacing, borders and icon sizes",
  /spacing, borders, radii/.test(generation) && /unaffected/.test(generation));
check("and the repair says the same", /Non-text values/.test(repair));

/* ── 5. a repair must preserve every other rule ──────────────────────────── */

/**
 * The specific production failure: a repair fixed its named framing error and
 * returned eight new typography violations. Fixing one refusal does not suspend
 * the rest, and the model has to be told so before it writes.
 */
for (const [label, prompt] of [["repair", repair], ["rewrite", rewrite]] as const) {
  check(`the ${label} prompt says every original rule still applies`,
    /EVERY ORIGINAL RULE STILL APPLIES/.test(prompt));
  check(`the ${label} prompt says the whole project is re-validated`,
    /validated again in full/.test(prompt));
  check(`the ${label} prompt refuses a fix that introduces a new failure`,
    /introducing a different one is refused/.test(prompt));
  check(`the ${label} prompt covers files touched for unrelated reasons`,
    /only\s+editing for an unrelated reason/.test(prompt));
  check(`the ${label} prompt asks for a font-size re-read before returning`,
    /re-read the font sizes in every file/.test(prompt));
}

/* ── 6. the repair still carries what it always carried ──────────────────── */

// Strengthening the rules must not have displaced the repair's actual content.
check("the repair still lists the diagnostics it was sent", repair.includes("require() is not available"));
check("and still shows the file it must patch", repair.includes("src/App.tsx"));
check("and still demands the framed patch contract", /"schemaVersion"/.test(repair) && /"write"/.test(repair));
check("the rewrite still restates the brief", rewrite.includes("Build a thing."));

/* ── 7. the validator itself is untouched ────────────────────────────────── */

/**
 * The whole point is that the gate was right. If a future edit "fixes" the pass
 * rate by moving the threshold, this fails.
 */
check("the enforced minimum is still 12px", MIN_FONT_PX === 12, String(MIN_FONT_PX));

const typography = readFileSync(new URL("../../src/lib/v2/app/typography.ts", import.meta.url), "utf8");
check("declared as a constant, not a literal sprinkled around",
  /export const MIN_FONT_PX = 12;/.test(typography));

// And it still catches exactly what production caught. The validator reads the
// compiled CSS and attributes each rule back to the files that used the class,
// which is how the production diagnostics named five components.
{
  const css = ".text-\\[10px\\]{font-size:10px}.text-\\[11px\\]{font-size:11px}";
  const files = {
    "src/components/CardPreview.tsx": 'export default () => <p className="text-[10px]">x</p>;',
    "src/components/WoodCalculator.tsx": 'export default () => <p className="text-[11px]">x</p>;',
  };
  const rules = findUndersizedText(css);
  check("text-[10px] is still refused", rules.some((r) => r.px === 10), JSON.stringify(rules));
  check("text-[11px] is still refused", rules.some((r) => r.px === 11));

  const diagnostics = undersizedDiagnostics(rules, files);
  check("and each violation names the file that wrote it",
    diagnostics.some((d) => d.file === "src/components/CardPreview.tsx")
      && diagnostics.some((d) => d.file === "src/components/WoodCalculator.tsx"),
    JSON.stringify(diagnostics.map((d) => d.file)));
  check("with the 12px minimum in the message",
    diagnostics.every((d) => d.text.includes("12px minimum")));
}
{
  // The floor, and above it: none of these may be refused, or the model would
  // be pushed to over-correct and lose the hierarchy entirely.
  const css = ".text-xs{font-size:.75rem}.text-\\[12px\\]{font-size:12px}.text-sm{font-size:.875rem}.text-base{font-size:1rem}";
  check("12px and above still passes", findUndersizedText(css).length === 0,
    JSON.stringify(findUndersizedText(css)));
}
{
  // Non-text arbitrary values must not be caught by the rule the prompt states.
  const css = ".gap-\\[10px\\]{gap:10px}.border-\\[1px\\]{border-width:1px}.w-\\[11px\\]{width:11px}";
  check("non-text arbitrary values are not typography violations",
    findUndersizedText(css).length === 0);
}

/* ── report ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`FAILED ${failures.length} of ${passed + failures.length}`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`prompt typography: ${passed} checks passed`);
