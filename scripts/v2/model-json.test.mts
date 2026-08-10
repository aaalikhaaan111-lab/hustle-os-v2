/**
 * The model-JSON normaliser, and proof it cannot be used as a way in.
 *
 *   npx tsx --conditions=react-server scripts/v2/model-json.test.mts
 *
 * Two halves. The first is that the two observed transport defects are
 * repaired — illegal `\'` escapes and raw control characters inside strings —
 * on the exact byte sequences the paid responses contained.
 *
 * The second matters more. Anything that makes a parser accept more is a
 * candidate for smuggling something past it, so the hostile half proves that
 * normalising the envelope changes nothing about what the gates do with the
 * contents: a repaired document is still validated, still scanned, still
 * refused for the same reasons, and cannot be made to parse into a *different*
 * document than the model wrote.
 *
 * Offline.
 */

import { normaliseModelJson, parseModelJsonSafe, parseModelJson } from "../../src/lib/v2/json/modelJson";
import { validateGeneratedApp } from "../../src/lib/v2/app/validate";
import { APP_SCHEMA_VERSION } from "../../src/lib/v2/app/contract";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

/* ── 1. the defects that cost five paid generations ──────────────────────── */

{
  // Verbatim from gem-setlist/req1: a JavaScript escape inside a JSON string.
  const raw = String.raw`{"files":{"src/data.ts":"const s = 'Sweet Child O\' Mine';"}}`;
  const outcome = parseModelJsonSafe(raw);
  check("an illegal \\' escape is repaired", outcome.ok);
  check("and reported as repaired", outcome.repaired && outcome.report.invalidEscapes === 1);
  const value = outcome.value as { files: Record<string, string> };
  // The backslash is load-bearing: the payload is JavaScript, and dropping it
  // yields valid JSON containing a syntax error.
  check("the escape survives into the source, backslash and all",
    value?.files["src/data.ts"] === String.raw`const s = 'Sweet Child O\' Mine';`,
    JSON.stringify(value?.files["src/data.ts"]));
}

{
  // Verbatim shape from gem-kanji/req1 and gem-landing: a literal newline in a
  // string, among correctly escaped ones.
  const raw = '{"files":{"src/App.tsx":"line one\\n  <span>\nline two</span>\\n"}}';
  const outcome = parseModelJsonSafe(raw);
  check("a raw newline inside a string is repaired", outcome.ok);
  check("and counted", outcome.report.controlCharacters === 1, String(outcome.report.controlCharacters));
  const value = outcome.value as { files: Record<string, string> };
  check("the newline is preserved as content, not deleted",
    value?.files["src/App.tsx"] === "line one\n  <span>\nline two</span>\n");
}

{
  const raw = '{"a":"col\tumn"}';
  const outcome = parseModelJsonSafe(raw);
  check("a raw tab is repaired", outcome.ok && (outcome.value as { a: string }).a === "col\tumn");

  const withCr = '{"a":"one\r\ntwo"}';
  const crOutcome = parseModelJsonSafe(withCr);
  check("a CRLF is repaired", crOutcome.ok && (crOutcome.value as { a: string }).a === "one\r\ntwo");

  const nul = '{"a":"xy"}';
  const nulOutcome = parseModelJsonSafe(nul);
  check("an exotic control character is escaped, not dropped",
    nulOutcome.ok && (nulOutcome.value as { a: string }).a === "xy");
}

{
  const fenced = "```json\n{\"a\":1}\n```";
  const outcome = parseModelJsonSafe(fenced);
  check("a markdown fence is stripped", outcome.ok && (outcome.value as { a: number }).a === 1);
  check("and reported", outcome.report.fenced);
  check("a bare ``` fence too", parseModelJsonSafe("```\n{\"a\":1}\n```").ok);
}

/* ── 2. valid JSON is untouched ──────────────────────────────────────────── */

{
  const original = { files: { "a.ts": "line\nbreak\ttab \\ backslash \" quote" }, n: 1.5, b: [true, null] };
  const text = JSON.stringify(original);
  const outcome = parseModelJsonSafe(text);
  check("well-formed JSON parses without repair", outcome.ok && !outcome.repaired);
  check("and is byte-identical after a round trip",
    JSON.stringify(outcome.value) === text);
  check("normalising valid JSON is a no-op", normaliseModelJson(text).text === text);
  check("with nothing reported", normaliseModelJson(text).report.controlCharacters === 0);
}

/* ── 3. what must STILL fail ─────────────────────────────────────────────── */

const STILL_INVALID: Array<[string, string]> = [
  ["prose before the object", 'Here you go:\n{"a":1}'],
  ["prose after the object", '{"a":1}\nHope that helps!'],
  ["two documents", '{"a":1}{"b":2}'],
  ["a truncated object", '{"a":1'],
  ["a truncated string", '{"a":"unterminated'],
  ["not JSON at all", "I cannot do that."],
  ["an unescaped quote inside a string", '{"a":"say "hi" now"}'],
  ["a trailing comma", '{"a":1,}'],
  ["single-quoted keys", "{'a':1}"],
  ["an undefined value", '{"a":undefined}'],
  ["a bare identifier", '{a:1}'],
];
for (const [name, text] of STILL_INVALID) {
  check(`still refused: ${name}`, !parseModelJsonSafe(text).ok);
}

