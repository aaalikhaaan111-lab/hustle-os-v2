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
import { buildFirstVersionUserContent } from "../src/lib/build/firstVersionRequest";

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

/* ── 8. the choices reach what the MODEL receives ───────────────────────── */
/**
 * The point of this block is that it does not test a client object. It calls
 * the same function the server action calls to build the request body, and
 * reads the system prompt from source — so it fails if the value stops
 * arriving, or if the prompt stops telling the model what to do with it.
 */
{
  const direction = { name: "Chronoverse", concept: "an MCU timeline", projectType: "site" };

  // Both choices.
  const both = JSON.parse(buildFirstVersionUserContent(direction, "en", {
    productType: "an interactive timeline",
    designDirection: "cinematic: deep field, one dominant image, restrained warm accent",
  }));
  check("the model receives the product type",
    both.intake?.productType === "an interactive timeline", JSON.stringify(both.intake));
  check("the model receives the design direction",
    /cinematic/.test(both.intake?.designDirection ?? ""), JSON.stringify(both.intake));
  check("the direction still reaches the model", both.direction?.name === "Chronoverse");
  check("the locale still reaches the model", both.projectLocale === "en");

  // End to end from the option ids the UI actually stores.
  const fromUi = JSON.parse(buildFirstVersionUserContent(
    direction, "ru",
    intakeGenerationBrief({ productType: "fandom.archive", designDirection: "design.missionControl" })));
  check("a stored product-type id arrives as English design vocabulary",
    fromUi.intake?.productType === "a fan archive", JSON.stringify(fromUi.intake));
  check("a stored design id arrives as English design vocabulary",
    /mission-control/.test(fromUi.intake?.designDirection ?? ""), JSON.stringify(fromUi.intake));
  check("a Russian project still declares its locale to the model", fromUi.projectLocale === "ru");

  // Half deferred: the answered half arrives, the deferred half is absent.
  const half = JSON.parse(buildFirstVersionUserContent(
    direction, "en", intakeGenerationBrief({ productType: "fandom.timeline", designDirection: null })));
  check("a deferred design sends no designDirection key",
    half.intake && !("designDirection" in half.intake), JSON.stringify(half.intake));
  check("…while the answered product type still arrives",
    half.intake?.productType === "an interactive timeline");

  // Fully deferred: byte-identical to the pre-feature request.
  const deferred = buildFirstVersionUserContent(direction, "en", intakeGenerationBrief({ productType: null, designDirection: null }));
  const baseline = buildFirstVersionUserContent(direction, "en");
  check("a fully deferred intake sends no intake key at all", !JSON.parse(deferred).intake);
  check("…and is identical to a request with no intake", deferred === baseline);

  // The prompt must actually instruct the model to honour it, or the field is
  // decoration that happens to be present. Read from source: importing the
  // action would pull in Supabase and the Anthropic client.
  const prompt = readFileSync(new URL("../src/lib/actions/stage3.ts", import.meta.url), "utf8");
  check("the system prompt documents the intake object", /BUILD INTAKE/.test(prompt));
  check("the system prompt names productType", /"productType"/.test(prompt));
  check("the system prompt names designDirection", /"designDirection"/.test(prompt));
  check("the system prompt gives the choices authority", /outrank/.test(prompt));
  check("the system prompt explains an absent key", /deliberately left it/i.test(prompt));

  // The action must have no other way to build the body.
  const action = readFileSync(new URL("../src/lib/actions/stage3.ts", import.meta.url), "utf8");
  const firstVersionCall = action.slice(action.indexOf("generateFirstVersionAction"));
  check("the action builds its body through the tested function",
    /content: buildFirstVersionUserContent\(stage3\.direction, locale, intake\)/.test(firstVersionCall));
  check("no hand-rolled payload remains beside it",
    !/content: JSON\.stringify\(\{ direction: stage3\.direction/.test(action));
}

/* ── 9. back never generates ────────────────────────────────────────────── */
{
  // Back only ever removes an answer, so the plan is left with an unanswered
  // step. It cannot complete, and completion is the only thing that dispatches.
  const plan = planIntake("i like marvel cinematic universe");
  const afterFirst: IntakeAnswers = { productType: "fandom.timeline" };
  check("after step 1 the next step is design", nextStep(plan, afterFirst)?.id === "designDirection");

  const afterBack: IntakeAnswers = {};
  check("back returns to the product-type question", nextStep(plan, afterBack)?.id === "productType");
  check("back leaves the intake incomplete", !isIntakeComplete(plan, afterBack));

  // Choosing a product type advances only — it must not complete a two-step plan.
  check("choosing a product type does not complete the intake", !isIntakeComplete(plan, afterFirst));

  // Choosing the design completes it, exactly once.
  const done: IntakeAnswers = { productType: "fandom.timeline", designDirection: "design.cinematic" };
  check("choosing the design completes the intake", isIntakeComplete(plan, done));
  check("a completed intake has no further step", nextStep(plan, done) === null);

  // Defer on both steps still completes without a hidden default.
  const deferredBoth: IntakeAnswers = { productType: null, designDirection: null };
  check("deferring both completes", isIntakeComplete(plan, deferredBoth));
  check("deferring both selects nothing", intakeGenerationBrief(deferredBoth) === null);
}

/* ── 10. no option is preselected ───────────────────────────────────────── */
{
  const component = readFileSync(
    new URL("../src/components/build/StructuredChoice.tsx", import.meta.url), "utf8");
  check("selection starts empty", /useState<string \| null>\(null\)/.test(component));
  check("aria-checked follows selection, not focus", /aria-checked=\{isSelected\}/.test(component));
  check("the roving tabindex is separate from selection", /tabIndex=\{index === focusIndex/.test(component));
  check("the accent fill is applied only when selected", /background: isSelected \? "var\(--accent-soft\)"/.test(component));
  check("focus is shown as a ring, not as the selected fill", /focus-visible:ring-2/.test(component));
  check("arrow keys move focus without choosing",
    /case "ArrowRight":[\s\S]{0,120}move\(focusIndex \+ 1\)/.test(component));
  check("a back handler is supported", /onBack\?: \(\) => void/.test(component));
}

/* ── 11. the preview route is fixture-only and never in Production ──────── */
/**
 * The route was widened to render on Vercel Preview so a reviewer can open it
 * on a real deployment. Widening WHERE something renders is only safe if it
 * carries nothing — so both halves are pinned here: the gate, and the absence
 * of any capability worth reaching.
 */
{
  const page = readFileSync(
    new URL("../src/app/intake-preview/page.tsx", import.meta.url), "utf8");
  const view = readFileSync(
    new URL("../src/app/intake-preview/IntakePreview.tsx", import.meta.url), "utf8");
  const route = page + view;

  // The gate, expressed exactly.
  check("the gate allows non-production", /process\.env\.NODE_ENV !== "production"/.test(page));
  check("the gate allows Vercel Preview", /process\.env\.VERCEL_ENV === "preview"/.test(page));
  check("anything else falls through to notFound", /if \(!allowed\) notFound\(\)/.test(page));

  // Evaluate the condition the way each environment will.
  const allowed = (nodeEnv: string, vercelEnv?: string) =>
    nodeEnv !== "production" || vercelEnv === "preview";
  check("local development renders it", allowed("development"));
  check("a test run renders it", allowed("test"));
  check("Vercel Preview renders it", allowed("production", "preview"));
  check("Vercel Production does NOT render it", !allowed("production", "production"));
  check("a bare production build does NOT render it", !allowed("production", undefined));
  check("an unknown VERCEL_ENV does NOT render it", !allowed("production", "staging"));

  // Fixture-only: nothing to reach even where it does render.
  for (const forbidden of [
    "supabase", "createClient", "getCurrentUser", "cookies(", "headers(",
    "ANTHROPIC", "GEMINI", "Anthropic", "fetch(", "generateFirstVersionAction",
    "SUPABASE", "SERVICE_ROLE", "API_KEY",
  ]) {
    check(`the route never references ${forbidden}`, !route.includes(forbidden));
  }
  // The only environment access is the gate itself.
  const envReads = route.match(/process\.env\.[A-Z_]+/g) ?? [];
  check("the route reads only NODE_ENV and VERCEL_ENV",
    envReads.every((r) => r === "process.env.NODE_ENV" || r === "process.env.VERCEL_ENV"),
    envReads.join(", "));
  check("the preview dispatches no real generation", !/generateFirstVersion/.test(view));
}

/* ── 12. the retired interview cannot return ────────────────────────────── */
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
