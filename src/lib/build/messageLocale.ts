import type { Locale } from "@/i18n/locale";

/**
 * The language a person is actually writing in.
 *
 * The assistant used to answer in `project.locale`, which was set from the
 * interface cookie when the project row was created — before anyone had typed
 * a word. Someone with an English interface who wrote in Russian got English
 * answers, and the reverse was just as wrong. What language a message is in is
 * a property of the message, so it is read from the message.
 *
 * Returns null when the text does not say clearly enough. That is the common
 * case for "ok", a bare URL, a product name, or a number, and null means "keep
 * whatever language we were already using" — a weak signal must never flip the
 * conversation, because flapping mid-thread is worse than being steady.
 *
 * Only the two locales Ventrio ships are distinguished. Scripts, not
 * vocabularies, do the work: Cyrillic against Latin is a reliable ru/en split
 * and needs no word list to maintain.
 */

const CYRILLIC = /[Ѐ-ӿ]/g;
const LATIN = /[A-Za-z]/g;

/** Text that says nothing about language, and would otherwise skew the count. */
function stripNonLanguage(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, " ") // URLs are Latin whoever writes them
    .replace(/`{1,3}[^`]*`{1,3}/g, " ") // code spans and fences
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, " "); // email addresses
}

/** How many letters must be present before the ratio below means anything. */
const MIN_LETTERS = 4;

export function detectMessageLocale(text: string): Locale | null {
  const cleaned = stripNonLanguage(text ?? "");
  const cyrillic = (cleaned.match(CYRILLIC) ?? []).length;
  const latin = (cleaned.match(LATIN) ?? []).length;
  const letters = cyrillic + latin;

  // "ok", "да", "123", an emoji: real messages, but not evidence of a language.
  if (letters < MIN_LETTERS) return null;

  // Any substantial Cyrillic means Russian. A Russian sentence often carries
  // Latin brand names ("сделай сайт про Marvel"), so Russian does not need a
  // clean sweep to win — but a couple of stray Cyrillic characters in an
  // otherwise English sentence should not flip it either.
  const cyrillicShare = cyrillic / letters;
  if (cyrillicShare >= 0.5) return "ru";

  // English has to be essentially free of Cyrillic. Anything in between is
  // genuinely mixed, and mixed text is exactly when guessing does harm.
  if (cyrillicShare <= 0.05) return "en";

  return null;
}

/**
 * The language to answer a message in.
 *
 * The message wins when it speaks clearly, because it is the stronger signal —
 * it is what the person actually did, where the stored locale is only what they
 * or their browser once implied. When the message says nothing, the established
 * language carries on.
 */
export function replyLocaleFor(message: string, current: Locale): Locale {
  return detectMessageLocale(message) ?? current;
}
