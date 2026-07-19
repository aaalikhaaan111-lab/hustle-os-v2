import type { Locale } from "@/i18n/locale";
import { pick, type Localized } from "@/i18n/content";

export interface ValidationScore {
  depth: number;
  feasibility: number;
  risk: number;
  average: number;
}

export interface ValidationResult {
  passed: boolean;
  score: ValidationScore;
  reason: string;
}

export interface ValidatorContext {
  questTitle: string;
  actionPrompt: string;
  locale: Locale | string;
}

// 3-Tier Evaluation Framework
// Tier 1 (Anti-Cheat/Spam): gibberish, keyboard mash, repeated symbols -> score 0, instant reject.
// Tier 2 (Depth Check): real but too short/generic, no specifics -> score 3, reject with a concrete prompt.
// Tier 3 (Core Logic Check): 2-4 sentences showing baseline understanding -> pass, score 7-10.
// The bar for Tier 3 is deliberately low: we want a real, on-topic answer to pass, not an essay.

const MIN_TIER3_WORDS = 8;

// Note: JS regex `\b` only recognizes ASCII word characters, so it never matches around
// Cyrillic text (no position in a pure-Cyrillic string is a word/non-word transition).
// These patterns intentionally avoid `\b` for that reason.
const GENERIC_PATTERNS: RegExp[] = [
  /без понятия/i,
  /не зна(ю|ем|ешь)/i,
  /(^|\s)лень(\s|$|[.,!?])/i,
  /позже сдела/i,
  /потом сдела/i,
  /когда[\s-]нибудь/i,
  /(^|\s)хз(\s|$|[.,!?])/i,
  /пофиг/i,
  /не важно/i,
  /как[\s-]нибудь/i,
  /не хочу думать/i,
  /^(да|нет|ну|окей|ок|норм)\.?$/i,
  /^(cool|nice|ok|okay|good|idk|dunno|whatever)\.?$/i,
  /no idea/i,
  /don'?t know/i,
  /(^|\s)lazy(\s|$|[.,!?])/i,
  /('ll|will) do (it|this) later/i,
  /some ?day/i,
  /doesn'?t matter/i,
  /don'?t want to think/i,
];

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

// A long unbroken run of consonants (Cyrillic or Latin) almost never occurs in real
// words in either language — it's a strong signal of random-key mashing like "прлптбаихз".
const CONSONANT_RUN_PATTERN = /[бвгджзйклмнпрстфхцчшщbcdfghjklmnpqrstvwxyz]{5,}/i;

const FEASIBILITY_WORDS = [
  "план",
  "шаг",
  "недел",
  "день",
  "начн",
  "запуст",
  "сделаю",
  "буду",
  "провер",
  "тест",
  "бюджет",
  "срок",
  "plan",
  "step",
  "week",
  "start",
  "launch",
  "test",
  "budget",
  "deadline",
  "check",
];

const RISK_WORDS = [
  "риск",
  "проблем",
  "слож",
  "не сработ",
  "может не",
  "минус",
  "ограничен",
  "конкурент",
  "но ",
  "однако",
  "если не",
  "risk",
  "problem",
  "difficult",
  "might not",
  "may not",
  "downside",
  "competitor",
  "however",
  "if not",
];

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[а-яёa-z]+/gi) ?? []).filter((word) => word.length > 1);
}

function countSentences(text: string): number {
  return text.split(/[.!?\n]+/).filter((s) => s.trim().length > 3).length;
}

function hasRepeatedCharRun(text: string): boolean {
  return /(.)\1{4,}/i.test(text);
}

function hasRepeatedShortCycle(text: string): boolean {
  return /(.{2,4})\1{3,}/i.test(text.replace(/\s/g, ""));
}

function hasKeyboardMash(text: string): boolean {
  const lower = text.toLowerCase().replace(/\s/g, "");
  return KEYBOARD_MASH_PATTERNS.some((pattern) => lower.includes(pattern));
}

function hasLongConsonantRun(text: string): boolean {
  return CONSONANT_RUN_PATTERN.test(text.replace(/\s/g, ""));
}

function uniqueWordRatio(words: string[]): number {
  if (words.length === 0) return 0;
  return new Set(words).size / words.length;
}

function countMarkerHits(lowerText: string, markers: string[]): number {
  return markers.filter((marker) => lowerText.includes(marker.toLowerCase())).length;
}

// Tier 3 scoring: a baseline of 7 once an answer has already cleared the spam and
// genericity gates — small bonuses reward extra rigor, but nothing here can push a
// passing answer back below the 7/10 pass line.
function scoreDepth(text: string, words: string[], markerHits: number, markerTotal: number): number {
  let score = 7;
  if (words.length >= 40) score += 1;
  if (countSentences(text) >= 3) score += 1;
  if (/\d/.test(text)) score += 1;
  const markerRatio = markerTotal > 0 ? markerHits / markerTotal : 0;
  if (markerRatio >= 0.34) score += 1;
  return Math.max(7, Math.min(10, score));
}

function scoreFeasibility(words: string[]): number {
  let score = 7;
  const lower = words.join(" ");
  const hits = FEASIBILITY_WORDS.filter((word) => lower.includes(word)).length;
  if (hits >= 1) score += 1;
  if (hits >= 3) score += 1;
  if (words.length >= 20) score += 1;
  return Math.max(7, Math.min(10, score));
}

function scoreRisk(text: string): number {
  let score = 7;
  const lower = text.toLowerCase();
  const hits = RISK_WORDS.filter((word) => lower.includes(word)).length;
  if (hits >= 1) score += 2;
  if (hits >= 2) score += 1;
  return Math.max(7, Math.min(10, score));
}

