/**
 * What the person wants done to the site that already exists.
 *
 * Editing was not missing — `editProjectOutputAction` has always sent the
 * current artifact and the requested change to the model and written back a new
 * one. What was missing is that most edit requests never reached it. The old
 * test matched a fixed verb list anchored to the *start* of the message, so
 * "поменяй шрифт и цвет фона на другой" was not an edit — "поменяй" was simply
 * not in the list — and the request fell through to the chat assistant, which
 * answered that the change had to be made in a design interface that does not
 * exist.
 *
 * So this is a vocabulary and routing problem, and it is fixed here rather than
 * by asking a model to classify: routing the product's central action through a
 * model is what let it be re-decided differently every turn.
 */

export type SiteIntent =
  | "EDIT_CURRENT"
  | "REGENERATE_STYLE"
  | "ADD_FEATURE"
  | "REMOVE_ELEMENT"
  | "UNDO"
  | "DISCUSS";

/* ── Undo ───────────────────────────────────────────────────────────────────
   Checked first: "верни предыдущую версию" also contains a change verb, and
   restoring is never a model call. */
const UNDO_RU = /(?:верн[иите]+\s+(?:как\s+было|предыдущ|прошл|обратно)|отмен[иите]+\s+(?:последн|изменен|правк)|откат[иь]|как\s+было\s+раньше)/i;
const UNDO_EN = /(?:\bundo\b|\brevert\b|roll\s*back|go\s+back\s+to\s+(?:the\s+)?(?:previous|last)\b|restore\s+(?:the\s+)?(?:previous|last)\b|bring\s+back\s+the\s+(?:previous|old)\b)/i;

/* ── Removal ──────────────────────────────────────────────────────────────── */
const REMOVE_RU = /(?:убер[иите]+|удал[иите]+|снес[иите]+|избав[ьи]т?ес[ья]\s+от)/i;
const REMOVE_EN = /(?:\bremove\b|\bdelete\b|\bdrop\b|get\s+rid\s+of|take\s+(?:out|off)\b)/i;

/* ── Addition ─────────────────────────────────────────────────────────────── */
const ADD_RU = /(?:добав[ьи]т?е?|встав[ьи]т?е?|сдела[йи]\s+(?:ещ[её]\s+)?(?:форм|раздел|блок|секци|страниц))/i;
const ADD_EN = /(?:\badd\b|\binclude\b|\binsert\b|create\s+(?:a\s+)?(?:new\s+)?(?:section|form|block|page|field))/i;

/* ── Wholesale restyle ────────────────────────────────────────────────────
   "Change everything about how it looks, keep what it says." Distinguished
   from a focused visual tweak because it is allowed to move layout. */
const RESTYLE_RU = /(?:(?:полностью|совсем|радикально|кардинально)\s+(?:измен|перемен|переде|друг)|друго[йе]\s+(?:стил|дизайн|вид)\b|измени\s+(?:весь\s+)?(?:стиль|дизайн)|переделай\s+(?:дизайн|стиль|вс[её]))/i;
const RESTYLE_EN = /(?:(?:completely|totally|fully|entirely)\s+(?:change|redesign|restyle|rework)|change\s+the\s+(?:whole|entire)\s+(?:style|design|look)|redesign\s+(?:it|the\s+(?:site|page)))/i;

/* ── Focused change ───────────────────────────────────────────────────────
   Deliberately broad. A false positive spends one edit and shows a new
   version the person can undo; a false negative is the reported bug, where
   the product denies it can do its own job. */
// Stems, not full forms: Russian requests arrive as imperatives ("поменяй"),
// infinitives ("можешь поменять"), and polite plurals ("поменяйте"). Matching
// endings meant the polite form was not an edit. The stem is safe here because
// a change verb only counts when it is aimed at something on the page.
const CHANGE_RU = /(?:помен[яе]|смен[яи]|замен[яи]|измен[яи]|переде[лл]|перепис|перепиш|обнов|сдела|сдел[аи]|улучш|усил|уменьш|увелич|подправ|исправ|настро|сократ|расшир|поправ)/i;
const CHANGE_EN = /(?:\bchange\b|\bmake\b|\bupdate\b|\bedit\b|\brewrite\b|\bswap\b|\breplace\b|\badjust\b|\btweak\b|\bimprove\b|\bshorten\b|\bexpand\b|\bfix\b|\buse\b\s+(?:a|an|the)\b|\bset\b\s+the\b)/i;

