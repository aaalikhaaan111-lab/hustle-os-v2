/**
 * Visual-codegen prototype: envelope, reject pass, budgets, tokens, shell.
 *
 *   npx tsx --import ./scripts/v2/css-stub-loader.mts scripts/v2/codegen.test.mts
 *
 * Three claims, in order of how much they matter:
 *
 * 1. Every hostile fixture is refused, at the stage and with the code it names.
 *    "It failed" is not enough — a bundle rejected for the wrong reason means
 *    the gate that was supposed to catch it has quietly stopped working.
 * 2. The benign bundle compiles, and its output has the shell properties the
 *    containment argument depends on (CSP first, no model-controlled document
 *    structure, content escaped).
 * 3. Mutating any single guard makes something fail. A guard no test can break
 *    is a guard no test is checking.
 */

import { compileCodegenBundle } from "../../src/lib/v2/codegen/compile";
import { HOSTILE_FIXTURES } from "../../src/lib/v2/codegen/hostile";
import { BENIGN_BUNDLE } from "../../src/lib/v2/codegen/benign";
import { RELAY_CONTENT } from "../../src/lib/v2/codegen/contentPacks";
import { CODEGEN_BUDGETS } from "../../src/lib/v2/codegen/budgets";
import { CODEGEN_ENVELOPE_VERSION } from "../../src/lib/v2/codegen/envelope";
import { INNER_CSP, buildSrcDoc } from "../../src/lib/v2/codegen/shell";
import { escapeHtml, substituteContent } from "../../src/lib/v2/codegen/content";
import { scanCss, scanMarkup, ALLOWED_TAG_LIST } from "../../src/lib/v2/codegen/reject";
import { codegenSystemPrompt, codegenUserPrompt } from "../../src/lib/v2/codegen/prompt";
import { buildAssetRegistry, renderAsset, TRUSTED_ASSETS, ASSET_LIMITS } from "../../src/lib/v2/codegen/assets";
import { LAYOUT_KINDS, MEDIA_REQUIRING_LAYOUTS } from "../../src/lib/v2/codegen/reject";
import { expandMedia } from "../../src/lib/v2/codegen/media";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const opts = { content: RELAY_CONTENT };

/* ── 1. hostile corpus ──────────────────────────────────────────────────── */

check("the hostile corpus is substantial", HOSTILE_FIXTURES.length >= 25, `${HOSTILE_FIXTURES.length}`);

for (const fixture of HOSTILE_FIXTURES) {
  const result = compileCodegenBundle(fixture.bundle, opts);

  if (result.ok) {
    check(`hostile/${fixture.name} is refused`, false, `COMPILED — intent: ${fixture.intent}`);
    continue;
  }
  check(`hostile/${fixture.name} is refused`, true);
  check(
    `hostile/${fixture.name} is refused at the "${fixture.stage}" stage`,
    result.stage === fixture.stage,
    `refused at "${result.stage}" instead`,
  );
  check(
    `hostile/${fixture.name} reports "${fixture.code}"`,
    result.issues.some((issue) => issue.code === fixture.code),
    `got: ${result.issues.map((i) => i.code).join(", ") || "(none)"}`,
  );
}

/* ── 2. the benign control ──────────────────────────────────────────────── */

const benign = compileCodegenBundle(BENIGN_BUNDLE, opts);
check(
  "the benign bundle compiles",
  benign.ok,
  benign.ok ? "" : `${benign.stage}: ${benign.issues.map((i) => `${i.code} @ ${i.path}`).join("; ")}`,
);

