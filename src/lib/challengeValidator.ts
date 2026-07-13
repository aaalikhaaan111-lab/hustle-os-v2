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

const MIN_ANSWER_LENGTH = 15;
const MIN_WORD_COUNT = 4;

// Note: JS regex `\b` only recognizes ASCII word characters, so it never matches around
// Cyrillic text (no position in a pure-Cyrillic string is a word/non-word transition).
// These patterns intentionally avoid `\b` for that reason.
const EVASION_PATTERNS: RegExp[] = [
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

function uniqueWordRatio(words: string[]): number {
  if (words.length === 0) return 0;
  return new Set(words).size / words.length;
}

function countMarkerHits(lowerText: string, markers: string[]): number {
  return markers.filter((marker) => lowerText.includes(marker.toLowerCase())).length;
}

function scoreDepth(text: string, words: string[], markerHits: number, markerTotal: number): number {
  let score = 0;

  if (words.length >= 40) score += 4;
  else if (words.length >= 20) score += 3;
  else if (words.length >= 10) score += 2;
  else if (words.length >= 5) score += 1;

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 3);
  if (sentences.length >= 3) score += 2;
  else if (sentences.length >= 2) score += 1;

  if (/\d/.test(text)) score += 2;

  const markerRatio = markerTotal > 0 ? markerHits / markerTotal : 0;
  score += Math.round(markerRatio * 2);

  return Math.max(0, Math.min(10, score));
}

function scoreFeasibility(words: string[]): number {
  const lower = words.join(" ");
  const hits = FEASIBILITY_WORDS.filter((word) => lower.includes(word)).length;

  let score = Math.min(6, hits * 1.5);
  if (words.length >= 15) score += 2;
  if (/\d/.test(lower)) score += 2;

  return Math.max(0, Math.min(10, Math.round(score)));
}

function scoreRisk(text: string): number {
  const lower = text.toLowerCase();
  const hits = RISK_WORDS.filter((word) => lower.includes(word)).length;

  let score = Math.min(8, hits * 2);
  if (lower.length > 30) score += 2;

  return Math.max(0, Math.min(10, score));
}

function rejection(score: ValidationScore, reason: string): ValidationResult {
  return { passed: false, score, reason };
}

export function validateChallengeAnswer(rawAnswer: string, markers: string[]): ValidationResult {
  const answer = rawAnswer.trim();
  const words = tokenize(answer);
  const lowFail: ValidationScore = { depth: 1, feasibility: 1, risk: 1, average: 1 };

  if (answer.length < MIN_ANSWER_LENGTH || words.length < MIN_WORD_COUNT) {
    return rejection(
      lowFail,
      "ИИ Hustle.OS отклонил твой отчёт. Оценка: 1/10. Причина: ответ слишком короткий, чтобы в нём была хоть какая-то мысль. Разверни идею подробнее."
    );
  }

  if (hasRepeatedCharRun(answer) || hasRepeatedShortCycle(answer) || hasKeyboardMash(answer)) {
    return rejection(
      lowFail,
      "ИИ Hustle.OS отклонил твой отчёт. Оценка: 1/10. Причина: похоже на случайный набор символов или удар по клавиатуре, а не осмысленный ответ."
    );
  }

  if (uniqueWordRatio(words) < 0.4) {
    return rejection(
      lowFail,
      "ИИ Hustle.OS отклонил твой отчёт. Оценка: 1/10. Причина: слишком много повторов одних и тех же слов — это похоже на попытку накрутить объём, а не раскрыть мысль."
    );
  }

  if (EVASION_PATTERNS.some((pattern) => pattern.test(answer))) {
    return rejection(
      { depth: 1, feasibility: 1, risk: 1, average: 1 },
      "ИИ Hustle.OS отклонил твой отчёт. Оценка: 1/10. Причина: это похоже на попытку уклониться от задания. Настоящего предпринимателя не останавливает «не знаю» — сформулируй хотя бы гипотезу."
    );
  }

  const lowerAnswer = answer.toLowerCase();
  const markerHits = countMarkerHits(lowerAnswer, markers);
  const depth = scoreDepth(answer, words, markerHits, markers.length);
  const feasibility = scoreFeasibility(words);
  const risk = scoreRisk(answer);
  const average = Math.round(((depth + feasibility + risk) / 3) * 10) / 10;

  const score: ValidationScore = { depth, feasibility, risk, average };

  if (average < 5) {
    return rejection(
      score,
      `ИИ Hustle.OS отклонил твой отчёт. Оценка: ${average}/10. Причина: твой ответ слишком абстрактный. Добавь конкретики, опиши цифры или конкретную боль аудитории.`
    );
  }

  return {
    passed: true,
    score,
    reason: "Отчёт принят ИИ Hustle.OS.",
  };
}

function truncateSnippet(text: string, maxLength = 70): string {
  const trimmed = text.trim();
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength).trim()}…` : trimmed;
}

export function buildMentorVerdict(answer: string, average: number): string {
  const sentences = answer
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 4);

  const first = sentences[0] ? truncateSnippet(sentences[0]) : truncateSnippet(answer);
  const second = sentences[1] ? truncateSnippet(sentences[1]) : first;

  const tone =
    average >= 8.5
      ? "Это выдающийся уровень проработки для новичка."
      : average >= 7
        ? "Это сильный, зрелый ход мышления."
        : "Это уже рабочая гипотеза, с которой можно двигаться дальше.";

  return `ИИ-Вердикт: твоя идея — «${first}» — выглядит жизнеспособно. ${tone} Особенно зацепил момент: «${second}». Твоя награда заслужена!`;
}
