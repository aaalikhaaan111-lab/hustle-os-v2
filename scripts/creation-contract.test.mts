/**
 * The discovery prompt must describe the object the sanitizers accept.
 *
 *   npx tsx --conditions=react-server scripts/creation-contract.test.mts
 *
 * WHY. On 2026-08-12 every production discovery turn failed validation while
 * Gemini answered healthily in ~7 s. The model returned
 * `["transition","message","choices","allowMultiple","directions"]` — three
 * complete directions and no `phase`, the field `sanitizeCreationTurn` branches
 * on, so the whole turn was discarded unread. It had also invented
 * `allowMultiple` for what the code calls `choiceMode`.
 *
 * The model was not at fault. The prompt discussed "ask" and "propose" in prose
 * but never said the object must carry `phase`, never named `choiceMode`, and
 * never named `projectType`; the JSON schema that once travelled with the
 * request was removed because Gemini refused it at every size. Nothing stated
 * the shape and nothing enforced it. The fields the model got right were
 * exactly the ones the prompt named.
 *
 * So the prompt now states the contract — and this pins it to the code. Every
 * field name, limit and enum below is read from `creationTypes.ts` rather than
 * written here, so tightening a sanitizer without updating the prompt fails
 * here instead of in production. The two documented examples are parsed out of
 * the prompt and run through the real sanitizers, which is the only assertion
 * that can prove the contract is achievable rather than merely plausible.
 *
 * Offline. No network, no provider, no database.
 */

import {
  CREATION_LIMITS,
  V1_PRESETS,
  sanitizeCreationDirection,
  sanitizeCreationTurn,
} from "../src/lib/build/creationTypes";
import { creationSystemPrompt } from "../src/lib/build/creationPrompt";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const prompt = creationSystemPrompt("en", null);
const russian = creationSystemPrompt("ru", null);

/* ── 1. the discriminant is named ────────────────────────────────────────── */

check("the prompt names the phase field", /"phase"/.test(prompt));
check(
  "and says it is required, not optional",
  /Always required[\s\S]{0,200}"phase"/.test(prompt),
);
check(
  "and that an object without it is discarded",
  /without "phase" is discarded/.test(prompt),
);

/* ── 2. only the two phases the code accepts are advertised ──────────────── */

check('the prompt advertises "ask"', /"ask"/.test(prompt));
check('the prompt advertises "propose"', /"propose"/.test(prompt));

/**
 * Derived, not listed. `sanitizeCreationTurn` rejects anything that is not one
 * of these two, so any third phase advertised here would be a promise the code
 * breaks. The values are recovered by asking the sanitizer.
 */
const PHASE_CANDIDATES = ["ask", "propose", "reveal", "focus", "none", "question", "final", "build"];
const acceptedPhases = PHASE_CANDIDATES.filter(
  (phase) => sanitizeCreationTurn({ phase, message: "x", directions: [{
    name: "n", concept: "c", forWho: "f", creates: "cr", whyFits: "w",
    problem: "p", audience: "a", projectType: V1_PRESETS[0],
  }] }) !== null,
);
check(
  "the code accepts exactly two phases",
  acceptedPhases.length === 2 && acceptedPhases.includes("ask") && acceptedPhases.includes("propose"),
  JSON.stringify(acceptedPhases),
);
for (const rejected of PHASE_CANDIDATES.filter((phase) => !acceptedPhases.includes(phase))) {
  check(
    `the prompt does not advertise "${rejected}" as a phase`,
    !new RegExp(`"phase"\\s*(?:is|:)\\s*"${rejected}"`).test(prompt),
  );
}

/* ── 3. choiceMode, named exactly as the code reads it ───────────────────── */

check("the prompt names choiceMode", /"choiceMode"/.test(prompt));
for (const mode of ["single", "multiple"]) {
  check(`and advertises "${mode}"`, new RegExp(`"choiceMode"[\\s\\S]{0,120}"${mode}"`).test(prompt));
}

/**
 * The invented alias, from the production failure.
 *
 * `sanitizeCreationTurn` reads `choiceMode` and nothing else, so a prompt that
 * mentioned `allowMultiple` at all would be describing a field the code drops.
 */
const aliasIsSupported = sanitizeCreationTurn({
  phase: "ask", message: "x", allowMultiple: true,
})?.choiceMode === "multiple";
check("the code does not support allowMultiple", !aliasIsSupported);
check("so the prompt never mentions it", !/allowMultiple/i.test(prompt));

/* ── 4. projectType and its enum, taken from the contract ────────────────── */

check("the prompt names projectType", /"projectType"/.test(prompt));
for (const preset of V1_PRESETS) {
  check(`and advertises "${preset}"`, new RegExp(`"${preset}"`).test(prompt));
}
check(
  "and says an unknown value drops the direction",
  /any other value is dropped/.test(prompt),
);