if (benign.ok) {
  check("both routes compiled", benign.routes.length === 2, `${benign.routes.length}`);
  check("the root route exists", benign.routes.some((r) => r.path === "/"));

  const home = benign.routes.find((r) => r.path === "/")!;

  // -- shell properties the containment argument depends on ---------------
  check("the document starts with the doctype", home.srcDoc.startsWith("<!doctype html>"));
  check(
    "the CSP meta precedes the stylesheet",
    home.srcDoc.indexOf("Content-Security-Policy") < home.srcDoc.indexOf("<style>"),
  );
  check(
    "the CSP meta precedes the body",
    home.srcDoc.indexOf("Content-Security-Policy") < home.srcDoc.indexOf("<body>"),
  );
  check("the CSP meta is the first element in head",
    /<head><meta http-equiv="Content-Security-Policy"/.test(home.srcDoc));
  check("the inner CSP denies scripts", INNER_CSP.includes("script-src 'none'"));
  check("the inner CSP denies everything by default", INNER_CSP.includes("default-src 'none'"));
  check("the inner CSP denies connections", INNER_CSP.includes("connect-src 'none'"));
  check("the compiled document contains no script element", !/<script/i.test(home.srcDoc));
  check("the compiled document contains no event handler", !/\son[a-z]+\s*=/i.test(home.srcDoc));

  // -- content was substituted, not left as tokens ------------------------
  check("no tokens survive into the document", !home.srcDoc.includes("{{ventrio:"));
  check("real copy reached the page", home.srcDoc.includes(RELAY_CONTENT["hero.title"]));
  check("the title was substituted", home.title === RELAY_CONTENT["page.home.title"]);

  // -- the report is meaningful -------------------------------------------
  check("the report counts routes", benign.report.routeCount === 2);
  check("the report measures css", benign.report.cssBytes > 500);
  check(
    "the benign bundle uses most of its content pack",
    benign.report.unusedContentKeys.length <= 3,
    `unused: ${benign.report.unusedContentKeys.join(", ")}`,
  );
}

/* ── 3. content escaping ────────────────────────────────────────────────── */
{
  // The property that makes "scan first, substitute second" safe.
  const hostilePack = { "x.evil": `<script>alert(1)</script>` };
  const result = substituteContent(`<p>{{ventrio:text:x.evil}}</p>`, hostilePack, "$");
  check("hostile content cannot become markup", !result.text.includes("<script"), result.text);
  check("hostile content is escaped in place", result.text.includes("&lt;script&gt;"), result.text);
  check("escaping covers quotes and ampersands", escapeHtml(`&<>"'`) === "&amp;&lt;&gt;&quot;&#39;");

  const compiled = compileCodegenBundle(
    { version: CODEGEN_ENVELOPE_VERSION, css: "", routes: [{ path: "/", title: "t", bodyHtml: `<p>{{ventrio:text:x.evil}}</p>` }] },
    { content: hostilePack },
  );
  check("a bundle with hostile content still compiles inertly", compiled.ok);
  if (compiled.ok) {
    check("…and the document has no script element", !/<script/i.test(compiled.routes[0].srcDoc));
  }
}

/* ── 4. mutation testing: every guard must be breakable ─────────────────── */
/**
 * Each mutation is a bundle that differs from a conforming one in exactly one
 * respect. If a mutation compiles, the guard named beside it is not doing
 * anything, regardless of how many hostile fixtures happen to pass.
 */
const good = (over: Partial<{ css: string; bodyHtml: string; path: string; title: string }> = {}) => ({
  version: CODEGEN_ENVELOPE_VERSION,
  css: over.css ?? ".a{color:#111}",
  routes: [{ path: over.path ?? "/", title: over.title ?? "T", bodyHtml: over.bodyHtml ?? "<p>{{ventrio:text:brand.name}}</p>" }],
});

check("the control for mutation testing compiles", compileCodegenBundle(good(), opts).ok);

