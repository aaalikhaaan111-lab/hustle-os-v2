/**
 * The seam between a real project and the codegen contract.
 *
 *   npx tsx scripts/v2/codegen-integration.test.mts
 *
 * Everything here is offline. No provider is contacted, and none of these
 * checks would be improved by contacting one: what is being tested is whether a
 * project's own artifact can drive the contract, and whether stored state
 * survives a database round trip without becoming trusted on the way back.
 */

import { CHRONOVERSE_OUTPUT } from "../../src/lib/build/outputFixtures";
import { compileCodegenBundle } from "../../src/lib/v2/codegen/compile";
import { validateContentPack, CONTENT_KEY_PATTERN } from "../../src/lib/v2/codegen/content";
import { CODEGEN_BUDGETS } from "../../src/lib/v2/codegen/budgets";
import { projectContentPack } from "../../src/lib/v2/codegen/projectContent";
import { buildCodegenBrief, codegenRoutesFor } from "../../src/lib/v2/codegen/projectBrief";
import {
  CODEGEN_STATE_VERSION,
  mergeCodegenState,
  parseCodegenState,
  readCodegenState,
  type CodegenProjectState,
} from "../../src/lib/v2/codegen/projectState";
import type { CodegenBundleV1 } from "../../src/lib/v2/codegen/envelope";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

/* ── 1. a real artifact projects onto a legal pack ──────────────────────── */

const pack = projectContentPack(CHRONOVERSE_OUTPUT);
const packIssues = validateContentPack(pack);
check("the derived pack passes the gate's own validator", packIssues.length === 0,
  JSON.stringify(packIssues.map((i) => i.code)));
check("every key matches the content-key pattern",
  Object.keys(pack).every((key) => CONTENT_KEY_PATTERN.test(key)));
check("no value is empty", Object.values(pack).every((value) => value.length > 0));
check("no value exceeds the budget",
  Object.values(pack).every((value) => value.length <= CODEGEN_BUDGETS.maxContentValueChars));

// The words on the page must be the project's, not a fixture's. If this ever
// resolved to Relay's copy the gate would still pass and the page would be
// about the wrong product — the one failure the token mechanism cannot catch.
check("the brand name is the project's", pack["brand.name"] === CHRONOVERSE_OUTPUT.identity.name);
check("the hero headline is the project's", pack["hero.title"] === CHRONOVERSE_OUTPUT.hero.headline);
check("the audience is carried", pack["audience.body"] === CHRONOVERSE_OUTPUT.targetUser);

// Every section must be addressable, or a bundle cannot render it at all.
for (const [i, section] of CHRONOVERSE_OUTPUT.sections.entries()) {
  const at = `section${i + 1}`;
  check(`${at} has a title key`, typeof pack[`${at}.title`] === "string", section.kind);
  check(`${at} declares its kind`, pack[`${at}.kind`] === section.kind);
}

/* ── 2. a pack with holes stays legal ───────────────────────────────────── */

// An artifact is sanitised but not guaranteed rich. Empty strings must be
// dropped rather than carried, because a key that resolves to "" renders as a
// gap the model was told would hold something.
const sparse = projectContentPack({
  ...CHRONOVERSE_OUTPUT,
  identity: { name: "N", tagline: "", description: "" },
  hero: { ...CHRONOVERSE_OUTPUT.hero, eyebrow: "" },
  sections: [],
});
check("empty values are omitted, not blanked",
  Object.values(sparse).every((value) => value.trim().length > 0));
check("an absent tagline leaves no key", !("brand.tagline" in sparse));
check("a section-less artifact still has a hero", typeof sparse["hero.title"] === "string");

/* ── 3. the brief describes structure without leaking copy ──────────────── */

const brief = buildCodegenBrief({
  output: CHRONOVERSE_OUTPUT,
  intake: { productType: "a product page", designDirection: "brutalist: hard edges, heavy type" },
  locale: "en",
});
check("the brief names the product type", brief.includes("a product page"));
check("the brief names the visual direction", brief.includes("brutalist"));
check("the brief tells the model to commit to the direction", /commit to it/i.test(brief));
check("the brief lists the section structure", brief.includes("CONTENT STRUCTURE"));
check("the brief names each section", CHRONOVERSE_OUTPUT.sections.every((_, i) => brief.includes(`section${i + 1}`)));

// The one rule that keeps `literal_copy` meaningful: if the brief contained the
// page's sentences, the model would have every reason to type them out instead
// of referencing tokens.
const heroBody = CHRONOVERSE_OUTPUT.hero.subheadline;
check("the brief does not carry the hero body copy", !brief.includes(heroBody), heroBody.slice(0, 40));

const deferred = buildCodegenBrief({ output: CHRONOVERSE_OUTPUT, intake: null, locale: "ru" });
check("a deferred intake asks the model to choose", /pick one/i.test(deferred));
check("a deferred intake never states a direction as chosen", !/They chose/.test(deferred));
check("the brief carries the project's language", deferred.includes("ru"));

