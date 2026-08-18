/**
 * The four things that were broken after the first production generations.
 *
 *   npx tsx --conditions=react-server scripts/post-generation-ux.test.mts
 *
 * Each section pins a defect that reached a real user, and every one of them
 * was silent — a white rectangle, a generic failure sentence, options that
 * looked like navigation, and a product that only ever offered to build a page.
 *
 * The preview and import-map sections run for real: the bundler and the
 * document builder are executed. The rest is source-level, because there is no
 * DOM here — and what regressed was which module renders what, which is exactly
 * what source can pin.
 *
 * Offline. No network, no provider, no database.
 */

import { readFileSync } from "node:fs";
import { isAllowedImport } from "../src/lib/v2/app/runtime";
import { getRuntimeBundle } from "../src/lib/v2/app/runtimeBundle";
import { buildSandboxDocument } from "../src/lib/v2/app/sandbox";
import { intakeGenerationBrief, PRODUCT_TYPE_OPTIONS, productTypesFor, INTAKE_DOMAINS } from "../src/lib/build/intake";

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
const buildScreen = read("src/components/workspace/BuildScreen.tsx");
const preOutput = read("src/components/build/PreOutputWorkspace.tsx");
const workspaceView = read("src/components/build/WorkspaceView.tsx");
const pipeline = read("src/lib/v2/app/pipeline.ts");
const publishing = read("src/lib/actions/publishing.ts");

/* ── 1. contextual choices belong to a message ───────────────────────────── */