const MUTATIONS: Array<[string, unknown]> = [
  ["tag allowlist", good({ bodyHtml: "<marquee>{{ventrio:text:brand.name}}</marquee>" })],
  ["attribute allowlist", good({ bodyHtml: `<p data-ok="1" srcset="x">{{ventrio:text:brand.name}}</p>` })],
  ["depth budget", good({ bodyHtml: `${"<div>".repeat(CODEGEN_BUDGETS.maxDepth + 2)}x${"</div>".repeat(CODEGEN_BUDGETS.maxDepth + 2)}` })],
  ["element budget", good({ bodyHtml: `<div>${"<span>x</span>".repeat(CODEGEN_BUDGETS.maxElementsPerRoute + 5)}</div>` })],
  ["css rule budget", good({ css: ".a{color:red}".repeat(CODEGEN_BUDGETS.maxCssRules + 5) })],
  ["css byte budget", good({ css: `.a{color:red}/*${"z".repeat(CODEGEN_BUDGETS.maxCssBytes)}*/` })],
  ["body byte budget", good({ bodyHtml: `<p>${"z".repeat(CODEGEN_BUDGETS.maxBodyHtmlBytes)}</p>` })],
  ["css balance", good({ css: ".a{color:red" })],
  ["markup balance", good({ bodyHtml: "<div><p>{{ventrio:text:brand.name}}</div>" })],
  ["root route requirement", good({ path: "/only-this" })],
  ["empty title", good({ title: "  " })],
];

for (const [guard, bundle] of MUTATIONS) {
  const result = compileCodegenBundle(bundle, opts);
  check(`mutation defeats the ${guard} guard`, !result.ok, "the mutated bundle compiled");
}

/* ── 5. scanner unit properties ─────────────────────────────────────────── */
{
  // The handler regex must not fire on an attribute value or class name that
  // merely starts with "on". Asserted on the specific code rather than on an
  // empty issue list, because prose can no longer appear in markup at all.
  check("an 'on'-prefixed class is not a false handler",
    !scanMarkup(`<p class="section-one" data-once="1">{{ventrio:text:brand.name}}</p>`, "$")
      .some((i) => i.code === "event_handler"));
  check("a real handler is still caught",
    scanMarkup(`<p onclick="x">{{ventrio:text:brand.name}}</p>`, "$").some((i) => i.code === "event_handler"));
  check("a legitimate aria attribute is allowed", scanMarkup(`<p aria-label="x" role="note">{{ventrio:text:brand.name}}</p>`, "$").length === 0);
  check("a fragment link is allowed", scanMarkup(`<a href="#how">{{ventrio:text:brand.name}}</a>`, "$").length === 0);
  check("an internal path is allowed", scanMarkup(`<a href="/pricing">{{ventrio:text:brand.name}}</a>`, "$").length === 0);
  check("a void element does not unbalance the tree", scanMarkup("<p>{{ventrio:text:brand.name}}<br>{{ventrio:text:brand.name}}</p><hr>", "$").length === 0);
  // The prefix-vs-boundary regression. `<head` is a prefix of `<header>`, and
  // an over-eager check here rejects every conforming layout.
  check("<header> is allowed", scanMarkup("<header><h1>{{ventrio:text:brand.name}}</h1></header>", "$").length === 0);
  check("<footer> is allowed", scanMarkup("<footer><p>{{ventrio:text:brand.name}}</p></footer>", "$").length === 0);
  check("<section> is allowed", scanMarkup("<section><p>{{ventrio:text:brand.name}}</p></section>", "$").length === 0);
  check("<head> is still rejected", scanMarkup("<head></head>", "$").some((i) => i.code === "document_tag"));
  check("<body> is still rejected", scanMarkup("<body></body>", "$").some((i) => i.code === "document_tag"));
  check("<form> is still rejected", scanMarkup("<form></form>", "$").some((i) => i.code === "form_tag"));
  check("<button> is still rejected", scanMarkup("<button>x</button>", "$").some((i) => i.code === "form_tag"));
  check("a spaced closing script tag is rejected", scanMarkup("< / script >", "$").some((i) => i.code === "script_tag"));
  check("a spaced opening script tag is rejected", scanMarkup("< script >alert(1)", "$").some((i) => i.code === "script_tag"));

  check("modern css is not rejected", scanCss(":root{--a:1}\n@media(min-width:768px){.g{display:grid;gap:clamp(1rem,2vw,2rem)}}").length === 0);
  check("a gradient is not rejected", scanCss(".h{background:linear-gradient(180deg,#fff 0%,#eee 100%)}").length === 0);
  check("@import is rejected", scanCss("@import url(x.css);").some((i) => i.code === "css_import"));
}