check("one route is requested", codegenRoutesFor(CHRONOVERSE_OUTPUT).length === 1);
check("that route is the home page", codegenRoutesFor(CHRONOVERSE_OUTPUT)[0].path === "/");

/* ── 4. a bundle written against the derived pack compiles ──────────────── */

const t = (key: string) => `{{ventrio:text:${key}}}`;
const bundle: CodegenBundleV1 = {
  version: "codegen-1",
  css: `body{font-family:system-ui;margin:0}.wrap{max-width:900px;margin:0 auto;padding:48px 24px}h1{font-size:3rem;margin:0 0 16px}`,
  routes: [
    {
      path: "/",
      title: t("page.home.title"),
      bodyHtml: `<div class="wrap"><h1>${t("hero.title")}</h1><p>${t("hero.body")}</p><p>${t("section1.title")}</p></div>`,
    },
  ],
};

const compiled = compileCodegenBundle(bundle, { content: pack });
check("a bundle referencing the derived keys compiles", compiled.ok,
  compiled.ok ? "" : JSON.stringify(compiled.issues.map((i) => i.code)));
if (compiled.ok) {
  check("the compiled page carries the project's headline",
    compiled.routes[0].srcDoc.includes(CHRONOVERSE_OUTPUT.hero.headline));
  check("the compiled page is a complete document",
    compiled.routes[0].srcDoc.startsWith("<!doctype html>"));
}

/* ── 5. stored state is untrusted on the way back ───────────────────────── */

const state: CodegenProjectState = {
  version: CODEGEN_STATE_VERSION,
  kind: "codegen",
  bundle,
  content: pack,
  generatedAt: new Date().toISOString(),
  model: "claude-sonnet-5",
};

// A real round trip: the value that comes back out of Postgres has been through
// JSON, so that is what the parser must be tested against.
const stored = JSON.parse(JSON.stringify(mergeCodegenState({ solution: "keep me" }, state)));
check("merging leaves other snapshot fields alone", stored.solution === "keep me");
const readBack = readCodegenState(stored);
check("state survives a JSON round trip", readBack !== null);
check("the bundle comes back intact", readBack?.bundle.routes[0].path === "/");
check("the pack comes back intact", readBack?.content["brand.name"] === CHRONOVERSE_OUTPUT.identity.name);

check("removing state drops the key", !("codegen" in mergeCodegenState(stored, null)));
check("removing state keeps the rest", mergeCodegenState(stored, null).solution === "keep me");

// Each of these is a value a database could hold after a bad write, a partial
// migration, or an older version of this code. None may render.
const REJECTED: Array<[string, unknown]> = [
  ["null", null],
  ["a string", "codegen"],
  ["an array", []],
  ["the wrong kind", { ...state, kind: "stage3" }],
  ["a future version", { ...state, version: 99 }],
  ["a missing bundle", { ...state, bundle: undefined }],
  ["a non-string content value", { ...state, content: { "a.b": 5 } }],
  ["a bad content key", { ...state, content: { "Bad Key": "x" } }],
  ["a missing timestamp", { ...state, generatedAt: undefined }],
  ["a nonsense timestamp", { ...state, generatedAt: "yesterday" }],
  ["a missing model", { ...state, model: "" }],
];
for (const [name, value] of REJECTED) {
  check(`refused: ${name}`, parseCodegenState(value) === null);
}

/* ── 6. a stored bundle is re-gated, not grandfathered ──────────────────── */

// `parseCodegenState` is a shape gate: it decides whether the row is a codegen
// record at all. It deliberately does not scan markup, because the read path
// compiles immediately afterwards and scanning twice would be the same work
// done twice. The safety claim therefore belongs to the compile, and this is
// where it is proved — a bundle carrying an event handler must not render, no
// matter how long it has been sitting in the database.
const hostileBundle: CodegenBundleV1 = {
  ...bundle,
  routes: [{ ...bundle.routes[0], bodyHtml: `<div onclick="x()">${t("hero.title")}</div>` }],
};
const hostileState = parseCodegenState({ ...state, bundle: hostileBundle });
check("a hostile bundle is still a well-shaped record", hostileState !== null);
const hostileCompiled = compileCodegenBundle(hostileBundle, { content: pack });
check("but the gate refuses it on read", !hostileCompiled.ok);
check("and says why", !hostileCompiled.ok && hostileCompiled.issues.some((i) => i.code === "event_handler"),
  hostileCompiled.ok ? "" : JSON.stringify(hostileCompiled.issues.map((i) => i.code)));

// The same statement for a tag the allowlist has never contained.
const scripted = compileCodegenBundle(
  { ...bundle, routes: [{ ...bundle.routes[0], bodyHtml: "<script>x()</script>" }] },
  { content: pack },
);
check("a stored script tag is refused on read", !scripted.ok);

/* ── report ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`FAILED ${failures.length} of ${passed + failures.length}`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`codegen integration: ${passed} checks passed`);
