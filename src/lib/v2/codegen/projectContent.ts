/**
 * A real project's words, as a content pack the codegen contract can use.
 *
 * This is the bridge that makes the prototype a product rather than a gallery.
 * The prototype compiled against one hand-written pack about a fictional build
 * log; production has to compile against whatever the person actually asked
 * for. Everything a page needs to say already exists in `Stage3ProjectOutput`,
 * so nothing new is generated here and no second model call is needed to get
 * copy — this is a projection of an artifact that has already been sanitised.
 *
 * Why a projection rather than letting the model write words directly: the
 * reject pass refuses literal prose in markup (`literal_copy`), which is what
 * stops a generated page inventing a plan name or a statistic. That rule only
 * has teeth if there is a pack to resolve tokens against. So the split is:
 * Ventrio owns the words, the model owns the design.
 *
 * Keys are stable and derived positionally, because the prompt has to list them
 * and a model cannot reference a key it was not told about. Section keys are
 * numbered from 1 in artifact order — `section1.title`, `section1.item1.title`
 * — so a bundle can address any section without knowing what kind it is.
 */

import type {
  Stage3ProjectOutput,
  Stage3Section,
} from "@/lib/build/stage3Types";
import { CODEGEN_BUDGETS } from "./budgets";
import type { ContentPack } from "./content";

/**
 * Trims and collapses whitespace, then bounds the length.
 *
 * The bound matters: `validateContentPack` refuses an over-long value, and a
 * pack that fails validation would fail the whole compile after the model has
 * already been paid for. Ventrio's own copy should never reach the ceiling, so
 * truncating here rather than refusing keeps a pathological artifact from
 * costing a generation. Truncation is at a word boundary with an ellipsis so it
 * reads as shortened rather than as corrupted.
 */
function clean(value: unknown): string {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  const max = CODEGEN_BUDGETS.maxContentValueChars;
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Adds a key only when there is something to say. An empty value is a hole. */
function put(pack: Record<string, string>, key: string, value: unknown): void {
  const text = clean(value);
  if (text) pack[key] = text;
}

function addSection(pack: Record<string, string>, index: number, section: Stage3Section): void {
  const at = `section${index}`;
  put(pack, `${at}.title`, section.title);
  put(pack, `${at}.body`, section.body);
  // `kind` is exposed so the prompt can tell the model what a section is *for*
  // without the model having to infer it from the copy. It is a content value
  // like any other, and refused as page text unless a bundle deliberately
  // prints it.
  put(pack, `${at}.kind`, section.kind);

  switch (section.kind) {
    case "showcase":
      section.items.forEach((item, i) => {
        put(pack, `${at}.item${i + 1}.title`, item.title);
        put(pack, `${at}.item${i + 1}.body`, item.body);
      });
      break;
    case "stats":
      // The one place the artifact carries real numbers. Kept as value/label
      // pairs so a bundle can set the number large and the label small, which
      // is the whole point of a stats band and impossible if they are merged.
      section.stats.forEach((stat, i) => {
        put(pack, `${at}.stat${i + 1}.value`, stat.value);
        put(pack, `${at}.stat${i + 1}.label`, stat.label);
      });
      break;
    case "process":
      section.steps.forEach((step, i) => {
        put(pack, `${at}.step${i + 1}.title`, step.title);
        put(pack, `${at}.step${i + 1}.body`, step.body);
      });
      break;
    case "compare":
      // Shape varies by artifact version; read defensively rather than
      // asserting, because an older stored artifact still has to render.
      for (const [i, row] of (asRows(section) ?? []).entries()) {
        put(pack, `${at}.row${i + 1}.label`, row.label);
        put(pack, `${at}.row${i + 1}.before`, row.before);
        put(pack, `${at}.row${i + 1}.after`, row.after);
      }
      break;
    case "story":
    case "interactive":
      // Nothing beyond title and body belongs on a static page: an interactive
      // experience is a runtime thing and the codegen contract has no script.
      break;
  }
}

interface CompareRow { label: string; before: string; after: string }

function asRows(section: Stage3Section): CompareRow[] | null {
  const rows = (section as { rows?: unknown }).rows;
  if (!Array.isArray(rows)) return null;
  return rows.flatMap((row) => {
    if (typeof row !== "object" || row === null) return [];
    const { label, before, after } = row as Record<string, unknown>;
    return [{ label: clean(label), before: clean(before), after: clean(after) }];
  });
}

/**
 * Projects a generated artifact onto the codegen content contract.
 *
 * The result is always a legal pack: keys match `CONTENT_KEY_PATTERN` by
 * construction, values are bounded, and empty values are omitted rather than
 * included as blanks a page would render as a gap.
 */
export function projectContentPack(output: Stage3ProjectOutput): ContentPack {
  const pack: Record<string, string> = {};

  put(pack, "brand.name", output.identity.name);
  put(pack, "brand.tagline", output.identity.tagline);
  put(pack, "brand.description", output.identity.description);

  put(pack, "hero.eyebrow", output.hero.eyebrow);
  put(pack, "hero.title", output.hero.headline);
  put(pack, "hero.body", output.hero.subheadline);
  put(pack, "hero.cta", output.cta.label);

  put(pack, "audience.body", output.targetUser);
  put(pack, "value.body", output.primaryValue);

  put(pack, "cta.title", output.cta.label);
  put(pack, "cta.body", output.cta.supportingText);
  put(pack, "cta.button", output.cta.label);

  put(pack, "launch.title", output.launchCopy.headline);
  put(pack, "launch.body", output.launchCopy.body);

  put(pack, "form.title", output.form.title);
  put(pack, "form.body", output.form.description);

  output.sections.forEach((section, i) => addSection(pack, i + 1, section));

  put(pack, "page.home.title", `${output.identity.name} — ${output.identity.tagline}`);
  put(pack, "footer.note", output.identity.description);

  return pack;
}

/**
 * The pack's keys, grouped and sorted, for the prompt.
 *
 * Generated from the pack itself rather than hand-listed: a prompt that
 * advertises a key the pack does not carry produces an `unknown_content_key`
 * rejection, and discovering that costs a paid request.
 */
export function describeProjectContent(pack: ContentPack): string {
  return Object.keys(pack).sort().join("\n");
}