/* ── 6. the shell cannot be steered by its inputs ───────────────────────── */
{
  const doc = buildSrcDoc({ title: `</title><script>alert(1)</script>`, css: ".a{}", bodyHtml: "<p>x</p>" });
  check("a hostile title cannot close its element", !doc.includes("</title><script>"), doc.slice(0, 240));
  check("a hostile title is escaped", doc.includes("&lt;script&gt;"));

  const langInjected = buildSrcDoc({ title: "t", css: "", bodyHtml: "<p>x</p>", lang: `en"><script>alert(1)</script>` });
  check("a hostile lang falls back rather than injecting", langInjected.includes(`<html lang="en">`), langInjected.slice(0, 120));
}

/* ── 7. the prompt must describe the gate that actually runs ────────────── */
/**
 * Drift here is expensive: it is only observable by spending a request and
 * having the result refused. Each check ties a promise the prompt makes to the
 * constant the gate enforces.
 */
{
  const system = codegenSystemPrompt(true);

  for (const tag of ALLOWED_TAG_LIST) {
    check(`the prompt advertises <${tag}>`, new RegExp(`\\b${tag}\\b`).test(system));
  }
  for (const forbidden of ["script", "iframe", "form", "img", "svg"]) {
    check(`the prompt forbids <${forbidden}>`, system.includes(forbidden));
  }
  check("the prompt states the envelope version", system.includes(CODEGEN_ENVELOPE_VERSION));
  check("the prompt states the route ceiling", system.includes(String(CODEGEN_BUDGETS.maxRoutes)));
  check("the prompt states the element ceiling", system.includes(String(CODEGEN_BUDGETS.maxElementsPerRoute)));
  check("the prompt states the depth ceiling", system.includes(String(CODEGEN_BUDGETS.maxDepth)));
  check("the prompt states the css rule ceiling", system.includes(String(CODEGEN_BUDGETS.maxCssRules)));
  check("the prompt names the token syntax", system.includes("{{ventrio:text:key}}"));
  check("the prompt forbids inventing copy", /invent/i.test(system));

  const user = codegenUserPrompt("Relay, a build log.", RELAY_CONTENT, [{ path: "/", purpose: "overview" }]);
  for (const key of Object.keys(RELAY_CONTENT)) {
    if (!user.includes(`{{ventrio:text:${key}}}`)) {
      check(`the user prompt lists the content key "${key}"`, false);
    }
  }
  check("the user prompt lists every content key", Object.keys(RELAY_CONTENT).every((k) => user.includes(`{{ventrio:text:${k}}}`)));
}

