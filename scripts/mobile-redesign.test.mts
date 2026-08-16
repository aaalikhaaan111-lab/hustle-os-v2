/**
 * The platform as one conversation, on a phone.
 *
 *   npx tsx --conditions=react-server scripts/mobile-redesign.test.mts
 *
 * Real-device QA rejected the previous presentation layer. This file pins the
 * decisions that answer it, each against the sentence that prompted it.
 *
 * Offline. Whether it feels premium is a real-device judgement and is not
 * asserted here.
 */

import { readFileSync } from "node:fs";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const strip = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const tokens = read("src/app/studio.css");
/**
 * Comments stripped before asserting. This file has repeatedly matched its own
 * prose: a doc comment saying "the conic-gradient ring is gone" is enough to
 * fail a search for `conic-gradient` in code that no longer contains one.
 */
const nocss = (v: string) => v.replace(/\/\*[\s\S]*?\*\//g, "");
const nocode = (v: string) =>
  v.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const composer = read("src/components/workspace-ui/Composer.tsx");
const preOutput = strip(read("src/components/build/PreOutputWorkspace.tsx"));
const create = strip(read("src/components/create/CreateExperience.tsx"));

/* ── "the whole page still scrolls/bounces" ──────────────────────────────── */

check("the document cannot scroll behind the app frame",
  /body:has\(\.studio-frame\)/.test(tokens) && /overflow: hidden/.test(tokens));
check("and cannot rubber-band", /overscroll-behavior: none/.test(tokens),
  "the bounce is the document overscrolling under a shell that is already the right height");
check("inner scrollers keep their chain to themselves",
  /overscroll-behavior: contain/.test(tokens),
  "reaching the top of the conversation must not start dragging the app");

/* ── "the same three suggestion buttons appear repeatedly" ───────────────── */

check("the standing suggestion row is gone",
  !/sharpenDirection|whoFirst|firstVersionCouldBe|editPremium|editAudience|editCta/.test(preOutput),
  "three fixed phrases sat above the composer for the life of a project");
check("and nothing renders a persistent suggestion list",
  !/suggestions\.map/.test(preOutput));

/**
 * The one place suggestions remain is the opening turn, where they belong to
 * the question being asked and disappear as soon as the conversation starts.
 */
check("the opening turn keeps its own suggestions", /STARTING_POINTS\.map/.test(create));
check("and they are scoped to the empty state", /!started \?/.test(create));

/* ── "composer is oversized", "feel like separate pieces" ────────────────── */

/**
 * The decoration is gone, and there is a lot more of it gone than a glow.
 *
 * The composer carried: a radial violet glow, a 20px saturating backdrop blur,
 * a near-opaque white fill, an inset highlight, a 30px drop shadow that reached
 * the last message, a lift on focus, and a conic-gradient pseudo-element masked
 * to a 1px ring that animated its angle forever at four speeds. All of it was
 * why it read as "an object floating over the conversation" rather than the
 * bottom of it.
 */
const composerRule = tokens.split(".s-composer {")[1]?.split("}")[0] ?? "";
check("the composer has a rule at all", composerRule.length > 0);
check("no blur", !/backdrop-filter/.test(composerRule));
check("no animated edge", !/conic-gradient/.test(nocss(tokens)) && !/ws-edge/.test(nocode(composer)) && !/ws-edge/.test(nocode(read("src/components/ui/VentrioButton.tsx"))));
check("no shadow reaching the conversation", !/box-shadow/.test(composerRule));
check("the composer is compact",
  /padding: 0\.625rem/.test(composerRule) && /h-9/.test(composer),
  "10px of padding and a 36px control row");
check("its text stays 16px on mobile", /text-\[16px\]/.test(composer),
  "anything smaller and iOS zooms the page on focus");

/* ── "New Project feels empty, generic and visually weak" ────────────────── */

check("the empty state speaks in the conversation's own language",
  /animate-message-in/.test(create) && /emptyPrompt/.test(create));
check("the marketing hero has not come back",
  !/openingSignal/.test(create) && !/clamp\(2\.35rem/.test(create));
check("and the dead focus overlay is gone", !/creation-focus-field/.test(create));

/* ── "too much dead space" ───────────────────────────────────────────────── */

check("the conversation uses phone gutters on a phone", /px-3\.5 sm:px-7/.test(create));
check("and the composer well is not a desktop well", /px-3\.5 pb-3 pt-1\.5/.test(preOutput));

/* ── desktop is not solved by degrading it ───────────────────────────────── */

check("desktop keeps its wider gutters", /sm:px-7/.test(create) && /sm:px-8/.test(preOutput));
check("and its taller rhythm", /sm:py-10|sm:py-9/.test(create));

/* ── report ──────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} failed, ${passed} passed\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`✓ mobile redesign: ${passed} checks passed`);
