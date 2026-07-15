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

function buildAbstractReason(context: ValidatorContext): string {
  const topic = context.questTitle.replace(/^Квест:\s*/, "");
  return `Слишком абстрактно для квеста «${topic}». Ответь конкретнее на задание: ${context.actionPrompt}`;
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
    return rejection(spamScore, "Обнаружен спам или некорректный ввод. Напишите осмысленный ответ.");
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
    reason: buildPassReason(answer, depth, feasibility, risk),
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
// instead of always following the same "твоя идея ... выглядит жизнеспособно" template.
const OPENERS: ((snippet: string) => string)[] = [
  (s) => `«${s}» — с этого реально можно стартовать.`,
  (s) => `Зацепило по делу: «${s}».`,
  (s) => `Принято: «${s}» звучит как рабочая гипотеза.`,
  (s) => `По существу — «${s}».`,
  (s) => `Смотрю на «${s}»: ход мысли верный.`,
];

const WEAK_DIMENSION_NOTES: Record<"depth" | "feasibility" | "risk", string> = {
  depth: "Только копни глубже — сейчас не хватает конкретики по сути идеи.",
  feasibility: "Слабое место — реализуемость: распиши, что именно делаешь на первой неделе.",
  risk: "Ты не проговорил риски — подумай, что может пойти не так и что тогда делать.",
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

function buildPassReason(answer: string, depth: number, feasibility: number, risk: number): string {
  const sentences = answer
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 4);
  const snippet = truncateSnippet(sentences[0] ?? answer);

  const opener = OPENERS[hashString(answer) % OPENERS.length](snippet);
  const minScore = Math.min(depth, feasibility, risk);
  const closer =
    minScore >= 9
      ? "Сильно сразу по всем фронтам — двигайся дальше в этом направлении."
      : WEAK_DIMENSION_NOTES[pickWeakestDimension(depth, feasibility, risk)];

  return `${opener} ${closer}`;
}
