/**
 * Regression tests for natural-language site editing.
 *
 *   npx tsx scripts/site-edit.test.mts
 *
 * Reported: "поменяй шрифт и цвет фона на другой" was answered with "make these
 * changes in the design settings" — an interface Ventrio does not have.
 *
 * Editing was never missing. `editProjectOutputAction` has always sent the
 * current artifact and the requested change to the model and written back a new
 * one. What was missing is that the request never reached it: the old test
 * matched a fixed verb list anchored to the START of the message, and "поменяй"
 * was not in the list. So these tests are mostly about vocabulary and routing.
 */

import { readFileSync } from "node:fs";
import { classifySiteIntent, isSiteMutation, editScopeFor } from "../src/lib/build/siteEditIntent";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const withSite = { hasOutput: true };

/* ── 1. the exact reported message ──────────────────────────────────────── */

check(
  'reported: "поменяй шрифт и цвет фона на другой" is an edit',
  classifySiteIntent("поменяй шрифт и цвет фона на другой", withSite) === "EDIT_CURRENT",
  classifySiteIntent("поменяй шрифт и цвет фона на другой", withSite),
);

/* ── 2. every example the brief lists ───────────────────────────────────── */

const EXPECTED: Array<[string, string]> = [
  // Russian
  ["Поменяй шрифт и фон.", "EDIT_CURRENT"],
  ["Сделай дизайн светлее.", "EDIT_CURRENT"],
  ["Сделай кнопку заметнее.", "EDIT_CURRENT"],
  ["Добавь форму размещения растения.", "ADD_FEATURE"],
  ["Убери этот раздел.", "REMOVE_ELEMENT"],
  ["Полностью измени стиль, но сохрани содержание.", "REGENERATE_STYLE"],
  ["Верни предыдущую версию.", "UNDO"],
  // English
  ["Use a serif display font and a warm off-white background.", "EDIT_CURRENT"],
  ["Add a pricing section.", "ADD_FEATURE"],
  ["Make the hero more minimal.", "EDIT_CURRENT"],
  ["Remove the testimonials.", "REMOVE_ELEMENT"],
  ["Undo the last change.", "UNDO"],
  // From the acceptance tests
  ["Поменяй шрифт на выразительный serif и сделай фон светлым.", "EDIT_CURRENT"],
  ["Добавь форму, где человек может разместить растение с фотографией, названием и городом.", "ADD_FEATURE"],
  ["Убери блок идентичности.", "REMOVE_ELEMENT"],
  ["Полностью измени визуальный стиль. Сделай его светлым, ботаническим и редакционным, но сохрани смысл и функции.", "REGENERATE_STYLE"],
];
for (const [message, expected] of EXPECTED) {
  const actual = classifySiteIntent(message, withSite);
  check(`"${message.slice(0, 46)}" → ${expected}`, actual === expected, actual);
}

/* ── 3. mutations route to a real generation ────────────────────────────── */

for (const intent of ["EDIT_CURRENT", "REGENERATE_STYLE", "ADD_FEATURE", "REMOVE_ELEMENT"] as const) {
  check(`${intent} produces a new version`, isSiteMutation(intent));
}
check("UNDO is not a generation", !isSiteMutation("UNDO"));
check("DISCUSS is not a generation", !isSiteMutation("DISCUSS"));

/* ── 4. conversation is still conversation ──────────────────────────────── */

// A false positive spends an edit; a false negative is the reported bug. The
// line sits where a verb is aimed at something that exists on the page.
const NOT_EDITS = [
  "как думаешь, кому это будет полезно?",
  "what should I do next?",
  "мне нравится результат",
  "who is the audience for this?",
  "спасибо",
];
for (const message of NOT_EDITS) {
  check(`"${message}" stays conversation`, classifySiteIntent(message, withSite) === "DISCUSS", classifySiteIntent(message, withSite));
}

// A question that names something on the page is still a request.
check(
  "a polite question about the font is an edit",
  classifySiteIntent("можешь поменять шрифт?", withSite) === "EDIT_CURRENT",
);

// With no site yet there is nothing to edit.
check(
  "before a site exists nothing is an edit",
  classifySiteIntent("поменяй шрифт и фон", { hasOutput: false }) === "DISCUSS",
);

/* ── 5. scope keeps an edit from becoming a rewrite ─────────────────────── */

check("a focused edit is focused", editScopeFor("EDIT_CURRENT") === "FOCUSED");
check("a restyle may move layout", editScopeFor("REGENERATE_STYLE") === "VISUAL_WHOLESALE");
check("adding is additive", editScopeFor("ADD_FEATURE") === "CONTENT_ADD");
check("removing is subtractive", editScopeFor("REMOVE_ELEMENT") === "CONTENT_REMOVE");

const stage3 = read("src/lib/actions/stage3.ts");
check("the scope reaches the model", /editScope: editScopeFor\(intent\)/.test(stage3));
check(
  "the prompt tells a focused edit to leave the rest byte-identical",
  /must leave every other field byte-identical to currentOutput/.test(stage3),
);
check(
  "and a restyle to keep the product's meaning",
  /this is a restyle, not a new product/.test(stage3),
);

/* ── 6. versions are kept, and undo restores one ────────────────────────── */

const types = read("src/lib/build/stage3Types.ts");
check("state carries a bounded history", /history: Stage3ProjectOutput\[\]/.test(types) && /MAX_OUTPUT_HISTORY/.test(types));
check("a new version keeps the one it replaced", /export function withNewOutput/.test(types));
check("stepping back is possible", /export function withPreviousOutput/.test(types));
check("the edit path stores history", /\.\.\.withNewOutput\(stage3, output\)/.test(stage3));
check("undo exists as its own action", /export async function undoProjectOutputAction/.test(stage3));
// Undo must not be a generation: it cannot cost quota or be refused when the
// allowance is gone, because it is the recovery from a bad edit.
const undoBody = stage3.slice(stage3.indexOf("export async function undoProjectOutputAction"));
const undoEnd = undoBody.indexOf("\n}\n");
check(
  "undo spends no quota and calls no model",
  !/consumeAiUsage|anthropic|client\.messages\.create/i.test(undoBody.slice(0, undoEnd)),
);
check(
  "nothing to undo is reported, not silently ignored",
  /undoNothing/.test(stage3),
);

for (const locale of ["en", "ru"]) {
  const messages = JSON.parse(read(`messages/${locale}.json`)) as { stage3: Record<string, string> };
  for (const key of ["undoDone", "undoNothing"]) {
    check(`stage3.${key} exists in ${locale}`, typeof messages.stage3[key] === "string");
  }
}

/* ── 7. the workspace routes on the classifier ──────────────────────────── */

const workspace = read("src/components/build/PreOutputWorkspace.tsx");
check("the workspace classifies the message", /classifySiteIntent\(content, \{ hasOutput: !!output \}\)/.test(workspace));
check("mutations go to the edit action", /isSiteMutation\(intent\)/.test(workspace));
check("undo goes to the undo action", /undoProjectOutputAction\(projectId, conversationId\)/.test(workspace));
check(
  "the old leading-verb test no longer decides this",
  !/isProjectOutputEditRequest\(content\)/.test(workspace),
);
// A failed edit must leave the site alone.
check(
  "a failed edit does not clear the current version",
  /if \(result\.error \|\| !result\.output\)[\s\S]{0,400}setInput\(content\);/.test(workspace),
);

/* ── report ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`FAILED ${failures.length} of ${passed + failures.length}`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`site edit: ${passed} checks passed`);
