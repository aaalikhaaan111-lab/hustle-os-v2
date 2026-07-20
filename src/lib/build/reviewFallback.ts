import type { Locale } from "@/i18n/locale";
import { pick, type Localized } from "@/i18n/content";
import type { TaskReview } from "@/lib/build/types";

// Deterministic review used both as the pre-AI gate (cheap nonsense rejection
// before spending an API call) and as the fallback when AI is unavailable or
// its output fails validation. Critically, this must still reject obvious
// nonsense on its own — "do not mark obvious nonsense as complete merely
// because AI is unavailable."
//
// The gibberish heuristics mirror the ones proven in the challenge validator.

const MIN_WORDS = 6;

const KEYBOARD_MASH_PATTERNS = [
  "йцукен",
  "фывап",
  "ячсмит",
  "qwerty",
  "asdfgh",
  "zxcvbn",
  "qazwsx",
  "1234567",
  "abcdefg",
];

// A long consonant run signals random-key mashing (e.g. "прлптбаихз"). This is
// checked PER WORD (never across the space-collapsed string, which would
// create false runs between words like "study sprint"), and 'y'/'й' are
// excluded because they act as vowels often enough to cause false positives
// (e.g. "StudySprint").
const CONSONANT_RUN_PATTERN = /[бвгджзклмнпрстфхцчшщbcdfghjklmnpqrstvwxz]{5,}/i;

const LOW_EFFORT_PATTERNS: RegExp[] = [
  /^(да|нет|ну|окей|ок|норм|хз|пофиг)\.?$/i,
  /^(cool|nice|ok|okay|good|idk|dunno|whatever|yes|no)\.?$/i,
  /не зна(ю|ем)/i,
  /no idea/i,
  /don'?t know/i,
];

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[а-яёa-z]+/gi) ?? []).filter((word) => word.length > 1);
}

function isGibberish(answer: string): boolean {
  const collapsed = answer.toLowerCase().replace(/\s/g, "");
  const words = tokenize(answer);
  const uniqueRatio = words.length > 0 ? new Set(words).size / words.length : 0;
  return (
    /(.)\1{4,}/i.test(answer) || // one char repeated 5+ times
    /(.{2,4})\1{3,}/i.test(collapsed) || // a short cycle repeated
    KEYBOARD_MASH_PATTERNS.some((p) => collapsed.includes(p)) ||
    words.some((word) => CONSONANT_RUN_PATTERN.test(word)) || // per-word run
    (words.length >= 4 && uniqueRatio < 0.4)
  );
}

const REVIEW_GIBBERISH_SUMMARY: Localized = {
  en: "This looks like random or placeholder text rather than a real answer.",
  ru: "Похоже на случайный или временный текст, а не на настоящий ответ.",
};
const REVIEW_SHORT_SUMMARY: Localized = {
  en: "This is a start, but it's too short to show your thinking yet.",
  ru: "Это начало, но пока слишком коротко, чтобы показать твою мысль.",
};
const REVIEW_GIBBERISH_NEXT: Localized = {
  en: "Write a genuine answer in your own words — a couple of clear sentences is enough.",
  ru: "Напиши настоящий ответ своими словами — пары чётких предложений достаточно.",
};
const REVIEW_SHORT_NEXT: Localized = {
  en: "Add a couple more sentences with specifics, then submit again.",
  ru: "Добавь пару предложений с конкретикой и отправь снова.",
};
const REVIEW_SHORT_MISSING: Localized = {
  en: "Specific details about your project",
  ru: "Конкретные детали о твоём проекте",
};
const REVIEW_READY_SUMMARY: Localized = {
  en: "This is a real, on-topic answer — good enough to move on.",
  ru: "Это настоящий ответ по теме — можно двигаться дальше.",
};
const REVIEW_READY_STRENGTH: Localized = {
  en: "You gave a genuine answer in your own words.",
  ru: "Ты дал настоящий ответ своими словами.",
};
const REVIEW_READY_NEXT: Localized = {
  en: "You can always come back and add more detail later.",
  ru: "Ты всегда можешь вернуться и добавить деталей позже.",
};

export function buildDeterministicReview(rawAnswer: string, locale: Locale | string): TaskReview {
  const answer = rawAnswer.trim();
  const words = tokenize(answer);
  const lowEffort = LOW_EFFORT_PATTERNS.some((p) => p.test(answer));

  if (answer.length === 0 || isGibberish(answer) || lowEffort) {
    return {
      status: "needs_work",
      summary: pick(REVIEW_GIBBERISH_SUMMARY, locale),
      strengths: [],
      missingPoints: [pick(REVIEW_SHORT_MISSING, locale)],
      nextImprovement: pick(REVIEW_GIBBERISH_NEXT, locale),
    };
  }

  if (words.length < MIN_WORDS) {
    return {
      status: "needs_work",
      summary: pick(REVIEW_SHORT_SUMMARY, locale),
      strengths: [],
      missingPoints: [pick(REVIEW_SHORT_MISSING, locale)],
      nextImprovement: pick(REVIEW_SHORT_NEXT, locale),
    };
  }

  // A genuine, substantial answer passes when AI can't do the nuanced review.
  return {
    status: "ready",
    summary: pick(REVIEW_READY_SUMMARY, locale),
    strengths: [pick(REVIEW_READY_STRENGTH, locale)],
    missingPoints: [],
    nextImprovement: pick(REVIEW_READY_NEXT, locale),
  };
}

// A cheap pre-filter: if this is obvious nonsense, we can reject before ever
// calling the AI (saves cost and latency and guarantees rejection).
export function isObviousNonsense(rawAnswer: string): boolean {
  const answer = rawAnswer.trim();
  return answer.length === 0 || isGibberish(answer) || LOW_EFFORT_PATTERNS.some((p) => p.test(answer));
}
