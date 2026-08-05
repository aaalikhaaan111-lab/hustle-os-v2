/**
 * Regression tests for the production assistant refusal.
 *
 *   npx tsx scripts/assistant-hotfix.test.mts
 *
 * Production shipped an assistant that answered "сгенерируй сайт" with
 * "Я не создаю сайты за тебя — это твой проект, и делать его должен ты сам."
 * That is the opposite of what Ventrio promises, and it came from legacy
 * educational framing in the system prompt.
 *
 * These tests pin the three things that must not regress: build requests reach
 * the generation path in both languages, the prompt cannot re-acquire the
 * instructions that caused the refusal, and suggestion chips follow the
 * project's language rather than the browser's.
 */

import { readFileSync } from "node:fs";
import { isFirstVersionRequest, isProjectOutputEditRequest } from "../src/lib/build/editIntent";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

/* ── 1. build requests reach the generation path ────────────────────────── */

// The exact production message that was refused.
check('the reported "сгенерируй сайт" is a build request', isFirstVersionRequest("сгенерируй сайт"));

const RU_BUILD = [
  "сгенерируй сайт",
  "Сгенерируй сайт.",
  "сделай сайт",
  "создай сайт",
  "создай лендинг",
  "собери страницу",
  "сделай первую версию",
  "построй прототип",
  "сгенерируй продукт",
  "пожалуйста сделай сайт",
];
for (const message of RU_BUILD) {
  check(`ru build request: "${message}"`, isFirstVersionRequest(message));
}

const EN_BUILD = [
  "generate the site",
  "build my website",
  "create a landing page",
  "make the first version",
  "build the product",
  "generate a prototype",
  "please build the site",
  "design the page",
];
for (const message of EN_BUILD) {
  check(`en build request: "${message}"`, isFirstVersionRequest(message));
}

/* ── 2. discovery must NOT trip generation ──────────────────────────────── */
/**
 * A false positive is expensive: it starts a real generation the user did not
 * ask for. These are the phrasings closest to a build request that must stay
 * conversational — including Ventrio's own suggestion chips.
 */
const NOT_BUILD = [
  "What could the first version become?",
  "Какой может стать первая версия?",
  "Who should this be for first?",
  "Для кого стоит сделать это в первую очередь?",
  "Help me sharpen this direction",
  "Помоги точнее сформулировать направление.",
  "how do I build an audience",
  "как понять, что сайт нужен людям",
  "what makes a good landing page",
  "why would anyone use this product",
];
for (const message of NOT_BUILD) {
  check(`not a build request: "${message}"`, !isFirstVersionRequest(message));
}

check("an empty message is not a build request", !isFirstVersionRequest("   "));

// The two intents stay distinct: editing existing output is not generating it.
check("an edit request is not a build request", !isFirstVersionRequest("make the headline shorter"));
check("edit detection still works", isProjectOutputEditRequest("make the headline shorter"));
check("ru edit detection still works", isProjectOutputEditRequest("сделай заголовок короче"));

/* ── 3. the refusal cannot come back ────────────────────────────────────── */
/**
 * Asserted against the prompt source. The refusal was not a model quirk — it
 * was instructed, so the instruction is what has to stay gone.
 */
{
  const prompt = readFileSync(new URL("../src/lib/actions/buildAi.ts", import.meta.url), "utf8");

  const BANNED = [
    "not an autonomous agent",
    "complete or edit the user's tasks",
    "for teenagers",
    "realistic for a teenager",
  ];
  for (const phrase of BANNED) {
    check(`the prompt no longer says "${phrase}"`, !prompt.includes(phrase));
  }

  // Equivalent refusal behaviour, in either language, must not be instructed.
  const REFUSAL_SHAPES = [
    // Written to match an INSTRUCTION to refuse, not the prompt's own ban on
    // refusing ("Never tell the user … that you do not create sites").
    /(?<!Never tell the user that they have to )build it yourself/i,
    /(?:^|[.;]\s*)(?:You|Say that you) do not (?:create|build|make) (?:sites|websites|products)/i,
    /it is their project to build/i,
    /не создаю сайты/i,
    /должен ты сам/i,
  ];
  for (const shape of REFUSAL_SHAPES) {
    check(`the prompt contains no refusal of shape ${shape}`, !shape.test(prompt));
  }

  // And the positive instruction must be present, not merely the absence.
  check("the prompt states Ventrio builds the first version", /Ventrio BUILDS the first version/.test(prompt));
  check("the prompt forbids telling the user to build it alone",
    /Never tell the user that they have to build it themselves/.test(prompt));
  check("the prompt forbids a lecture in place of building", /never a lecture/.test(prompt));
  check("the prompt describes Ventrio as an AI product builder", /AI product builder/.test(prompt));
}

/* ── 4. suggestion chips follow the project locale ──────────────────────── */
{
  const component = readFileSync(
    new URL("../src/components/build/PreOutputWorkspace.tsx", import.meta.url), "utf8");

  check("the workspace prefers the project locale over the UI locale",
    /const locale = projectLocale \|\| uiLocale/.test(component));
  check("useLocale is no longer bound directly to `locale`",
    !/const locale = useLocale\(\)/.test(component));
  check("an explicit build request is routed to generation before the chat",
    /isFirstVersionRequest\(content\)[\s\S]{0,80}createFirstVersion\(\)/.test(component));

  // Both locales must actually carry the chip strings, or "follow the locale"
  // silently falls back to the other language.
  const en = JSON.parse(readFileSync(new URL("../messages/en.json", import.meta.url), "utf8"));
  const ru = JSON.parse(readFileSync(new URL("../messages/ru.json", import.meta.url), "utf8"));
  for (const key of ["sharpenDirection", "whoFirst", "firstVersionCouldBe"]) {
    check(`en.stage3.${key} exists`, typeof en.stage3?.[key] === "string" && en.stage3[key].length > 0);
    check(`ru.stage3.${key} exists`, typeof ru.stage3?.[key] === "string" && ru.stage3[key].length > 0);
    check(`ru.stage3.${key} is not the English string`, ru.stage3?.[key] !== en.stage3?.[key]);
    check(`ru.stage3.${key} is actually Cyrillic`, /[Ѐ-ӿ]/.test(ru.stage3?.[key] ?? ""));
  }
}

console.log(`\nassistant-hotfix: ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  for (const failure of failures) console.error(`  FAIL ${failure}`);
  process.exit(1);
}