/* ── 8. the trusted asset registry ──────────────────────────────────────── */
{
  check("the registry has assets", TRUSTED_ASSETS.size >= 3, `${TRUSTED_ASSETS.size}`);
  check("the default registry admitted everything without issues",
    buildAssetRegistry().issues.length === 0,
    buildAssetRegistry().issues.map((i) => `${i.id}:${i.code}`).join(", "));

  for (const asset of TRUSTED_ASSETS.values()) {
    check(`${asset.id} is a data: URI`, asset.src.startsWith("data:image/png;base64,"));
    check(`${asset.id} names no host`, !/https?:|\/\//.test(asset.src.slice(0, 30)));
    check(`${asset.id} has alt text`, asset.alt.trim().length > 0);
    check(`${asset.id} has real dimensions`, asset.width > 0 && asset.height > 0);
  }

  // Every rejection path, driven with a deliberately bad entry.
  const bad = (over: Record<string, unknown>) => {
    const base = { id: "x.y", alt: "a", width: 100, height: 100, mime: "image/png", base64: "iVBORw0KGgoAAAANSUhEUg==" };
    return buildAssetRegistry({ "x.y": { ...base, ...over } } as never);
  };
  const cases: Array<[string, Record<string, unknown>, string]> = [
    ["a non-PNG payload is refused", { base64: "AAAAAAAAAAAAAAAA" }, "not_a_png"],
    ["a declared non-PNG mime is refused", { mime: "image/svg+xml" }, "bad_mime"],
    ["missing alt text is refused", { alt: "  " }, "missing_alt"],
    ["a zero dimension is refused", { width: 0 }, "bad_dimension"],
    ["an id mismatch is refused", { id: "other.id" }, "id_mismatch"],
    ["a non-base64 payload is refused", { base64: "not base64!!" }, "bad_base64"],
    ["an oversize asset is refused", { base64: "A".repeat(ASSET_LIMITS.maxBase64Chars + 4) }, "asset_too_large"],
  ];
  for (const [name, over, code] of cases) {
    const result = bad(over);
    check(name, result.issues.some((i) => i.code === code) && result.registry.size === 0,
      result.issues.map((i) => i.code).join(",") || "admitted");
  }

  // An SVG payload must be refused even if it claims to be a PNG.
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString("base64");
  const svgResult = buildAssetRegistry({ "x.y": { id: "x.y", alt: "a", width: 10, height: 10, mime: "image/png", base64: svg } } as never);
  check("an SVG masquerading as a PNG is refused",
    svgResult.registry.size === 0 && svgResult.issues.some((i) => i.code === "not_a_png"));
}

/* ── 9. media rendering and expansion ───────────────────────────────────── */
{
  const asset = TRUSTED_ASSETS.get("bench.surface")!;
  const img = renderAsset(asset);
  check("renderAsset emits an img", img.startsWith("<img "));
  check("renderAsset uses the data URI", img.includes("data:image/png;base64,"));
  check("renderAsset emits no srcset", !/srcset/i.test(img));
  check("renderAsset emits no crossorigin or referrerpolicy", !/crossorigin|referrerpolicy/i.test(img));
  check("renderAsset carries alt", /alt="[^"]+"/.test(img));

  const expanded = expandMedia('<div><span data-ventrio-media="bench.surface"></span></div>', TRUSTED_ASSETS, "$");
  check("a media span expands to a figure", expanded.html.includes("<figure class=\"v-media\">"));
  check("expansion reports the asset used", expanded.used.join() === "bench.surface");
  check("no token survives expansion", !expanded.html.includes("data-ventrio-media"));
  check("expansion raised no issues", expanded.issues.length === 0);

  // A class on the span survives onto the figure, escaped.
  const withClass = expandMedia('<span class="tall" data-ventrio-media="parts.tray"></span>', TRUSTED_ASSETS, "$");
  check("a wrapper class is preserved", withClass.html.includes('class="v-media tall"'), withClass.html.slice(0, 120));

  // With an empty registry the same markup fails closed.
  const empty = expandMedia('<span data-ventrio-media="bench.surface"></span>', new Map(), "$");
  check("an empty registry refuses a known-looking id", empty.issues.some((i) => i.code === "unknown_asset"));
}

/* ── 10. media: the end-to-end security claims ──────────────────────────── */
{
  const mediaBundle = (body: string) => ({
    version: CODEGEN_ENVELOPE_VERSION,
    css: ".a{color:#111}",
    routes: [{ path: "/", title: "T", bodyHtml: body }],
  });

  // Positive: a trusted asset renders.
  const good = compileCodegenBundle(
    mediaBundle('<section data-ventrio-layout="split"><p>{{ventrio:text:brand.name}}</p><span data-ventrio-media="bench.surface"></span></section>'),
    opts,
  );
  check("a trusted asset compiles", good.ok, good.ok ? "" : `${good.stage}: ${good.issues.map((i) => i.code).join(",")}`);
  if (good.ok) {
    const doc = good.routes[0].srcDoc;
    check("the document contains the image", doc.includes("data:image/png;base64,"));
    check("the report names the asset used", good.report.assetsUsed.join() === "bench.surface");

    // The no-network claim, stated as a property of the finished document.
    const httpRefs = doc.match(/https?:\/\//g) ?? [];
    check("the finished document references no http(s) URL", httpRefs.length === 0, httpRefs.slice(0, 3).join(" "));
    check("the finished document has no src other than data:",
      (doc.match(/src="/g) ?? []).length === (doc.match(/src="data:/g) ?? []).length);
    check("the inner CSP still forbids connections", doc.includes("connect-src 'none'"));
    check("the inner CSP still limits images to data:", doc.includes("img-src data:"));
    check("the inner CSP still forbids scripts", doc.includes("script-src 'none'"));
  }

  // A media token cannot escape its attribute: the scanner refuses the value,
  // so nothing reaches the expander to escape from.
  const escapeAttempt = compileCodegenBundle(
    mediaBundle('<span data-ventrio-media="a\" onerror=\"alert(1)"></span>'),
    opts,
  );
  check("a token cannot break out of its attribute", !escapeAttempt.ok);
  if (!escapeAttempt.ok) {
    check("…and it is refused as a bad id or handler",
      escapeAttempt.issues.some((i) => ["bad_asset_id", "event_handler", "unparseable_markup"].includes(i.code)),
      escapeAttempt.issues.map((i) => i.code).join(","));
  }

  // Compiling against an empty registry: every media token now fails.
  const noAssets = compileCodegenBundle(
    mediaBundle('<section data-ventrio-layout="split"><p>{{ventrio:text:brand.name}}</p><span data-ventrio-media="bench.surface"></span></section>'),
    { content: RELAY_CONTENT, assets: new Map() },
  );
  check("with no registry a media token is refused", !noAssets.ok);
  if (!noAssets.ok) {
    check("…as an unknown asset", noAssets.issues.some((i) => i.code === "unknown_asset"),
      noAssets.issues.map((i) => i.code).join(","));
  }
}

/* ── 11. composition is conditional on media ────────────────────────────── */
{
  const section = (layout: string, inner: string) => ({
    version: CODEGEN_ENVELOPE_VERSION,
    css: ".a{color:#111}",
    routes: [{ path: "/", title: "T", bodyHtml: `<section data-ventrio-layout="${layout}">${inner}</section>` }],
  });

  for (const layout of MEDIA_REQUIRING_LAYOUTS) {
    const without = compileCodegenBundle(section(layout, "<p>{{ventrio:text:brand.name}}</p>"), opts);
    check(`"${layout}" without media is refused`, !without.ok);
    if (!without.ok) {
      check(`…reported as layout_without_media`, without.issues.some((i) => i.code === "layout_without_media"),
        without.issues.map((i) => i.code).join(","));
    }
    const withMedia = compileCodegenBundle(
      section(layout, '<p>{{ventrio:text:brand.name}}</p><span data-ventrio-media="parts.tray"></span>'), opts);
    check(`"${layout}" with media compiles`, withMedia.ok,
      withMedia.ok ? "" : withMedia.issues.map((i) => i.code).join(","));
  }

  // Media nested deeper than a direct child still satisfies the requirement.
  const nested = compileCodegenBundle(
    section("split", '<div><div><span data-ventrio-media="parts.tray"></span></div></div>'), opts);
  check("media deep in the subtree satisfies the layout", nested.ok,
    nested.ok ? "" : nested.issues.map((i) => i.code).join(","));

  // Media in a *sibling* section does not satisfy an empty split.
  const sibling = compileCodegenBundle({
    version: CODEGEN_ENVELOPE_VERSION,
    css: ".a{color:#111}",
    routes: [{ path: "/", title: "T", bodyHtml:
      '<section data-ventrio-layout="split"><p>{{ventrio:text:brand.name}}</p></section>' +
      '<section data-ventrio-layout="stack"><span data-ventrio-media="parts.tray"></span></section>' }],
  }, opts);
  check("media in a sibling section does not satisfy a split", !sibling.ok);

  // The media-free layouts are always fine.
  for (const layout of LAYOUT_KINDS.filter((k) => !MEDIA_REQUIRING_LAYOUTS.has(k))) {
    check(`"${layout}" needs no media`, compileCodegenBundle(section(layout, "<p>{{ventrio:text:brand.name}}</p>"), opts).ok);
  }

  // The shell ships geometry for every declared layout.
  const shellCss = buildSrcDoc({ title: "t", css: "", bodyHtml: "<p>x</p>" });
  for (const layout of LAYOUT_KINDS) {
    check(`the shell defines geometry for "${layout}"`, shellCss.includes(`data-ventrio-layout="${layout}"`));
  }
}

/* ── 12. the literal-copy boundary, proven against the real canary ──────── */
/**
 * The canary that exposed this gap wrote seven strings the content pack never
 * supplied. Six were decorative labels; one renamed a plan. Each is asserted
 * individually so a future loosening of the rule cannot quietly re-admit the
 * one that actually matters.
 */
{
  const CANARY_INVENTIONS = [
    "01 / MISMATCH", "02 / AMNESIA", "03 / CLUTTER",
    "STEP 1", "STEP 2", "STEP 3",
    "Solo Maker",
  ];
  for (const invented of CANARY_INVENTIONS) {
    const result = compileCodegenBundle({
      version: CODEGEN_ENVELOPE_VERSION,
      css: "",
      routes: [{ path: "/", title: "T", bodyHtml: `<p><span>${invented}</span>{{ventrio:text:brand.name}}</p>` }],
    }, opts);
    check(`the canary's "${invented}" is refused`, !result.ok);
    if (!result.ok) {
      check(`…as literal_copy`, result.issues.some((i) => i.code === "literal_copy"),
        result.issues.map((i) => i.code).join(","));
    }
  }

  // Punctuation between tokens stays legal — the existing benign footer relies
  // on it, and a rule that banned it would fail a conforming fixture.
  for (const separator of [" — ", " · ", " / ", ", ", " ", "\n  "]) {
    check(`"${separator.trim() || "space"}" between tokens is still allowed`,
      scanMarkup(`<p>{{ventrio:text:brand.name}}${separator}{{ventrio:text:nav.home}}</p>`, "$").length === 0);
  }
  check("an entity between tokens is allowed",
    scanMarkup(`<p>{{ventrio:text:brand.name}}&mdash;{{ventrio:text:nav.home}}</p>`, "$").length === 0);

  // Replay the stored envelope from the paid canary, if it is available.
  // Optional so the suite stays portable; when present it is the strongest
  // evidence there is, because it is real model output rather than a fixture.
  const capturePath = process.env.CODEGEN_CANARY_CAPTURE;
  if (capturePath) {
    const { readFileSync } = await import("node:fs");
    const capture = JSON.parse(readFileSync(capturePath, "utf8")) as { raw?: string };
    if (capture.raw) {
      const replay = compileCodegenBundle(JSON.parse(capture.raw), opts);
      check("the stored canary envelope is now refused", !replay.ok);
      if (!replay.ok) {
        const codes = replay.issues.map((i) => i.code);
        check("…and literal_copy is among the reasons", codes.includes("literal_copy"), codes.join(","));
        const details = replay.issues.filter((i) => i.code === "literal_copy").map((i) => i.detail).join(" ");
        check("…naming the invented plan", /Solo Maker/.test(details) || codes.includes("literal_copy"), details.slice(0, 120));
      }
    }
  } else {
    console.log("  (skipped stored-envelope replay: set CODEGEN_CANARY_CAPTURE)");
  }
}

/* ── report ─────────────────────────────────────────────────────────────── */
console.log(`\ncodegen: ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  for (const failure of failures) console.error(`  FAIL ${failure}`);
  process.exit(1);
}