/**
 * Things on the page a change can be aimed at.
 *
 * A verb alone is not enough — "сделай первую версию" is a build, and "make a
 * decision" is conversation. Pairing the verb with something that exists on the
 * site is what keeps this from swallowing ordinary talk.
 */
const TARGET_RU = /(?:шрифт|фон|цвет|стил|дизайн|тем[уаы]|кнопк|заголов|текст|раздел|блок|секци|форм|герой|hero|отступ|карточк|футер|подвал|меню|навигац|светл|тёмн|темн|ярч|минималист|макет|вёрстк|верстк|изображен|картинк|фото)/i;
const TARGET_EN = /(?:font|typeface|serif|background|colou?r|style|design|theme|button|headline|heading|title|copy|text|section|block|form|hero|spacing|card|footer|nav|menu|light|dark|bright|minimal|layout|image|photo|palette|cta)/i;

/** Questions are conversation, even when they mention the page. */
// "can you change the font?" is a request wearing a question mark, so the
// modal openers are deliberately absent from this list — a question only ends
// the matter when it names nothing on the page (see below).
const QUESTION = /^(?:what|which|how|why|who|when|do|does|is|are|где|что|как|какой|какая|какие|почему|зачем|кто|когда|стоит|нужно)\b/i;

export interface SiteIntentContext {
  /** No site yet means nothing to edit; everything is build-or-talk. */
  hasOutput: boolean;
}

export function classifySiteIntent(message: string, context: SiteIntentContext): SiteIntent {
  const value = message.trim();
  if (!value || !context.hasOutput) return "DISCUSS";

  // Undo first: it is free, reversible, and its phrasing overlaps every other
  // class ("верни предыдущую версию" contains a change verb).
  if (UNDO_RU.test(value) || UNDO_EN.test(value)) return "UNDO";

  const asksQuestion = QUESTION.test(value);
  const namesTarget = TARGET_RU.test(value) || TARGET_EN.test(value);

  // "Can you change the font?" is a request, not a question about the product.
  // Only treat a question as conversation when it names nothing to change.
  if (asksQuestion && !namesTarget) return "DISCUSS";

  if (RESTYLE_RU.test(value) || RESTYLE_EN.test(value)) return "REGENERATE_STYLE";
  if (REMOVE_RU.test(value) || REMOVE_EN.test(value)) return "REMOVE_ELEMENT";
  if (ADD_RU.test(value) || ADD_EN.test(value)) return "ADD_FEATURE";

  if ((CHANGE_RU.test(value) || CHANGE_EN.test(value)) && namesTarget) return "EDIT_CURRENT";

  return "DISCUSS";
}

/** True when the intent must produce a new version rather than a reply. */
export function isSiteMutation(intent: SiteIntent): boolean {
  return intent === "EDIT_CURRENT"
    || intent === "REGENERATE_STYLE"
    || intent === "ADD_FEATURE"
    || intent === "REMOVE_ELEMENT";
}

/**
 * How much of the artifact this intent is allowed to move.
 *
 * Passed to the edit prompt so a request about the typeface does not come back
 * with rewritten product copy, and a request for a new section does not come
 * back with a new colour scheme. `REGENERATE_STYLE` is the one case where
 * layout and visual direction may change wholesale — and even then the product's
 * purpose, sections and copy have to survive.
 */
export function editScopeFor(intent: SiteIntent): string {
  switch (intent) {
    case "REGENERATE_STYLE":
      return "VISUAL_WHOLESALE";
    case "ADD_FEATURE":
      return "CONTENT_ADD";
    case "REMOVE_ELEMENT":
      return "CONTENT_REMOVE";
    default:
      return "FOCUSED";
  }
}
