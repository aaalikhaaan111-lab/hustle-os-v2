/**
 * What a brand-new user meets, and the four ways it used to lie to them.
 *
 *   npx tsx --conditions=react-server scripts/first-run-ux.test.mts
 *
 * Every defect pinned here was reported from real first-use, and every one was
 * SILENT — nothing threw, nothing logged, and the screen looked plausible:
 *
 *   an answer that vanished        choosing a direction left no trace in the
 *                                  transcript, so the conversation jumped from
 *                                  "here are three options" to a build
 *   a thumbnail that was dropped   the shadcn rewrite lost the `preview` field,
 *                                  so six visual directions were described by
 *                                  two words each and `DesignPreview` became
 *                                  dead code nobody imported
 *   a retry that did nothing       the optimistic phase was cleared a round trip
 *                                  before the new job row arrived, so the UI fell
 *                                  back to the failure it had just left
 *   one paragraph, three screens   the same five-step explainer on Overview,
 *                                  Projects and Create
 *
 * Source-level, because there is no DOM here and what regressed in each case is
 * which module renders or records what — exactly what source can pin.
 *
 * Offline. No network, no provider, no database.
 */

import { readFileSync } from "node:fs";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const questionnaire = read("src/components/build/Questionnaire.tsx");
const create = read("src/components/create/CreateExperience.tsx");
const workspace = read("src/components/build/PreOutputWorkspace.tsx");
const jobHook = read("src/lib/workspace/useFirstVersionJob.ts");
const projects = read("src/components/workspace/ProjectsScreen.tsx");
const overview = read("src/components/workspace/OverviewScreen.tsx");
const en = JSON.parse(read("messages/en.json")) as Record<string, Record<string, unknown>>;
const ru = JSON.parse(read("messages/ru.json")) as Record<string, Record<string, unknown>>;

/* ── 1. every answer joins the conversation ──────────────────────────────── */

/**
 * `send()` appends a user turn before it does anything else, so typed answers
 * and clarification choices always read back. The two paths that bypass it are
 * the ones that went silent.
 */
check("choosing a direction records it as something the person said",
  /setMessages\(\(current\) => \[\.\.\.current, \{ role: "user", content: direction\.name \}\]\)/.test(create),
  "chooseDirection persists and hands off; without this the choice leaves no trace");
check("and it is appended before the await, not after the round trip",
  create.indexOf('content: direction.name') < create.indexOf("await selectCreationDirectionAction"),
  "appending after the network call shows the answer a second late");

check("intake answers are recorded too",
  /function answerIntake\(/.test(workspace) &&
  /append\("user", chosen \? tb\(chosen\.labelKey as never\) : tb\(step\.deferKey as never\)\)/.test(workspace));
check("including a skip, because choosing not to choose is still an answer",
  /onSkip=\{intake\.step \? \(\) => answerIntake\(null\) : undefined\}/.test(workspace),
  "an unrecorded skip makes the generation that follows look unprompted");
check("and typed text is no longer discarded",
  /onAnswer=\{\(\{ ids, text \}\) => answerIntake\(ids\[0\] \?\? null, text\)\}/.test(workspace),
  "onAnswer used to read only `ids`, so anything typed into the freeform row vanished");

/* ── 2. one action at a time ─────────────────────────────────────────────── */

check("the composer is hidden while a question is open",
  !/<\/div>\s*\{composer\}\s*<\/>/.test(questionnaire),
  "options plus an open text box is two competing answers to one step");
check("and restored the moment there is no question",
  /if \(options\.length === 0\) return <>\{composer\}<\/>;/.test(questionnaire));
check("the question still carries its own way out",
  /freeformLabel &&/.test(questionnaire) && /QuestionnaireSkip/.test(questionnaire),
  "hiding the composer is only safe because typing and skipping live inside the question");

/* ── 3. the visual directions are visible ────────────────────────────────── */

check("QuestionnaireOption carries a preview again",
  /preview\?: DesignPreviewId;/.test(questionnaire),
  "without the field the value passed by the workspace is silently dropped");
check("and the questionnaire renders it",
  /<DesignPreview id=\{option\.preview\} \/>/.test(questionnaire),
  "DesignPreview.tsx was dead code nothing imported");
check("the workspace is still passing one",
  /preview: "preview" in option/.test(workspace));

/* ── 4. retry recovers on its own ────────────────────────────────────────── */

/**
 * The failure was a two-line ordering bug: clearing the optimistic phase before
 * the refreshed row arrived left a gap in which `view` still held the FAILED
 * job, so the screen snapped back to the error — and `inFlight`, derived from
 * the same pair, tore the poller down with it.
 */
check("settle clears the optimistic phase only once the row is in hand",
  /const settle = useCallback\(\(\) => \{\s*void getFirstVersionJobAction\(projectId\)\.then\(\(next\) => \{[\s\S]{0,160}setView\(next\);\s*setLocal\(null\);/.test(jobHook),
  "setLocal(null) before the await is what made retry need a manual browser refresh");
check("and never writes into an unmounted tab",
  /if \(!mounted\.current\) return;[\s\S]{0,80}setView\(next\);\s*setLocal\(null\);/.test(jobHook));

/* ── 5. the confirmation card is gone, the recovery card is not ──────────── */

check("the card no longer appears on the healthy path",
  /\(hasFailed \|\| outOfQuota \|\| \(intake\.dispatched && job\.phase === "idle"\)\)/.test(workspace),
  "'Ready to become real.' asked again for a decision already made");
check("but a dispatch that never produced a job can still be retried",
  /intake\.dispatched && job\.phase === "idle"/.test(workspace),
  "without this term an errored dispatch is a dead end with no control at all");
check("and the conversation announces the build instead",
  /if \(!retry\) append\("assistant", t\("buildingNow"\)\)/.test(workspace));
check("in both languages",
  typeof (en.stage3 as Record<string, unknown>)?.buildingNow === "string" &&
  typeof (ru.stage3 as Record<string, unknown>)?.buildingNow === "string");

/* ── 6. empty states say where you are, not what the product is ──────────── */

check("the five-step explainer is gone from every screen",
  !/HowItWorks/.test(projects) && !/HowItWorks/.test(overview) && !/HowItWorks/.test(create),
  "one paragraph recited on three screens reads as filler, not help");
check("and its copy went with it rather than lingering unused",
  !("stepDescribe" in (en.workspace as Record<string, unknown>)) &&
  !("stepsLabel" in (en.workspace as Record<string, unknown>)),
  "orphaned keys are the seed of the next stale translation");
check("projects explains what this screen holds",
  /projectsEmptyTitle/.test(projects) && /projectsEmptyBody/.test(projects) &&
  typeof (en.workspace as Record<string, unknown>).projectsEmptyBody === "string");
check("in both languages",
  typeof (ru.workspace as Record<string, unknown>).projectsEmptyTitle === "string" &&
  typeof (ru.workspace as Record<string, unknown>).projectsEmptyBody === "string");

/* ── report ──────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} failed, ${passed} passed\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`✓ first-run ux: ${passed} checks passed`);
