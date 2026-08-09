/**
 * What the codegen model is told about the project.
 *
 * The brief describes the product and the intent. It never contains page copy —
 * that arrives as the content pack, and keeping the two apart is what lets the
 * gate refuse literal prose in markup. If the brief carried sentences meant for
 * the page, the model would have every reason to type them out.
 *
 * The two intake answers land here. That is the whole reason the intake exists:
 * a person picks what they are making and how it should feel, and those two
 * choices have to reach the thing that decides the design. In the fixed
 * renderer they were funnelled into an enum and mostly averaged away. Here they
 * are stated plainly and the model composes against them.
 *
 * A deferred answer contributes nothing rather than a placeholder — the same
 * rule `intakeGenerationBrief` already follows. "Let Ventrio decide" has to
 * leave the generator as free as it would have been without the question.
 */

import type { Stage3ProjectOutput } from "@/lib/build/stage3Types";

export interface CodegenBriefInput {
  output: Stage3ProjectOutput;
  /** Canonical English descriptors from `intakeGenerationBrief`. */
  intake?: { productType?: string; designDirection?: string } | null;
  /** The project's language, so the design suits the script it will carry. */
  locale: string;
}

/**
 * The section kinds present, named for the model.
 *
 * Given without prescribing a layout: knowing a project has three showcase
 * items and a four-row comparison is what lets the model choose a bento grid
 * or a table rather than guessing from key names. Deciding *how* to render
 * them is the model's job and the whole point of replacing the fixed renderer.
 */
function describeSections(output: Stage3ProjectOutput): string {
  if (output.sections.length === 0) return "  (no sections beyond the hero)";
  return output.sections
    .map((section, i) => {
      const at = `section${i + 1}`;
      switch (section.kind) {
        case "showcase":
          return `  ${at} — showcase, ${section.items.length} item(s)`;
        case "stats":
          return `  ${at} — stats, ${section.stats.length} value/label pair(s)`;
        case "process":
          return `  ${at} — process, ${section.steps.length} step(s)`;
        case "compare": {
          const rows = (section as { rows?: unknown[] }).rows;
          return `  ${at} — comparison, ${Array.isArray(rows) ? rows.length : 0} row(s)`;
        }
        case "interactive":
          // Says plainly that it is prose here. The contract has no script, and
          // a model told "interactive" without that caveat will build controls
          // that do nothing — which looks like a broken page, not a static one.
          return `  ${at} — interactive in the product; on this page it is a titled prose block`;
        case "story":
        default:
          return `  ${at} — prose`;
      }
    })
    .join("\n");
}

export function buildCodegenBrief(input: CodegenBriefInput): string {
  const { output, intake, locale } = input;
  const lines: string[] = [];

  lines.push(`${output.identity.name} — ${output.identity.tagline}`);
  lines.push(output.identity.description);
  lines.push("");
  lines.push(`For: ${output.targetUser}`);
  lines.push(`Its point: ${output.primaryValue}`);
  lines.push("");

  if (intake?.productType) lines.push(`The person asked for: ${intake.productType}.`);
  if (intake?.designDirection) {
    lines.push(`They chose this visual direction: ${intake.designDirection}.`);
    lines.push("Commit to it. A direction half-applied reads as no direction at all.");
  } else {
    lines.push(
      "No visual direction was chosen, so pick one that suits this product and commit to it.",
    );
  }

  lines.push("");
  lines.push(`Language on the page: ${locale}. All copy arrives as content tokens; set type that suits that script.`);
  lines.push("");
  lines.push("CONTENT STRUCTURE");
  lines.push(describeSections(output));

  return lines.join("\n");
}

/**
 * The routes to build.
 *
 * One, today. The artifact has no second page in it — there is no pricing table
 * or FAQ content that is not already inside a section — and generating a route
 * with nothing to put on it is how the earlier renderer produced empty columns.
 * The contract allows up to `maxRoutes`, so this grows when the artifact does,
 * not before.
 */
export function codegenRoutesFor(output: Stage3ProjectOutput): Array<{ path: string; purpose: string }> {
  return [
    {
      path: "/",
      purpose: `the whole product in one page: hero, ${output.sections.length} section(s), and a closing call to action`,
    },
  ];
}