check("the throwing form throws", (() => {
  try { parseModelJson("nope"); return false; } catch { return true; }
})());

/* ── 4. hostile: repair must not change what the document means ──────────── */

{
  // The normaliser must never join two strings, close a string early, or move
  // a byte from inside a string to outside it. If it did, a model could write
  // a payload that parses as one thing here and another thing downstream.
  const tricky = '{"a":"ends with a backslash \\\\","b":"next"}';
  const outcome = parseModelJsonSafe(tricky);
  const value = outcome.value as { a: string; b: string };
  check("a trailing escaped backslash does not swallow the next key",
    outcome.ok && value.a === "ends with a backslash \\" && value.b === "next");

  const escapedQuote = '{"a":"he said \\"no\\"","b":2}';
  const eq = parseModelJsonSafe(escapedQuote);
  check("escaped quotes keep the string closed in the right place",
    eq.ok && (eq.value as { a: string; b: number }).b === 2);

  // A raw newline between properties is ordinary JSON whitespace and must not
  // be escaped into a string.
  const structural = '{\n  "a": 1,\n  "b": 2\n}';
  check("structural whitespace is left alone", normaliseModelJson(structural).text === structural);
  check("and still parses to the same object",
    JSON.stringify(parseModelJsonSafe(structural).value) === '{"a":1,"b":2}');

  // An unknown escape that is not a quote keeps its backslash, so code like
  // a regex `\d` inside a string is not silently turned into `d`.
  const regex = '{"a":"const re = /\\d+/;"}';
  const re = parseModelJsonSafe(regex);
  check("a legal \\\\d escape sequence is preserved", re.ok);
}

/* ── 5. hostile: a repaired document still faces every gate ──────────────── */

const hostileProject = (files: Record<string, string>) =>
  // Deliberately written with a raw newline in a string so it can ONLY be
  // parsed after normalisation — the point is what happens next.
  '{"schemaVersion":"' + APP_SCHEMA_VERSION + '",' +
  '"metadata":{"name":"X","description":"d\nwith a raw newline","locale":"en"},' +
  '"runtime":{"template":"react-spa","dependencies":["react"]},' +
  '"routes":[{"path":"/","module":"src/App.tsx","title":"X"}],' +
  '"files":' + JSON.stringify(files) + "}";

const HOSTILE: Array<[string, Record<string, string>, string]> = [
  ["network access", { "src/App.tsx": "export default function A(){ fetch('https://evil.example'); return null; }" }, "network"],
  ["storage", { "src/App.tsx": "export default function A(){ localStorage.setItem('a','b'); return null; }" }, "storage"],
  ["eval", { "src/App.tsx": "export default function A(){ eval('1+1'); return null; }" }, "eval"],
  ["parent access", { "src/App.tsx": "export default function A(){ window.parent.postMessage(1,'*'); return null; }" }, "frame_escape|parent"],
  ["a path outside the project", { "../../etc/passwd.ts": "x", "src/App.tsx": "export default ()=>null;" }, "path"],
  ["a reserved path", { "package.json": "{}", "src/App.tsx": "export default ()=>null;" }, "reserved"],
  ["an unlisted dependency", { "src/App.tsx": "import x from 'jquery';\nexport default ()=>null;" }, "import"],
];

for (const [name, files, expect] of HOSTILE) {
  const text = hostileProject(files);
  const outcome = parseModelJsonSafe(text);
  check(`hostile "${name}" parses only after repair`, outcome.ok && outcome.repaired);
  if (!outcome.ok) continue;
  const validation = validateGeneratedApp(outcome.value);
  check(`hostile "${name}" is still refused by the validator`, !validation.ok);
  if (!validation.ok) {
    const codes = validation.issues.map((i) => `${i.path} ${i.code}`).join(" ");
    check(`  and refused for the right reason (${expect})`, new RegExp(expect, "i").test(codes), codes.slice(0, 120));
  }
}

/* a benign project that needed repair must still be ACCEPTED — the gate is
   not simply refusing everything the normaliser touched */
{
  const text = hostileProject({
    "src/App.tsx": 'import "./styles.css";\nexport default function App(){ return <div className="flex">ok</div>; }',
    "src/styles.css": ".a{color:red}",
  });
  const outcome = parseModelJsonSafe(text);
  check("a benign project needing repair still parses", outcome.ok);
  if (outcome.ok) {
    const validation = validateGeneratedApp(outcome.value);
    check("and is accepted by the validator", validation.ok,
      validation.ok ? "" : validation.issues.map((i) => i.code).join(","));
    if (validation.ok) {
      check("with the repaired newline intact in its metadata",
        validation.app.metadata.description.includes("\n"));
    }
  }
}

/* ── report ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`FAILED ${failures.length} of ${passed + failures.length}`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`model json: ${passed} checks passed`);
