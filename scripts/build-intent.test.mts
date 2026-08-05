/**
 * Regression tests for the refuse-to-build loop.
 *
 *   npx tsx scripts/build-intent.test.mts
 *
 * Reported from production: a user wrote "просто сгенерируй мне сайт. сам
 * придумай", then "сгенерируй сайт", then "сгенерируй сайт". All three were
 * answered with a refusal — "I won't invent your problem statement and save it
 * as fact", "Before I build anything, I need you to confirm the problem
 * statement" — each with a "Save as problem" card.
 *
 * That was not the model being cautious. Generation was gated three ways:
 *
 *   1. generateFirstVersionAction refused unless stage3.direction existed, and
 *      a direction only ever came from clicking a card in /create;
 *   2. the chat path that starts a build required a direction too;
 *   3. the workspace assistant had no build path at all, so a build request
 *      reached a model whose only available moves were talking and proposing
 *      fields to save.
 *
 * These tests pin the decision itself and the removal of each gate.
 */

import { readFileSync } from "node:fs";
import { classifyBuildIntent, hasExplicitBuildIntent } from "../src/lib/build/buildIntent";
import { inferDirection } from "../src/lib/build/inferredDirection";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const stage3 = read("src/lib/actions/stage3.ts");
const assistant = read("src/lib/actions/assistant.ts");
const preOutput = read("src/components/build/PreOutputWorkspace.tsx");
const chat = read("src/components/build/AssistantChat.tsx");
const buildAi = read("src/lib/actions/buildAi.ts");

/* ── 1. the exact reported messages are build commands ──────────────────── */

const REPORTED = [
  "просто сгенерируй мне сайт. сам придумай",
  "сгенерируй сайт",
];
for (const message of REPORTED) {
  check(`reported: "${message}" is BUILD_NOW`, classifyBuildIntent(message, { hasOutput: false }) === "BUILD_NOW");
}

// Every phrase the brief listed, in both languages.
const BUILD_NOW = [
  "Generate the site.",
  "Just build it.",
  "Decide the details yourself.",
  "Create a first version.",
  "Just build the first version and make reasonable assumptions.",
  "Сгенерируй сайт.",
  "Просто сделай, остальное придумай сам.",
  "создай сайт",
  "начинай делать",
  "просто сделай",
  "придумай сам",
  "остальное реши сам",
  "Реши сам и начинай.",
  "Платформа с мини-курсами для школьников. Остальное придумай сам.",
  "Сделай сайт для изучения финансов.",
];
for (const message of BUILD_NOW) {
  check(`"${message}" is BUILD_NOW`, classifyBuildIntent(message, { hasOutput: false }) === "BUILD_NOW", classifyBuildIntent(message, { hasOutput: false }));
}

// The same rule, asserted directly: a sentence that is only an instruction
// carries no subject, which is what stops the inferred direction being built
// out of the build command itself.
check("a bare command is recognised as pure instruction", hasExplicitBuildIntent("сгенерируй сайт"));
check(
  "a described idea is not pure instruction",
  !hasExplicitBuildIntent("Платформа с мини-курсами для школьников"),
);

/* ── 2. discovery is still discovery ────────────────────────────────────── */

// A false positive starts a generation nobody asked for, which is its own
// failure — the classifier has to stay narrow.
const NOT_BUILD = [
  "что такое первая версия?",
  "what could the first version become?",
  "какая аудитория лучше подойдёт?",
  "who is the audience for this?",
  "мне нравится вселенная марвел",
  "i like the marvel universe",
  "",
];
for (const message of NOT_BUILD) {
  check(`"${message}" is not a build command`, classifyBuildIntent(message, { hasOutput: false }) !== "BUILD_NOW", classifyBuildIntent(message, { hasOutput: false }));
}

