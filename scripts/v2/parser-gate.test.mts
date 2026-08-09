/**
 * The parser gate.
 *
 *   npx tsx scripts/v2/parser-gate.test.mts
 *
 * The prototype's reject pass was string scanning and a hand-rolled tag walker.
 * Its own header said promoting it past a local gallery required declared
 * parser dependencies, because a scanner reasons about source text while a
 * browser reasons about the tree it builds from that text — and those differ
 * exactly where an attacker aims.
 *
 * These tests are the evidence that the parser is doing work the scanner could
 * not: each case below is markup whose *text* looks harmless and whose *tree*
 * is not, or the reverse.
 */

import { scanCss, scanMarkup } from "../../src/lib/v2/codegen/reject";
import { parseCssIssues, parseMarkupIssues } from "../../src/lib/v2/codegen/parse";
import { PARSER_ALLOWLISTS } from "../../src/lib/v2/codegen/reject";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}
const codes = (html: string) => scanMarkup(html, "$").map((i) => i.code);
const rejects = (html: string) => scanMarkup(html, "$").length > 0;

/* ── 1. the tree, not the text ──────────────────────────────────────────── */

// parse5 resolves each of these to a real element regardless of how the source
// was spelled. A substring scan is looking for a literal it will not find.
const TREE_CASES: Array<[string, string]> = [
  ["nested broken script", "<div><scr<script>ipt>alert(1)</script></div>"],
  ["attribute-position handler", `<div\nonclick\n=\n"x()">hi</div>`],
  ["unquoted handler value", "<div onmouseover=alert(1)>hi</div>"],
  ["entity-encoded scheme", `<a href="&#106;avascript:alert(1)">x</a>`],
  ["tab inside scheme", `<a href="java&#9;script:alert(1)">x</a>`],
  ["uppercase tag", "<DIV><SCRIPT>x</SCRIPT></DIV>"],
  ["svg foreign content", "<svg><desc><script>x()</script></desc></svg>"],
  ["iframe", `<iframe src="/x"></iframe>`],
  ["form", `<form action="https://evil.test"><input name="a"></form>`],
  ["style element", "<style>body{color:red}</style>"],
  ["inline style attribute", `<div style="position:fixed">x</div>`],
  ["comment", "<div><!-- hidden --></div>"],
  ["base tag", `<base href="https://evil.test">`],
  ["object embed", `<object data="/x"></object>`],
];
for (const [name, html] of TREE_CASES) {
  check(`rejected: ${name}`, rejects(html), JSON.stringify(codes(html)));
}

// The parser alone must catch these, not merely the scanner running beside it.
const parserOnly = (html: string) =>
  parseMarkupIssues(html, "$", PARSER_ALLOWLISTS).length > 0;
check("the parser itself sees a broken-up script", parserOnly("<div><scr<script>ipt>x</script></div>"));
check("the parser itself sees an entity-encoded scheme", parserOnly(`<a href="&#106;avascript:alert(1)">x</a>`));
check("the parser itself sees an inline style", parserOnly(`<div style="color:red">x</div>`));

/* ── 2. conforming markup still passes ──────────────────────────────────── */

// A gate that refuses everything is not a gate. These are the shapes a real
// generated page is built from, including the ones only a parser gets right.
// Every user-facing word is a content-pack token — literal copy is refused by
// design, so a fixture written with prose would be testing the wrong contract.
// Tags are fully closed: the scanner refuses implicit closing even though
// parse5 handles it, and that stricter rule is kept deliberately (see below).
const T = "{{ventrio:text:hero.title}}";
const ALLOWED = [
  `<section class="hero"><h1>${T}</h1><p>${T}</p></section>`,
  `<nav><a href="/pricing">${T}</a> <a href="#faq">${T}</a></nav>`,
  `<ul><li>${T}</li><li>${T}</li></ul>`,
  `<table><thead><tr><th scope="col">${T}</th></tr></thead><tbody><tr><td>${T}</td></tr></tbody></table>`,
  `<details open><summary>${T}</summary><p>${T}</p></details>`,
  `<blockquote><p>${T}</p></blockquote>`,
  `<figure><figcaption>${T}</figcaption></figure>`,
];
for (const html of ALLOWED) {
  check(`allowed: ${html.slice(0, 44)}`, !rejects(html), JSON.stringify(codes(html)));
}

/* ── 3. stylesheets are parsed, not scanned ─────────────────────────────── */

const cssRejects = (css: string) => scanCss(css).length > 0;
const CSS_CASES: Array<[string, string]> = [
  ["@import", `@import url("https://evil.test/x.css");`],
  ["url() fetch", `.a{background:url(https://evil.test/x.png)}`],
  ["data uri in url()", `.a{background:url(data:image/svg+xml,<svg/>)}`],
  ["expression()", `.a{width:expression(alert(1))}`],
  ["-moz-binding", `.a{-moz-binding:url(x.xml#y)}`],
  ["malformed", `.a{color:red`],
];
for (const [name, css] of CSS_CASES) {
  check(`css rejected: ${name}`, cssRejects(css), JSON.stringify(scanCss(css).map((i) => i.code)));
}
check("the parser itself sees @import", parseCssIssues(`@import "x";`).length > 0);
check("the parser itself sees url()", parseCssIssues(`.a{background:url(/x.png)}`).length > 0);

// Real design CSS must survive, including the modern features a good page needs.
const OK_CSS = [
  `:root{--ink:#111}.hero{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2rem}`,
  `@media (max-width:640px){.hero{grid-template-columns:1fr}}`,
  `@supports (container-type:inline-size){.card{container-type:inline-size}}`,
  `@keyframes rise{from{opacity:0}to{opacity:1}}.a{animation:rise .6s ease both}`,
  `.btn{background:color-mix(in srgb,var(--ink) 90%,#fff);border-radius:.5rem}`,
  `@layer base{h1{font-size:clamp(2rem,6vw,5rem)}}`,
];
for (const css of OK_CSS) {
  check(`css allowed: ${css.slice(0, 40)}`, !cssRejects(css), JSON.stringify(scanCss(css).map((i) => i.code)));
}

/* ── 3b. where the two gates disagree, on purpose ───────────────────────── */

// parse5 closes `<li>` implicitly, exactly as a browser does, so the parser
// accepts `<ul><li>a<li>b</ul>`. The scanner refuses it as unbalanced. The
// stricter rule wins because both gates must pass, and that is a deliberate
// choice rather than an oversight: requiring a generator to close every element
// costs it nothing, and keeping two independently-written gates in agreement is
// worth more than accepting one convenience. Pinned so the behaviour is a
// decision on record, not a surprise.
const implicitClose = "<ul><li>{{ventrio:text:a}}<li>{{ventrio:text:b}}</ul>";
check(
  "the parser accepts implicit closing",
  parseMarkupIssues(implicitClose, "$", PARSER_ALLOWLISTS).length === 0,
);
check(
  "the merged gate still refuses it, and says why",
  scanMarkup(implicitClose, "$").some((i) => i.code === "unbalanced_tag"),
);

/* ── 4. budgets still bind ──────────────────────────────────────────────── */

check("depth is bounded", rejects("<div>".repeat(40) + "{{ventrio:text:a}}" + "</div>".repeat(40)));
check("element count is bounded", rejects("<span>{{ventrio:text:a}}</span>".repeat(2000)));

/* ── report ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`FAILED ${failures.length} of ${passed + failures.length}`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`parser gate: ${passed} checks passed`);