/**
 * They used to render in a block after the entire conversation, which read as
 * navigation that happened to sit nearby. The test is structural: the options
 * must be inside the branch that renders one assistant turn.
 */
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
check("choices render in the strip attached to the composer",
  /\{showChoices && \(\s*<AskStrip/.test(createExperience));
check("directions render in that same strip",
  /\{showDirections && \(\s*<AskStrip/.test(createExperience));
check(
  "and staleness is structural rather than gated",
  !/isLatestAssistant/.test(createExperience),
  "the strip is built from the current turn, so there is no older turn to guard",
);
check(
  "no options block trails the conversation",
  !/<\/div>\s*\n\s*\{showChoices && \(/.test(createExperience),
  "the detached block is back",
);

// Nothing may time them out. A timer here is the specific behaviour asked
// against: options that vanish while someone is still reading them.
const optionsRegion = createExperience.slice(
  createExperience.indexOf("const showDirections"),
  createExperience.indexOf("function ChoiceGrid"),
);
check("no timer hides the options", !/setTimeout|setInterval/.test(code(optionsRegion)));

// They disappear on the three events that should end them.
check("selection ends them", /setSelectedDirection\(index\)/.test(createExperience));
check("sending a message ends them", /setTurn\(null\)/.test(createExperience));
check("a new turn replaces them", /setTurn\(result\.turn\)/.test(createExperience));

check("options stay compact chips", /className="s-chip"/.test(read("src/components/create/AskStrip.tsx")));
check("and never become columns", !/grid-cols-/.test(code(createExperience)));

/* ── 2. the preview cannot go white in silence ───────────────────────────── */

/**
 * THE CAUSE. The validator allows documented subpaths — `date-fns/locale` is
 * named in its own comment — but the bundle was built from the declared package
 * list, so the import map shipped without them. An unresolvable bare specifier
 * does not break one component: the module graph never loads, so the app's
 * first line never runs. Production showed a white rectangle, `data-ready`
 * false forever, and not one message posted.
 */
check("the validator allows the subpath", isAllowedImport("date-fns/locale"));

const bundle = await getRuntimeBundle(["date-fns", "date-fns/locale", "react"]);
check(
  "and the bundler now builds it",
  Object.keys(bundle.names).includes("date-fns/locale"),
  JSON.stringify(Object.keys(bundle.names)),
);
check("an import that is not allowed is still refused", !Object.keys(bundle.names).includes("node:fs"));

// The pipeline must build from what is really imported, never the declaration.
// It now takes that from the bundler's own resolver — the authoritative answer,
// and narrower than a source scan, which counted comments and dead branches.
check("the pipeline builds from the compiled graph", /compiled\.externals/.test(pipeline));
check("and never from the declaration", !/app\.runtime\.dependencies/.test(pipeline));
check("and still includes the template's own imports", /"react-dom\/client", "react\/jsx-runtime"/.test(pipeline));

/**
 * THE SILENCE. `ready` and `runtime-error` were posted by the app's own entry —
 * inside the module that can fail to load. The reporter now runs first, in its
 * own classic script, so a failure before the module has somewhere to go.
 */
const document = buildSandboxDocument({
  code: "console.log(1)", css: "", runtimeCore: "export const __libs = {};", runtimeNames: {},
  lang: "en", title: "t", assets: {}, nonce: undefined,
});
check("the reporter is in the document", document.includes("DidNotStart"));
check(
  "and runs before the app module",
  document.indexOf("DidNotStart") < document.indexOf('type="module"'),
  "the reporter loads after the thing it must watch",
);
check("it reports load errors", /addEventListener\("error"/.test(document));
check("and unhandled rejections", /addEventListener\("unhandledrejection"/.test(document));
check("and an app that never starts", /"DidNotStart"/.test(document));
check("using the same envelope the parser checks", /"ventrio-preview"/.test(document));

// The parent must actually be listening, or the reports go nowhere.
check("the workspace subscribes to runtime errors", /onRuntimeErrors=\{setRuntimeErrors\}/.test(preOutput));
check("and so does the built workspace", /onRuntimeErrors=\{setRuntimeErrors\}/.test(workspaceView));
check("the preview panel shows them", /runtimeErrors\.length > 0/.test(buildScreen));
check("with the app's own words", /runtimeErrors\.slice\(0, 3\)/.test(buildScreen));

/* ── 3. publishing an application ────────────────────────────────────────── */

/**
 * `project_publications.output` carried CHECK constraints describing a page
 * artifact — a `preset` from the four project types and a `form.fields` array.
 * An app payload has neither, so Postgres raised 23514, which is not the 23505
 * the insert loop retries on, and every publish returned the same sentence.
 */
const migration = read("supabase/migrations/20260813010000_publication_payload_shapes.sql");
check("the payload constraints are scoped by shape", /output ->> 'kind' = 'app'/.test(migration));
check("an app payload is not asked for a preset", /when output ->> 'kind' = 'app' then[\s\S]{0,200}jsonb_typeof\(output -> 'app'\)/.test(migration));
check(
  "the artifact keeps every rule it had",
  ["'preset' in", "form,fields", "'version' = '1'"].every((rule) => migration.includes(rule)),
);
check("size is per shape", /case when output ->> 'kind' = 'app' then 524288 else 131072 end/.test(migration));

// A failure that is not diagnosable is how this cost an investigation.
check("publish failures are logged", /logPublishFailure/.test(publishing));
check("with the database's own code", /code: error\?\.code/.test(publishing));
check("and no user content", !/output|payload/.test(publishing.slice(publishing.indexOf("function logPublishFailure"), publishing.indexOf("function invalidatePublication"))));

// Publishing stays in the toolbar, not the chat.
check("no publish control returned to the chat", (code(preOutput).match(/<PublicationControls/g) ?? []).length === 1);
check("and it is the toolbar slot", /publishControl=\{[\s\S]{0,200}<PublicationControls/.test(preOutput));

/* ── 4. Ventrio builds applications, not only pages ──────────────────────── */

check("Application exists as a product type", PRODUCT_TYPE_OPTIONS.some((o) => o.id === "type.application"));
for (const required of ["application", "dashboard", "tool", "store", "portfolio", "content", "landing"]) {
  check(`the ${required} category exists`, PRODUCT_TYPE_OPTIONS.some((o) => o.id === `type.${required}`));
}

// Primary means first, in every domain, not merely present.
for (const domain of INTAKE_DOMAINS) {
  const options = productTypesFor(domain);
  check(`${domain} offers Application first`, options[0]?.id === "type.application", options[0]?.id);
  check(`${domain} stays within 3-5 options`, options.length >= 3 && options.length <= 5, String(options.length));
}

// The old page-only vocabulary is gone.
// Comments explain what the page shapes were and why they went, so this reads
// the code rather than the prose about it.
const intake = code(read("src/lib/build/intake.ts"));
for (const stale of ["general.landing", "general.story", "general.showcase", "portfolio.showcase", "fandom.timeline"]) {
  check(`the ${stale} page shape is gone`, !intake.includes(stale));
}

/**
 * Routing, not renaming. `composeAppBrief` writes "The person asked for: X."
 * into the brief, and X used to be the storage key.
 */
// `intakeGenerationBrief` is the one place an id becomes words, and it runs
// before the action — so this is the sentence the generator actually receives.
for (const option of PRODUCT_TYPE_OPTIONS) {
  const brief = intakeGenerationBrief({ productType: option.id });
  check(`${option.id} reaches the generator as words`, typeof brief?.productType === "string" && brief.productType.length > 8, JSON.stringify(brief));
  check(`${option.id} is not passed as its storage key`, brief?.productType !== option.id);
}
check(
  "Application describes an application",
  /interactive application/.test(intakeGenerationBrief({ productType: "type.application" })?.productType ?? ""),
);
// A retired id contributes nothing rather than a stale phrase.
check("a retired page shape resolves to nothing", intakeGenerationBrief({ productType: "general.landing" }) === null);
// Design directions are untouched.
check("design directions still resolve", /editorial/.test(intakeGenerationBrief({ designDirection: "design.editorial" })?.designDirection ?? ""));

// Every label the options name must exist, in both languages.
const messages = { en: JSON.parse(read("messages/en.json")), ru: JSON.parse(read("messages/ru.json")) } as Record<string, { build: Record<string, string> }>;
for (const locale of ["en", "ru"]) {
  for (const option of PRODUCT_TYPE_OPTIONS) {
    check(`${locale}.${option.labelKey} exists`, typeof messages[locale].build[option.labelKey] === "string");
  }
}

if (failures.length > 0) {
  console.error(`post-generation-ux: ${failures.length} failed, ${passed} passed`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`post-generation-ux: ${passed} checks passed`);
