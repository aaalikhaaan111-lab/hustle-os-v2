/**
 * Build-intake fixtures.
 *
 *   npx tsx scripts/intake.test.mts
 *
 * The intake replaces a multi-turn interview with at most two clicks, and the
 * click that answers the last question spends a real generation. So the things
 * worth pinning are: the right number of questions appear, every step can be
 * escaped, exactly one generation is dispatched, and a refresh mid-flight
 * cannot dispatch a second.
 *
 * Everything here is deterministic by construction — no network, no model, no
 * randomness — which is the property that makes the flow testable at all.
 */

import { readFileSync } from "node:fs";
import {
  DESIGN_PREVIEW_IDS,
  designDirectionsFor,
  hasExplicitProductType,
  hashIdea,
  intakeGenerationBrief,
  intakeStorageKey,
  isIntakeComplete,
  nextStep,
  planIntake,
  productTypesFor,
  INTAKE_DOMAINS,
  type IntakeAnswers,
} from "../src/lib/build/intake";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

/**
 * A miniature of the hook's decision logic, so the flow can be driven without
 * React. It mirrors useBuildIntake: answers accumulate, completion dispatches
 * once, and the latch is consulted before anything else.
 */
function runFlow(idea: string, picks: (string | null)[]) {
  const plan = planIntake(idea);
  const answers: IntakeAnswers = {};
  let generations = 0;
  let latched = false;
  let payload: ReturnType<typeof intakeGenerationBrief> = null;

  for (const pick of picks) {
    if (latched) continue;
    const step = nextStep(plan, answers);
    if (!step) continue;
    answers[step.id] = pick;
    if (isIntakeComplete(plan, answers)) {
      latched = true;
      generations += 1;
      payload = intakeGenerationBrief(answers);
    }
  }
  return { plan, answers, generations, latched, payload };
}

/* ── 1. ambiguous idea → two steps → generation ─────────────────────────── */
{
  const idea = "i like marvel cinematic universe";
  const plan = planIntake(idea);
  check("ambiguous idea infers the fandom domain", plan.domain === "fandom", plan.domain);
  check("ambiguous idea asks two questions", plan.steps.length === 2, `${plan.steps.length}`);
  check("first question is product type", plan.steps[0].id === "productType");
  check("second question is design direction", plan.steps[1].id === "designDirection");
  check("each step offers exactly three options",
    plan.steps.every((s) => s.options.length === 3),
    plan.steps.map((s) => s.options.length).join(","));

  const run = runFlow(idea, ["fandom.timeline", "design.cinematic"]);
  check("two answers complete the intake", run.latched);
  check("exactly one generation is dispatched", run.generations === 1, `${run.generations}`);
  check("the payload carries both choices",
    run.payload?.productType === "an interactive timeline" && !!run.payload?.designDirection,
    JSON.stringify(run.payload));
}

/* ── 2. clear idea → design only → generation ───────────────────────────── */
{
  for (const idea of ["a landing page for my coffee shop", "лендинг для моей кофейни"]) {
    const plan = planIntake(idea);
    check(`clear idea skips product type: "${idea}"`, plan.steps.length === 1, `${plan.steps.length} steps`);
    check(`…and asks only design: "${idea}"`, plan.steps[0]?.id === "designDirection");

    const run = runFlow(idea, ["design.warmCraft"]);
    check(`one answer generates: "${idea}"`, run.generations === 1, `${run.generations}`);
  }
  check("explicit shape is detected in English", hasExplicitProductType("build me a portfolio"));
  check("explicit shape is detected in Russian", hasExplicitProductType("сделай портфолио"));
  check("a vague idea is not treated as explicit", !hasExplicitProductType("i like marvel cinematic universe"));
  check("a vague Russian idea is not explicit", !hasExplicitProductType("мне нравится вселенная марвел"));
}

/* ── 3. "Let Ventrio decide" reaches generation immediately ─────────────── */
{
  const run = runFlow("i like marvel cinematic universe", [null, null]);
  check("deferring every step still generates", run.generations === 1, `${run.generations}`);
  check("a fully deferred intake sends no directive", run.payload === null, JSON.stringify(run.payload));

  const partial = runFlow("i like marvel cinematic universe", ["fandom.archive", null]);
  check("deferring only the design still generates", partial.generations === 1);
  check("…and sends the answered half only",
    partial.payload?.productType === "a fan archive" && partial.payload?.designDirection === undefined,
    JSON.stringify(partial.payload));
}

/* ── 4. idempotency: double-submit and refresh ──────────────────────────── */
{
  // Extra clicks after completion must not dispatch again.
  const spam = runFlow("i like marvel", ["fandom.timeline", "design.cinematic", "design.editorial", "design.brutalist"]);
  check("extra clicks after completion do not re-generate", spam.generations === 1, `${spam.generations}`);

  // A refresh replays persisted state. Once latched, no step is offered.
  const plan = planIntake("i like marvel");
  const answers: IntakeAnswers = { productType: "fandom.timeline", designDirection: "design.cinematic" };
  check("a completed intake offers no further step", nextStep(plan, answers) === null);
  check("a completed intake reports complete", isIntakeComplete(plan, answers));

  // A half-finished intake resumes at the right question rather than restarting.
  const half: IntakeAnswers = { productType: "fandom.timeline" };
  check("a half-finished intake resumes at design", nextStep(plan, half)?.id === "designDirection");
  check("…and is not complete", !isIntakeComplete(plan, half));

  // The idea hash guards against applying another idea's answers.
  check("different ideas hash differently", hashIdea("a coffee shop") !== hashIdea("a fan archive"));
  check("the same idea hashes stably", hashIdea(" Marvel ") === hashIdea("marvel"));
  check("the storage key is project-scoped", intakeStorageKey("abc") !== intakeStorageKey("def"));
}

