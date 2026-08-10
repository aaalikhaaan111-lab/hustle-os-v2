import "server-only";

/**
 * The one typographic rule Ventrio enforces: text has to be readable.
 *
 * A live generation shipped six labels at 10px — project chips and tags, the
 * things you actually read to use the board. Nothing in the pipeline noticed,
 * because the size was correct CSS produced by a correct compile; it was only
 * wrong for a human.
 *
 * This is checked on the compiled stylesheet rather than on the source. The
 * source says `text-[10px]`, which means nothing without Tailwind's scale
 * resolved, and a rule that pattern-matches class names would miss a raw CSS
 * declaration and a custom property alike. The compiled CSS is where the
 * actual number is.
 *
 * DELIBERATELY ONE RULE, not a type system. Ventrio does not pick the model's
 * sizes, scale, or hierarchy — it refuses text nobody can read. Everything
 * above the floor is the model's business.
 */

/** Below this, text is not readable in a product UI. */
export const MIN_FONT_PX = 12;

/**
 * Declarations exempt from the floor.
 *
 * `0` and inherited/relative keywords are not sizes. Everything else is.
 */
const IGNORED = /^(0|inherit|initial|unset|revert|auto|smaller|larger)$/i;

export interface UndersizedRule {
  /** The selector the declaration belongs to, as written in the output. */
  selector: string;
  px: number;
  declaration: string;
}

/** 16px root, which is what the sandbox document uses. */
function toPx(value: string): number | null {
  const match = /^(-?[\d.]+)(px|rem|em|pt)?$/.exec(value.trim());
  if (!match) return null;
  const size = Number.parseFloat(match[1]);
  if (!Number.isFinite(size)) return null;
  switch (match[2]) {
    case "rem":
    case "em":
      return size * 16;
    case "pt":
      return size * (96 / 72);
    case "px":
    case undefined:
      return size;
    default:
      return null;
  }
}

/**
 * Finds every font-size in the compiled CSS that falls below the floor.
 *
 * Walks backwards from each declaration to the nearest preceding selector so
 * the diagnostic can name the class the model wrote — "somewhere in your CSS"
 * is not something a repair can act on.
 */
export function findUndersizedText(css: string): UndersizedRule[] {
  const found: UndersizedRule[] = [];
  const seen = new Set<string>();

  for (const match of css.matchAll(/font-size:\s*([^;}]+)[;}]/g)) {
    const raw = match[1].trim();
    if (IGNORED.test(raw)) continue;
    // A var() or calc() cannot be resolved statically. Tailwind emits those
    // for its own scale, whose smallest step is 0.75rem — at the floor, not
    // under it — so they are left alone rather than guessed at.
    if (/var\(|calc\(|clamp\(|%/.test(raw)) continue;

    const px = toPx(raw);
    if (px === null || px >= MIN_FONT_PX) continue;

    const before = css.slice(0, match.index ?? 0);
    const selectorMatch = [...before.matchAll(/([^{};]+)\{/g)].pop();
    const selector = (selectorMatch?.[1] ?? "?").trim().split("\n").pop()!.trim().slice(0, 80);

    const key = `${selector}|${px}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ selector, px, declaration: `font-size: ${raw}` });
  }

  return found;
}

/** The diagnostics a refusal carries, phrased for the model that must fix it. */
export function describeUndersized(rules: UndersizedRule[]): string[] {
  return rules.map(
    (rule) =>
      `${rule.selector} sets ${rule.declaration} (${rule.px}px). ` +
      `The minimum is ${MIN_FONT_PX}px; use 14–16px for anything read as copy.`,
  );
}
