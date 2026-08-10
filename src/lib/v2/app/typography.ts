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

/* ── attributing a compiled rule back to the file that caused it ─────────── */

/** Files whose text can legitimately contain a class name. */
const SOURCE = /\.(tsx|ts|jsx|js)$/;
const STYLESHEET = /\.css$/;

/**
 * Turns a compiled selector back into the token a developer wrote.
 *
 * `.text-\[10px\]` is how CSS escapes the class `text-[10px]`. Unescaping is a
 * single character-level rule and is the whole of the "parsing" here — there is
 * no Tailwind grammar involved, and there does not need to be.
 */
export function classTokenFrom(selector: string): string {
  return selector.replace(/^\./, "").replace(/\\(.)/g, "$1");
}

export interface AttributedRule extends UndersizedRule {
  /** Every project file that contains the offending declaration or class. */
  files: string[];
}

/**
 * Finds which generated files are responsible for an undersized rule.
 *
 * THE BUG THIS FIXES. Every undersized diagnostic was reported against
 * `src/styles.css`, hardcoded. A live landing-page generation put
 * `text-[10px]` in `src/App.tsx` and `src/components/SubscribeModal.tsx` and
 * nowhere in the stylesheet, so the one allowed repair was handed a file that
 * could not contain the fix; the model dutifully wrote a CSS override, which
 * cannot remove a utility class emitted from a component, and the rebuild
 * failed with the identical error.
 *
 * A stylesheet is checked first because a rule literally written in CSS
 * belongs to that CSS. Only when no stylesheet declares the selector is it
 * treated as a utility class and looked for in source. When neither matches,
 * the rule carries no file rather than a wrong one — an unattributed
 * diagnostic is honest, and a misattributed one costs a repair.
 */
export function attributeUndersized(
  rules: UndersizedRule[],
  files: Record<string, string>,
): AttributedRule[] {
  const entries = Object.entries(files);
  return rules.map((rule) => {
    const declaring = entries
      .filter(([path, source]) => STYLESHEET.test(path) && source.includes(rule.selector))
      .map(([path]) => path);
    if (declaring.length > 0) return { ...rule, files: declaring };

    const token = classTokenFrom(rule.selector);
    const using = token
      ? entries.filter(([path, source]) => SOURCE.test(path) && source.includes(token)).map(([path]) => path)
      : [];
    return { ...rule, files: using };
  });
}

/**
 * The diagnostics, one per offending file.
 *
 * Split per file on purpose: the repair loop collects the files its
 * diagnostics name and reproduces them for the model, so a violation in three
 * components has to produce three attributions or two of them are invisible to
 * the repair.
 */
export function undersizedDiagnostics(
  rules: UndersizedRule[],
  files: Record<string, string>,
): Array<{ file?: string; text: string }> {
  const out: Array<{ file?: string; text: string }> = [];
  for (const rule of attributeUndersized(rules, files)) {
    const token = classTokenFrom(rule.selector);
    const detail =
      `${rule.declaration} (${rule.px}px) is below the ${MIN_FONT_PX}px minimum; ` +
      `use 14–16px for anything read as copy.`;
    if (rule.files.length === 0) {
      out.push({ text: `${rule.selector}: ${detail}` });
      continue;
    }
    for (const file of rule.files) {
      out.push({
        file,
        text: STYLESHEET.test(file)
          ? `${rule.selector}: ${detail}`
          : `"${token}" is used here and ${detail}`,
      });
    }
  }
  return out;
}