/* ── 5. both languages reach the same structure ─────────────────────────── */
{
  const pairs: Array<[string, string]> = [
    ["i like marvel cinematic universe", "мне нравится вселенная марвел"],
    ["a portfolio for my photography", "портфолио для моей фотографии"],
    ["a website for my coffee shop", "сайт для моей кофейни"],
    ["a course about design", "курс про дизайн"],
    ["a charity campaign", "благотворительная кампания"],
  ];
  for (const [en, ru] of pairs) {
    const a = planIntake(en);
    const b = planIntake(ru);
    check(`"${en}" / "${ru}" infer the same domain`, a.domain === b.domain, `${a.domain} vs ${b.domain}`);
  }
  const ruRun = runFlow("мне нравится вселенная марвел", ["fandom.timeline", "design.cinematic"]);
  check("a Russian idea generates exactly once", ruRun.generations === 1);
}

/* ── 6. catalogue integrity ─────────────────────────────────────────────── */
{
  for (const domain of INTAKE_DOMAINS) {
    const types = productTypesFor(domain);
    const designs = designDirectionsFor(domain);
    check(`${domain}: three product types`, types.length === 3, `${types.length}`);
    check(`${domain}: three design directions`, designs.length === 3, `${designs.length}`);
    check(`${domain}: design ids are unique`, new Set(designs.map((d) => d.id)).size === 3);
    check(`${domain}: every design has a local preview`,
      designs.every((d) => (DESIGN_PREVIEW_IDS as readonly string[]).includes(d.preview)));
  }

  // Every label the catalogue references must exist in both locales, or the UI
  // renders a raw key at the exact moment the user is asked to choose.
  const en = JSON.parse(readFileSync(new URL("../messages/en.json", import.meta.url), "utf8")).build;
  const ru = JSON.parse(readFileSync(new URL("../messages/ru.json", import.meta.url), "utf8")).build;
  const keys = new Set<string>();
  for (const domain of INTAKE_DOMAINS) {
    for (const option of [...productTypesFor(domain), ...designDirectionsFor(domain)]) {
      keys.add(option.labelKey);
      if (option.hintKey) keys.add(option.hintKey);
    }
  }
  for (const step of [...planIntake("x").steps, ...planIntake("a landing page").steps]) {
    keys.add(step.titleKey);
    keys.add(step.deferKey);
  }
  for (const key of keys) {
    check(`en.build.${key} exists`, typeof en[key] === "string" && en[key].length > 0);
    check(`ru.build.${key} exists`, typeof ru[key] === "string" && ru[key].length > 0);
    check(`ru.build.${key} is Cyrillic`, /[Ѐ-ӿ]/.test(ru[key] ?? ""), ru[key]);
  }
}

/* ── 7. the intake speaks the project's language ────────────────────────── */
{
  const page = readFileSync(new URL("../src/app/projects/[id]/page.tsx", import.meta.url), "utf8");
  check("the workspace is scoped to the project locale",
    /<NextIntlClientProvider locale=\{props\.projectLocale\}/.test(page));
  check("…loading that locale's messages", /messages\/\$\{props\.projectLocale\}\.json/.test(page));

  // Both suggestion chips and intake labels resolve through the same provider,
  // so scoping it covers them together — that is the point of fixing it there
  // rather than per-component.
  const workspace = readFileSync(
    new URL("../src/components/build/PreOutputWorkspace.tsx", import.meta.url), "utf8");
  check("chips resolve through the provider", /suggestions = output/.test(workspace));
  check("intake labels resolve through the provider", /tb\(intake\.step\.titleKey/.test(workspace));
}

/* ── 8. the retired interview cannot return ─────────────────────────────── */
{
  const workspace = readFileSync(
    new URL("../src/components/build/PreOutputWorkspace.tsx", import.meta.url), "utf8");
  const prompt = readFileSync(new URL("../src/lib/actions/buildAi.ts", import.meta.url), "utf8");

  check("the workspace renders the structured choice", /StructuredChoice/.test(workspace));
  check("the final answer calls generation directly",
    /onComplete[\s\S]{0,120}createFirstVersion\(/.test(workspace));
  check("generation still goes through the existing action",
    /generateFirstVersionAction\(projectId/.test(workspace));
  check("typing dismisses the intake rather than leaving it stale",
    /intake\.dismiss\(\)/.test(workspace));

  // The educational framing removed in the previous hotfix must stay removed.
  for (const phrase of ["not an autonomous agent", "complete or edit the user's tasks", "for teenagers"]) {
    check(`the assistant prompt still lacks "${phrase}"`, !prompt.includes(phrase));
  }
  check("the assistant prompt still says Ventrio builds", /Ventrio BUILDS the first version/.test(prompt));
}

console.log(`\nintake: ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  for (const failure of failures) console.error(`  FAIL ${failure}`);
  process.exit(1);
}