function rejection(score: ValidationScore, reason: string): ValidationResult {
  return { passed: false, score, reason };
}

const SPAM_MESSAGE: Localized = {
  en: "Spam or gibberish detected. Please write a real answer.",
  ru: "Обнаружен спам или некорректный ввод. Напишите осмысленный ответ.",
};

function buildAbstractReason(context: ValidatorContext): string {
  const topic = context.questTitle.replace(/^(Квест|Quest):\s*/, "");
  return context.locale === "ru"
    ? `Слишком абстрактно для квеста «${topic}». Ответь конкретнее на задание: ${context.actionPrompt}`
    : `Too vague for the "${topic}" quest. Be more specific about the task: ${context.actionPrompt}`;
}

export function validateChallengeAnswer(
  rawAnswer: string,
  markers: string[],
  context: ValidatorContext
): ValidationResult {
  const answer = rawAnswer.trim();
  const words = tokenize(answer);

  const spamScore: ValidationScore = { depth: 0, feasibility: 0, risk: 0, average: 0 };
  const genericScore: ValidationScore = { depth: 3, feasibility: 3, risk: 3, average: 3 };

  // Tier 1: Anti-Cheat / Spam Check
  if (
    answer.length === 0 ||
    hasRepeatedCharRun(answer) ||
    hasRepeatedShortCycle(answer) ||
    hasKeyboardMash(answer) ||
    hasLongConsonantRun(answer) ||
    uniqueWordRatio(words) < 0.4
  ) {
    return rejection(spamScore, pick(SPAM_MESSAGE, context.locale));
  }

  // Tier 2: Depth Check — real words, but too short or too generic to show any thinking.
  // The reason is built from *this* quest's own title and prompt, never a hardcoded topic.
  if (words.length < MIN_TIER3_WORDS || GENERIC_PATTERNS.some((pattern) => pattern.test(answer))) {
    return rejection(genericScore, buildAbstractReason(context));
  }

  // Tier 3: Core Logic Check — a concise, on-topic answer passes. No essay required.
  const lowerAnswer = answer.toLowerCase();
  const markerHits = countMarkerHits(lowerAnswer, markers);
  const depth = scoreDepth(answer, words, markerHits, markers.length);
  const feasibility = scoreFeasibility(words);
  const risk = scoreRisk(answer);
  const average = Math.round(((depth + feasibility + risk) / 3) * 10) / 10;

  return {
    passed: true,
    score: { depth, feasibility, risk, average },
    reason: buildPassReason(answer, depth, feasibility, risk, context.locale),
  };
}

function truncateSnippet(text: string, maxLength = 70): string {
  const trimmed = text.trim();
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength).trim()}…` : trimmed;
}

function hashString(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// No fixed wrapper sentence — the opener and closer are picked from independent pools
// (deterministically, from the answer's own content) and the closer is always tied to
// the actual weakest scoring dimension, so the critique reads differently every time
// instead of always following the same templated shape.
const OPENERS: Localized<((snippet: string) => string)[]> = {
  en: [
    (s) => `"${s}" — that's a real place to start.`,
    (s) => `That part landed: "${s}".`,
    (s) => `Noted: "${s}" sounds like a workable hypothesis.`,
    (s) => `Getting to the point — "${s}".`,
    (s) => `Looking at "${s}": the thinking checks out.`,
  ],
  ru: [
    (s) => `«${s}» — с этого реально можно стартовать.`,
    (s) => `Зацепило по делу: «${s}».`,
    (s) => `Принято: «${s}» звучит как рабочая гипотеза.`,
    (s) => `По существу — «${s}».`,
    (s) => `Смотрю на «${s}»: ход мысли верный.`,
  ],
};

const WEAK_DIMENSION_NOTES: Record<"depth" | "feasibility" | "risk", Localized> = {
  depth: {
    en: "Just dig a little deeper — right now it's missing specifics about the idea itself.",
    ru: "Только копни глубже — сейчас не хватает конкретики по сути идеи.",
  },
  feasibility: {
    en: "The weak spot is feasibility: spell out exactly what you'd do in the first week.",
    ru: "Слабое место — реализуемость: распиши, что именно делаешь на первой неделе.",
  },
  risk: {
    en: "You didn't mention any risks — think about what could go wrong and what you'd do then.",
    ru: "Ты не проговорил риски — подумай, что может пойти не так и что тогда делать.",
  },
};

function pickWeakestDimension(depth: number, feasibility: number, risk: number): "depth" | "feasibility" | "risk" {
  const entries: ["depth" | "feasibility" | "risk", number][] = [
    ["depth", depth],
    ["feasibility", feasibility],
    ["risk", risk],
  ];
  entries.sort((a, b) => a[1] - b[1]);
  return entries[0][0];
}

const STRONG_ACROSS_BOARD: Localized = {
  en: "Strong across the board right away — keep pushing in this direction.",
  ru: "Сильно сразу по всем фронтам — двигайся дальше в этом направлении.",
};

function buildPassReason(
  answer: string,
  depth: number,
  feasibility: number,
  risk: number,
  locale: Locale | string
): string {
  const sentences = answer
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 4);
  const snippet = truncateSnippet(sentences[0] ?? answer);

  const openers = pick(OPENERS, locale);
  const opener = openers[hashString(answer) % openers.length](snippet);
  const minScore = Math.min(depth, feasibility, risk);
  const closer =
    minScore >= 9
      ? pick(STRONG_ACROSS_BOARD, locale)
      : pick(WEAK_DIMENSION_NOTES[pickWeakestDimension(depth, feasibility, risk)], locale);

  return `${opener} ${closer}`;
}
