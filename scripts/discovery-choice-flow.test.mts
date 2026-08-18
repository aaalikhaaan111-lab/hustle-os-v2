/**
 * The first flow: idea → discovery → the person chooses → generation.
 *
 *   npx tsx --conditions=react-server scripts/discovery-choice-flow.test.mts
 *
 * The step this pins is the one that kept being skipped. Discovery would return
 * three directions, and if the message that produced them read as a build
 * instruction — "just build it", "просто сделай" — the screen took
 * `directions[0]` and generated it in the same tick. Three options appeared,
 * were readable for about a second, and vanished into a generation of whichever
 * one the model happened to rank first. The person watched a choice being
 * offered and taken away, and nobody decided what got built.
 *
 * So: a proposal ends the turn. Generation begins on an explicit selection and
 * on nothing else.
 *
 * Source-level, because there is no DOM here and what regressed was which
 * branch runs after a turn arrives — which source states exactly.
 *
 * Offline. No network, no provider, no database.
 */

import { readFileSync } from "node:fs";
import { classifyBuildIntent } from "../src/lib/build/buildIntent";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const createExperience = read("src/components/create/CreateExperience.tsx");
const createCode = code(createExperience);
const preOutput = read("src/components/build/PreOutputWorkspace.tsx");
const preOutputCode = code(preOutput);
const structured = read("src/components/build/Questionnaire.tsx");

/* ── 1. nothing generates without a selection ────────────────────────────── */

/**
 * `chooseDirection` is the only door to generation from `/create`, so the
 * question is who is allowed to open it. Only the row's own click handler may.
 */