// "какой сайт сделать? реши сам" is a handover, not a question, because the
// person explicitly stopped asking and delegated.
check(
  "a question that ends in a handover is still a build",
  classifyBuildIntent("какой сайт сделать? реши сам", { hasOutput: false }) === "BUILD_NOW",
);

/* ── 3. an existing version turns "build" into an edit ──────────────────── */

for (const message of ["сгенерируй сайт", "Just build it.", "измени заголовок"]) {
  check(
    `with output, "${message}" is EDIT_EXISTING`,
    classifyBuildIntent(message, { hasOutput: true }) === "EDIT_EXISTING",
    classifyBuildIntent(message, { hasOutput: true }),
  );
}

/* ── 4. a direction is no longer required to build ──────────────────────── */

check(
  "generation no longer refuses for a missing direction",
  !/if \(!project \|\| !stage3 \|\| !stage3\.direction\) return \{ error: t\("errorDirection"\)/.test(stage3),
);
check("a missing direction is inferred instead", /inferDirection\(\{/.test(stage3));
check(
  "the generator is told the direction was inferred",
  /buildFirstVersionUserContent\(direction, locale, intake, inferredDirection\)/.test(stage3),
);
check(
  "a project with no stage3 state still gets one rather than a refusal",
  /const baseState: Stage3ProjectState = stage3 \?\? \{/.test(stage3),
);

// The inferred direction has to be complete enough to generate from, and has to
// declare what it made up.
const inferred = inferDirection({
  projectName: "Мини-курсы",
  niche: null,
  problem: null,
  audience: null,
  solution: null,
  recentUserMessages: ["мини курсы на платформе", "просто сгенерируй мне сайт. сам придумай"],
  locale: "ru",
});
for (const field of ["name", "concept", "forWho", "creates", "problem", "audience", "niche"] as const) {
  check(`the inferred direction fills ${field}`, typeof inferred[field] === "string" && inferred[field].length > 0);
}
check("it takes its subject from what the person actually described", /мини курсы/i.test(inferred.concept), inferred.concept);
check("it records that the audience is assumed", inferred.creativeBrief.assumptions.length > 0);
check("it is written in the project's language", /[Ѐ-ӿ]/.test(inferred.forWho), inferred.forWho);
check(
  "an English project gets English assumptions",
  !/[Ѐ-ӿ]/.test(inferDirection({
    projectName: "Mini courses", niche: null, problem: null, audience: null, solution: null,
    recentUserMessages: ["mini courses platform"], locale: "en",
  }).forWho),
);

/* ── 5. the client gates are gone ───────────────────────────────────────── */

check(
  "the chat build path no longer requires a direction",
  !/!job\.active && direction && isFirstVersionRequest/.test(preOutput),
);
check(
  "it routes on the classified intent instead",
  /classifyBuildIntent\(content, \{ hasOutput: false \}\) === "BUILD_NOW"/.test(preOutput),
);
check(
  "the generate function no longer refuses without a direction",
  !/if \(busy \|\| !direction \|\| output\) return;/.test(preOutput),
);

/* ── 6. a build turn never reaches the model, and never shows a card ────── */

check(
  "the server decides build turns without consulting the model",
  /classifyBuildIntent\(message, \{ hasOutput: !!stage3\?\.output \}\) === "BUILD_NOW"/.test(assistant),
);
check(
  "a build turn carries no proposal, so no confirmation card can appear",
  /startGeneration: true,/.test(assistant) && /proposal: null,\s*\n\s*startGeneration: true/.test(assistant),
);
check(
  "the acknowledgement is localized rather than model-written",
  /tBuild\("buildAcknowledged"\)/.test(assistant),
);
for (const locale of ["en", "ru"]) {
  const messages = JSON.parse(read(`messages/${locale}.json`)) as { build: Record<string, string> };
  check(`build.buildAcknowledged exists in ${locale}`, typeof messages.build.buildAcknowledged === "string");
}

// The acknowledgement must promise assumptions, not ask for confirmation.
const ru = JSON.parse(read("messages/ru.json")) as { build: Record<string, string> };
check("the Russian acknowledgement is Russian", /[Ѐ-ӿ]/.test(ru.build.buildAcknowledged));
check(
  "it does not ask for confirmation",
  !/подтверд/i.test(ru.build.buildAcknowledged),
  ru.build.buildAcknowledged,
);

/* ── 7. saying "generating" is not the same as generating ───────────────── */

check(
  "the client actually calls the generation action",
  /if \(result\.startGeneration\) \{[\s\S]{0,220}generateFirstVersionAction\(projectId\)/.test(chat),
);

/* ── 8. the prompt no longer licenses the refusal ───────────────────────── */

check("assumptions are explicitly allowed", /ASSUMPTIONS ARE ALLOWED/.test(buildAi));
check(
  "the exact reported refusals are named and forbidden",
  /I won't invent your problem statement/.test(buildAi) && /I need your confirmation on the problem/.test(buildAi),
);
check(
  "a save proposal is stated not to be a gate",
  /never a gate and never a prerequisite for building/.test(buildAi),
);
check(
  "and is forbidden on a build turn",
  /never offer one on a turn where they asked you to build/.test(buildAi),
);

/* ── 8b. a single proposed direction is a valid proposal ────────────────── */

// Found by running "Реши сам и начинай.": the guide committed to one direction
// — the right answer to a handover — and sanitizeCreationTurn rejected the turn
// for having fewer than two, which surfaced as "the creation assistant is
// briefly unavailable" and did not recover on retry. Zero is still not a
// proposal.
const { sanitizeCreationTurn } = await import("../src/lib/build/creationTypes");
const direction = {
  name: "Зелёный справочник",
  concept: "Карточки комнатных растений с уходом",
  forWho: "Начинающие владельцы растений",
  creates: "Страница с карточками 18 растений",
  whyFits: "Самый прямой первый шаг",
  projectType: "content_media",
  problem: "Непонятно, как ухаживать",
  audience: "Начинающие",
  niche: "растения",
  creativeBrief: {
    startingMaterial: "интерес к растениям",
    motivation: "помочь разобраться",
    firstAudience: "новички",
    desiredExperience: "найти свой цветок и понять уход",
    personalIngredients: [],
    constraints: [],
    assumptions: [],
  },
};
const oneDirection = sanitizeCreationTurn({
  phase: "propose", message: "Беру инициативу на себя.", choices: [],
  choiceMode: "single", transition: "reveal", directions: [direction],
});
check("a proposal with one direction is accepted", oneDirection !== null);
check("and it keeps that direction", oneDirection?.directions.length === 1);
check(
  "a proposal with no directions is still rejected",
  sanitizeCreationTurn({
    phase: "propose", message: "…", choices: [], choiceMode: "single",
    transition: "reveal", directions: [],
  }) === null,
);

/* ── 9. an explicit locale actually reaches the messages ────────────────── */

// Server-side copy written in a project's language depends on
// getTranslations({ locale }) honouring that locale. The request config used to
// ignore its argument and always resolve from the cookie, so every such call
// silently returned the account's language — the "first version is ready"
// message is persisted, so it stayed wrong permanently. Fixing the callers was
// not enough on its own; this is the layer that made those fixes real.
const requestConfig = read("src/i18n/request.ts");
check(
  "the request config accepts a requested locale",
  /getRequestConfig\(async \(\{ requestLocale \}\)/.test(requestConfig),
);
check(
  "an explicit locale wins over the cookie",
  /isLocale\(requested\)\s*\?\s*requested/.test(requestConfig),
);
check(
  "and the cookie still answers when nothing was requested",
  /: await resolveLocale\(\)/.test(requestConfig),
);

/* ── report ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`FAILED ${failures.length} of ${passed + failures.length}`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`build intent: ${passed} checks passed`);