/* ── 5. every strictly required direction field is named ─────────────────── */

/**
 * Discovered by removing one field at a time from a direction the sanitizer
 * accepts: whichever removals turn acceptance into rejection are the required
 * ones. That way this cannot fall behind a change to `sanitizeCreationDirection`.
 */
const COMPLETE = {
  name: "Wheelside", concept: "A reference.", forWho: "Potters", creates: "A page",
  whyFits: "It is yours.", problem: "Guesswork.", audience: "Students",
  niche: "pottery", projectType: V1_PRESETS[0],
};
check("the probe direction is itself valid", sanitizeCreationDirection(COMPLETE) !== null);

for (const field of Object.keys(COMPLETE)) {
  const without: Record<string, unknown> = { ...COMPLETE };
  delete without[field];
  const required = sanitizeCreationDirection(without) === null;
  if (!required) continue;
  check(`the prompt names the required direction field "${field}"`, new RegExp(`"${field}"`).test(prompt));
}

/* ── 6. the documented examples pass the real sanitizers ─────────────────── */

function exampleAfter(label: string): Record<string, unknown> | null {
  const at = prompt.indexOf(label);
  if (at < 0) return null;
  const line = prompt.slice(at + label.length).split("\n").find((entry) => entry.trim().startsWith("{"));
  if (!line) return null;
  try {
    return JSON.parse(line.trim()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const askExample = exampleAfter('Minimal valid "ask":');
const proposeExample = exampleAfter('Minimal valid "propose":');

check("an ask example is documented and is valid JSON", askExample !== null);
check("a propose example is documented and is valid JSON", proposeExample !== null);

if (askExample) {
  const turn = sanitizeCreationTurn(askExample);
  check("the ask example survives sanitizeCreationTurn", turn !== null);
  check("and is an ask turn", turn?.phase === "ask");
  check("with its choices kept", (turn?.choices.length ?? 0) >= 2, JSON.stringify(turn?.choices));
  // A documented example that quietly loses a field teaches the model that the
  // field is optional.
  const declared = Array.isArray(askExample.choices) ? askExample.choices.length : 0;
  check("and no choice silently dropped", turn?.choices.length === declared);
}

if (proposeExample) {
  const turn = sanitizeCreationTurn(proposeExample);
  check("the propose example survives sanitizeCreationTurn", turn !== null);
  check("and is a propose turn", turn?.phase === "propose");
  check("with its direction kept", turn?.directions.length === 1, JSON.stringify(turn?.directions.length));

  const direction = turn?.directions[0];
  check("whose projectType is a real preset", !!direction && V1_PRESETS.includes(direction.projectType));
  // The brief is what generation reads; an example that lost it would teach the
  // model to omit it.
  check("and whose creativeBrief survived", (direction?.creativeBrief.startingMaterial.length ?? 0) > 0);
  check("with its assumptions kept", (direction?.creativeBrief.assumptions.length ?? 0) === 1);
}

/* ── 7. nothing the examples say exceeds the limits they cite ────────────── */

check(
  "the message cap the prompt quotes is the code's",
  new RegExp(`at most ${CREATION_LIMITS.message} characters`).test(prompt),
);
for (const [label, limit] of [["name", CREATION_LIMITS.name], ["audience", CREATION_LIMITS.audience], ["niche", CREATION_LIMITS.niche]] as const) {
  check(`the ${label} cap the prompt quotes is the code's`, new RegExp(`"${label}" \\(<=${limit}\\)`).test(prompt));
}

/* ── 8. the contract survives translation of the surrounding prose ───────── */

// Field names are protocol, not copy: the Russian prompt must carry the same
// keys, or the bug returns for exactly the users who hit it.
for (const key of ['"phase"', '"choiceMode"', '"projectType"', '"directions"', '"message"']) {
  check(`the Russian prompt still names ${key}`, russian.includes(key));
}
check("and still asks for Russian output", /write every user-visible field in Russian/.test(russian));

/* ── 9. discovery's existing behaviour is untouched ──────────────────────── */

// The guard against a redesign: the instructions that make discovery propose
// early and assume rather than interrogate must still be there.
check("BUILD FIRST survives", /BUILD FIRST/.test(prompt));
check("the assumption rule survives", /Assume rather than interrogate/.test(prompt));
check("the single-question rule survives", /Never ask a third/.test(prompt));
check("the previous-turn block still interpolates", creationSystemPrompt("en", {
  phase: "ask", message: "m", choices: [], choiceMode: "single", directions: [], transition: "none",
}).includes("PREVIOUS STRUCTURED TURN"));

if (failures.length > 0) {
  console.error(`creation-contract: ${failures.length} failed, ${passed} passed`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`creation-contract: ${passed} checks passed`);