const callers = [...createCode.matchAll(/chooseDirection\(/g)].length;
check("chooseDirection exists", callers > 0);
check(
  "and is only ever called from a click handler",
  !/queueMicrotask\(\(\) => chooseDirection/.test(createCode),
  "something schedules a selection instead of waiting for one",
);
check(
  "no effect selects a direction",
  !/useEffect\([\s\S]{0,600}chooseDirection\(/.test(createCode),
);
check(
  "no timer selects a direction",
  !/set(?:Timeout|Interval)\([\s\S]{0,300}chooseDirection\(/.test(createCode),
);
check(
  "directions\\[0\\] is never taken by the screen",
  !/directions\[0\]/.test(createCode),
  "the first option is being auto-selected again",
);

/* ── 2. build intent cannot skip the proposal ────────────────────────────── */

// The classifier still recognises these — the fix is not to stop reading intent,
// it is to stop acting on it by choosing for someone.
for (const phrase of ["just build it", "просто сделай", "сделай сайт"]) {
  check(`"${phrase}" is still read as a build instruction`, classifyBuildIntent(phrase, { hasOutput: false }) === "BUILD_NOW");
}
check(
  "but /create no longer reads intent to decide for the person",
  !/classifyBuildIntent/.test(createCode),
  "the bypass is back in /create",
);
check(
  "and the proposal branch no longer short-circuits",
  !/phase === "propose"[\s\S]{0,200}BUILD_NOW/.test(createCode),
);

/**
 * The workspace has the same shape of bug: an explicit build instruction used
 * to call `createFirstVersion` straight past an open question.
 */
check("the workspace defers an open question rather than stepping over it", /if \(intake\.step\) \{\s*intake\.choose\(null\);/.test(preOutputCode));
check(
  "and only generates directly when nothing is being asked",
  /intake\.choose\(null\);[\s\S]{0,80}\}\s*createFirstVersion\(\);/.test(preOutputCode),
);

/* ── 3. options belong to the message that offered them ──────────────────── */

/*
 * THE OPTIONS LEFT THE TRANSCRIPT.
 *
 * They used to render inside the latest assistant turn, which is why they had
 * to be gated on being the latest one — options belonging to an older question
 * must never still be clickable. They are a strip docked above the composer
 * now, rendered straight from the CURRENT `turn`, so staleness is structurally
 * impossible rather than guarded: there is only ever one strip and it always
 * describes the question being asked.
 */
/*
 * ONE SURFACE, and the composer is inside it.
 *
 * The question was a stack of cards in the transcript, then chips floating
 * above the composer. It is now a single bordered surface that TAKES the
 * composer as a child — so what a person sees is their text box growing upward
 * to hold a question and shrinking back when it is answered. The structural
 * test is therefore that the composer is passed to the questionnaire rather
 * than rendered beside it.
 */
/*
 * THE OFFICIAL COMPONENT, not a reimplementation.
 *
 * Choice semantics, roving focus, keyboard shortcuts, validation, skip and
 * submit all come from `@shadcn/react/questionnaire` via the vendored registry
 * source. Asserting on our own markup for those would be asserting on code we
 * no longer own, so the checks here are: we use the real component, we pass it
 * the composer, and we allow a freeform answer.
 */
check("the composer is rendered inside the questionnaire",
  /<VentrioQuestionnaire[\s\S]{0,900}composer=\{/.test(createExperience));
check("clarifications and proposals feed one surface",
  /showDirections\s*\?[\s\S]{0,200}turn\?\.choices/.test(createExperience));
check(
  "and not in a block after the conversation",
  !/<\/div>\s*\n\s*\{showChoices && \(/.test(createExperience),
);
check("the build question is the surface the composer expands into",
  /<VentrioQuestionnaire[\s\S]{0,1400}composer=\{/.test(preOutput));
check(
  "and no longer sits in the footer above the composer",
  !/shrink-0 px-5 pb-5 pt-2[\s\S]{0,200}<StructuredChoice/.test(preOutput),
  "the docked form is back",
);

/* ── 4. options persist ──────────────────────────────────────────────────── */

// Nothing may hide them but the three events that end them.
const optionsRegion = createCode.slice(
  createCode.indexOf("const showDirections"),
  createCode.indexOf("function ChoiceGrid"),
);
check("no timer hides the options", !/set(?:Timeout|Interval)/.test(optionsRegion));
check("no opacity transition fades the conversation out", !/settled-state/.test(createCode), "the 24% dim is back");
/* Selection lives inside the official component now; what ends the question
   from this side is the answer being submitted. */
check("answering ends them", /onAnswer=\{onAskAnswer\}/.test(createExperience));
check("sending a message ends them", /setTurn\(null\)/.test(createExperience));
check("a new turn replaces them", /setTurn\(result\.turn\)/.test(createExperience));

/* ── 5. chat looks like chat ─────────────────────────────────────────────── */

/**
 * The latest assistant turn was promoted to display type whenever it carried a
 * proposal — `clamp(1.75rem, 5vw, 3rem)` in the display face. It announced the
 * options like a landing-page headline, and on a phone one sentence filled the
 * screen.
 *
 * The size is not asserted here any more because this block no longer sets
 * one: `/create` used to style the assistant's text itself, which is how it
 * ended up with no speaker mark while the workspace had one. It renders
 * `AssistantTurn` now, and that component's type is asserted where it lives.
 * What matters on THIS screen is that the promotion never returns.
 */
check("the assistant speaks through the shared turn",
  /<AssistantTurn>/.test(createExperience));
check("and is never promoted to display type",
  !/clamp\(1\.75rem|s-greet|s-display/.test(
    createCode.slice(createCode.indexOf("messages.map"))
  ),
  "a reply set as a headline is the defect this rule exists for");
check("no display face in the thread", !/ventrio-display/.test(createCode.slice(createCode.indexOf("messages.map"))), "hero type is back");
for (const hero of ["clamp(1.75rem", "clamp(2.35rem", "text-[19px]", "text-[17px]"]) {
  check(`no ${hero} in the conversation`, !createCode.slice(createCode.indexOf("messages.map")).includes(hero));
}
/**
 * THE TWO SPEAKERS ARE DIFFERENT KINDS OF OBJECT.
 *
 * This assertion has moved with the design three times, so the rule is worth
 * writing down rather than re-deriving:
 *
 *   v1  both turns set identically, the person's in a grey capsule. Fixed a
 *       real defect (a reply promoted to display type) and created another:
 *       nothing said which side was speaking.
 *   v2  the person's turn as muted prose behind a left hairline, the reply one
 *       step larger. Two paragraphs in one column — it did not read as a
 *       conversation at all, which is what came back from review.
 *   v3  containment and alignment: the person's turn is a bubble on the right,
 *       the reply is prose at the full measure behind a speaker mark.
 *
 * v3 is not a return to v1. v1 differed by a background alone at identical
 * type; v3 differs in KIND — contained versus uncontained, right versus left,
 * marked versus unmarked — which is how every chat interface people already
 * use distinguishes the two, and it does it without a second colour.
 *
 * What must stay true throughout: no display type anywhere in the thread, and
 * one component behind all four conversation surfaces.
 */
const turn = readFileSync(
  new URL("../src/components/build/ConversationTurn.tsx", import.meta.url), "utf8");
check("the person's turn is contained and right-aligned", /s-turn-user/.test(turn));
check("the reply is prose behind a speaker mark",
  /s-turn-assistant/.test(turn) && /s-turn-mark/.test(turn));
check("the two are different kinds of object, not two colours",
  /s-turn-user/.test(turn) && /s-turn-assistant/.test(turn) &&
  !/text-\[1[0-9](\.\d)?px\]/.test(turn),
  "sizes belong to the stylesheet; the component carries the structure");

/**
 * And the stylesheet is what makes the distinction real: a bubble that is not
 * contained, or a reply that is, would pass the structural checks above.
 */
const sheet = readFileSync(new URL("../src/app/studio.css", import.meta.url), "utf8");
const userRule = sheet.split(".s-turn-user > div {")[1]?.split("}")[0] ?? "";
check("the bubble is capped so a long paste is not a slab", /max-width/.test(userRule));
check("and it is filled, so it reads as contained", /background/.test(userRule));
check("the reply takes the full measure", /flex:\s*1/.test(
  sheet.split(".s-turn-assistant > div:last-child {")[1]?.split("}")[0] ?? ""));

check("every conversation surface uses the one component",
  ["src/components/build/AssistantChat.tsx",
   "src/components/build/PreOutputWorkspace.tsx",
   "src/components/create/CreateExperience.tsx"].every((f) =>
    /UserTurn/.test(readFileSync(new URL(`../${f}`, import.meta.url), "utf8"))));

// The question in the workspace is a message too, not a form label.
check("the build question uses body type",
  /\.cn-questionnaire-title[\s\S]{0,140}font-size: 0\.9375rem/.test(read("src/app/studio.css")));
check("and is not truncated mid-sentence", !/truncate text-\[13px\]/.test(structured));
check("nor framed as a panel", !/rounded-\[14px\] border/.test(code(structured)));

/* ── 6. the options themselves stay compact ──────────────────────────────── */

check("options are rows inside the surface, not cards in the transcript",
  /<VentrioQuestionnaire/.test(createExperience) && !/className="choice-stack"/.test(createExperience));
check("never columns", !/grid-cols-/.test(createCode));
const css = read("src/app/globals.css");
check("a row is one line of supporting text", /\.choice-row-hint \{[\s\S]{0,220}white-space: nowrap/.test(css));
check("and the title matches message size", /\.choice-row-title \{[\s\S]{0,120}font-size: 0\.9375rem/.test(css));

/* ── 7. the transition from proposal to generation ───────────────────────── */

/**
 * THE PATH THAT WAS ACTUALLY RUNNING. Removing the `directions[0]` auto-select
 * was not enough, because clicking a direction generated too: `chooseDirection`
 * called `selectCreationDirectionAction` and then `generateFirstVersionAction`
 * in the same breath. A job existed before anyone had been asked what to build.
 *
 * The workspace then opened on that running job and rendered "Что Ventrio
 * создаст?" over it — `!job.active` is false before the first poll returns —
 * and rendered it again when the job finished, in the frames before the rebuilt
 * project arrived. Two flows starting one project; the second one's answer
 * could not change anything.
 *
 * Reconstructed from production project 7f7815ac: message 05:05:02, proposal
 * 05:05:16, job 05:05:47 — the direction click, not a product-type click.
 */
check(
  "/create cannot start a generation at all",
  !/generateFirstVersionAction/.test(createCode),
  "the create screen can generate again",
);
check(
  "choosing a direction only persists the direction",
  /selectCreationDirectionAction\(projectId, direction, startingPoint\)/.test(createCode),
);
check(
  "and hands off rather than building",
  /router\.push\(`\/projects\/\$\{result\.projectId\}`\)/.test(createCode),
);

/**
 * Every remaining door into generation, and who opens it. The intake's
 * `onComplete` fires only from `choose`, which is a click or the explicit
 * defer control — there is no effect, timer or mount path into it.
 */
check("the workspace generates from the intake's completion", /onComplete: \(answers: IntakeAnswers\) => createFirstVersion\(false, answers\)/.test(preOutputCode));
check(
  "and the intake completes only from choose",
  !/useEffect\([\s\S]{0,400}onComplete\(/.test(code(read("src/lib/build/useBuildIntake.ts"))),
);
check(
  "no effect starts a generation",
  !/useEffect\([\s\S]{0,500}createFirstVersion\(/.test(preOutputCode),
);
check(
  "no timer starts a generation",
  !/set(?:Timeout|Interval)\([\s\S]{0,300}createFirstVersion\(/.test(preOutputCode),
);

/**
 * The question must never render over a job. `!job.active` was the bug: false
 * before the first poll and false again the instant a job finishes.
 */
check(
  "the question waits for the job row to be read",
  /enabled: !hasVersion && !!direction && job\.loaded && job\.phase === "idle"/.test(preOutputCode),
);
check("the hook reports whether it has read anything", /loaded: view !== null/.test(read("src/lib/workspace/useFirstVersionJob.ts")));
/**
 * A queued generation is a success, not a missing output — the rule that used
 * to live in `/create`. The workspace is the only caller now, and it reads a
 * returned `jobId` as "already running" rather than showing a failure.
 */
check(
  "a queued generation is not reported as a failure",
  /if \(result\.jobId && !result\.error\) return;/.test(preOutputCode),
);
check(
  "and the limit still comes from the server's own reservation",
  /result\.limitReached\.limit/.test(preOutputCode),
);
check(
  "and a typed build instruction waits for it too",
  /!output && job\.loaded && !job\.active && classifyBuildIntent/.test(preOutputCode),
);

/* ── 8. one control per step ─────────────────────────────────────────────── */

/**
 * The workspace showed the build question and a "Создать первую версию" card at
 * the same time: two controls for one step, in different words, and the card's
 * button carried no answer to the question sitting above it. Whichever the
 * person pressed, one of the two was wrong — and nothing on screen said which.
 *
 * The question owns the step while it is pending. The card returns for
 * everything after it: retrying a failure, or building when there is nothing
 * left to ask.
 */
// Written as the terms the gate must contain rather than the exact expression,
// so adding a further condition — `job.loaded` was added after this — does not
// read as the duplicate returning.
const createCardGate = preOutputCode.slice(
  preOutputCode.indexOf("{job.loaded && !hasVersion"),
  preOutputCode.indexOf("{job.loaded && !hasVersion") + 90,
);
check(
  "the create card is hidden while a question is pending",
  createCardGate.includes("!intake.step"),
  "the duplicate call to action is back",
);

// Both halves matter: the question must still be the thing that is shown.
check("the question renders in that state", /intake\.step \? tb\(intake\.step\.titleKey/.test(preOutputCode));
check(
  "and it is the intake that generates when answered",
  /onComplete: \(answers: IntakeAnswers\) => createFirstVersion\(false, answers\)/.test(preOutputCode),
);

/**
 * The card is hidden, not deleted — a failed generation still needs its retry,
 * and that state cannot collide with the question, which requires an idle job.
 */
check("the card still exists for the states that need it", /t\("createFirstVersion"\)/.test(preOutputCode));
check(
  "and the question cannot appear beside a failed job",
  /job\.loaded && job\.phase === "idle"/.test(preOutputCode),
);

/* ── 9. nothing is offered before the state is known ─────────────────────── */

/**
 * On first paint there is no job view yet, so `job.active` is false and there is
 * no question — which is exactly the shape of "nothing has ever been built".
 * The create card matched that and appeared for a frame before the question it
 * duplicates replaced it.
 *
 * Both controls now wait for the same read. Until the row has been read the
 * screen cannot name which state it is in, and the honest thing to show for a
 * state you cannot name is nothing.
 */
// The gate has since gained `job.phase !== "succeeded"`, so this reads the
// terms it must contain rather than the exact expression.
check(
  "the create card waits for the job row to be read",
  createCardGate.includes("job.loaded"),
  "the CTA can render before the first poll again",
);
check(
  "the question waits for the same read",
  /enabled: !hasVersion && !!direction && job\.loaded && job\.phase === "idle"/.test(preOutputCode),
);

/**
 * `loaded` has to mean "a row was read", not "a row exists" — otherwise a
 * project with no job at all would never finish loading and the workspace would
 * offer nothing forever.
 */
const jobHook = read("src/lib/workspace/useFirstVersionJob.ts");
check("loaded means the view was fetched", /loaded: view !== null/.test(jobHook));
check(
  "and a project with no job still becomes loaded",
  /setView\(next\)/.test(jobHook),
  "nothing sets the view, so loaded could never become true",
);

// The progress card is not an action and is already correct: it needs an
// actually-running job, which cannot be true before the first read.
check("the progress card needs a running job", /\{job\.active && elapsed >= 1 && \(/.test(preOutputCode));
// Retry likewise: `canRetry` requires a failed or stale phase.
check("retry needs a failed job", /onPreviewRetry=\{job\.canRetry \?/.test(preOutputCode));

if (failures.length > 0) {
  console.error(`discovery-choice-flow: ${failures.length} failed, ${passed} passed`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`discovery-choice-flow: ${passed} checks passed`);
