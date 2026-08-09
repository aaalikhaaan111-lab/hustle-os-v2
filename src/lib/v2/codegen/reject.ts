/**
 * The reject pass: defence in depth, and explicitly NOT sanitisation.
 *
 * ── What actually contains this content ────────────────────────────────────
 *
 * The security boundary is the sandbox. Generated markup is mounted into an
 * `<iframe sandbox="" srcdoc>`, which gives it an opaque origin, no scripts, no
 * same-origin access, no forms and no top-level navigation, and the document
 * shell additionally carries `default-src 'none'; script-src 'none'`. Markup
 * that got past every rule in this file would still be inert, because nothing
 * in that frame can execute or reach the network.
 *
 * ── What this file is for ──────────────────────────────────────────────────
 *
 * It refuses bundles that have no business rendering at all: a model emitting
 * `<script>`, an `onclick`, a `javascript:` href or an `@import` is a model
 * that has misunderstood the task, and shipping that to a preview — even a
 * preview that would neutralise it — hides the defect. So this is a
 * *conformance* gate whose failures are signal, layered behind a containment
 * boundary that does the actual security work.
 *
 * ── What this file is NOT ──────────────────────────────────────────────────
 *
 * It does not make untrusted markup safe, and its results must never be
 * described as sanitised or as production-safe. It is built from string
 * scanning and a hand-rolled tag walker, not a parser. HTML tokenisation has
 * many constructs this deliberately refuses rather than models — comments,
 * CDATA, foreign content, malformed attribute quoting, `<![if]>` — and a
 * scanner that refuses what it cannot parse is honest, whereas a scanner that
 * *transforms* what it cannot parse is a vulnerability with a friendly name.
 * That is precisely why nothing here rewrites its input: every rule either
 * accepts a string unchanged or rejects the bundle.
 *
 * Promoting any of this beyond a local prototype requires declared parser
 * dependencies — parse5 (or equivalent spec-compliant HTML parser) and
 * css-tree (or equivalent CSS parser) — so that structure is decided by a
 * parser rather than inferred by regular expressions. Neither is currently a
 * dependency of this repository. Until they are, this path stays behind the
 * development-only gallery route.
 */

import { CODEGEN_BUDGETS } from "./budgets";
import { parseCssIssues, parseMarkupIssues } from "./parse";

export interface RejectIssue {
  path: string;
  code: string;
  detail: string;
}

/* ────────────────────────────── allowlists ─────────────────────────────── */

/**
 * Structural and textual elements only.
 *
 * Absent on purpose: script, style, link, meta, base, iframe, object, embed,
 * applet, form, input, textarea, select, button, svg, math, template, slot,
 * frame, frameset, portal, audio, video, source, track, canvas, dialog.
 *
 * `img` is absent and stays absent, even though pages can now show pictures.
 * A model never writes an image element: it writes
 * `<span data-ventrio-media="asset.id"></span>`, and the compiler replaces
 * that span with an `<img>` it builds itself from the trusted registry (see
 * assets.ts). Because the model cannot emit the element, it cannot emit a
 * `src`, a `srcset`, or any other attribute that could name a second source —
 * the absence of `img` here is what makes the media path safe by construction
 * rather than by filtering.
 */
const ALLOWED_TAGS = new Set([
  "div", "section", "article", "header", "footer", "main", "nav", "aside",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "span", "a", "strong", "em", "b", "i", "u", "s", "small", "mark",
  "sub", "sup", "code", "pre", "kbd", "samp", "abbr", "cite", "q", "time",
  "ul", "ol", "li", "dl", "dt", "dd",
  "blockquote", "figure", "figcaption", "hr", "br", "wbr",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
  "address", "details", "summary", "picture",
]);

/**
 * The same set, ordered, for the prompt.
 *
 * Exported so the prompt is generated from the gate's own constant rather than
 * from a second hand-maintained list: a prompt that advertises an element the
 * scanner refuses costs a paid request to discover.
 */
export const ALLOWED_TAG_LIST: readonly string[] = [...ALLOWED_TAGS].sort();

/**
 * The same constants, shared with the parser pass in parse.ts.
 *
 * Exported rather than duplicated: two allowlists that drift apart would let
 * one gate accept what the other refuses, and the disagreement would show up
 * as a confusing rejection rather than as the bug it is.
 */
export const PARSER_ALLOWLISTS = {
  get allowedTags() { return ALLOWED_TAGS as ReadonlySet<string>; },
  get allowedAttrs() { return ALLOWED_ATTRS as ReadonlySet<string>; },
  get allowedAttrPrefixes() { return ALLOWED_ATTR_PREFIXES as readonly string[]; },
  get voidTags() { return VOID_TAGS as ReadonlySet<string>; },
};

/** Elements with no closing tag; the depth walker must not push these. */
const VOID_TAGS = new Set(["br", "hr", "wbr", "col"]);

const ALLOWED_ATTRS = new Set([
  "class", "id", "role", "lang", "dir", "title", "href", "alt",
  "colspan", "rowspan", "scope", "datetime", "open", "cite",
]);

/** Any attribute matching one of these is allowed beyond the exact list. */
const ALLOWED_ATTR_PREFIXES = ["aria-", "data-"];

/**
 * `data-ventrio-*` is a reserved namespace.
 *
 * `data-*` is otherwise open, which is fine for decorative hooks — but these
 * two attributes are instructions to the compiler, not inert metadata. If the
 * namespace were open, a future attribute name would silently become
 * model-controllable the moment the compiler started reading it. Anything in
 * the namespace that is not on this list is refused now.
 */
const RESERVED_ATTRS = new Set(["data-ventrio-media", "data-ventrio-layout", "data-ventrio-flip"]);

/**
 * The composition vocabulary.
 *
 * These name intentions, not CSS. The shell ships the geometry for each (see
 * shell.ts), so a bundle gets asymmetry, overlap and persistent columns
 * without the model needing any capability it does not already have — and
 * without the layout depending on the model getting a grid declaration right.
 */
export const LAYOUT_KINDS = [
  "stack",    // single column, full measure — the honest default
  "split",    // asymmetric two-column: copy against media
  "offset",   // copy inset, deliberately off-centre, no second column
  "overlap",  // media and a copy panel that overlap along one edge
  "rail",     // a persistent narrow column beside a wide one
  "mosaic",   // uneven media grid
  "bleed",    // full-bleed media band with copy over it
] as const;
export type LayoutKind = (typeof LAYOUT_KINDS)[number];

/**
 * Layouts whose whole point is a visual element.
 *
 * This is the structural answer to a hero that reserves an empty column: the
 * first canary produced a 1440 hero with 45% of its width holding nothing,
 * because the layout implied media that did not exist. Prompt guidance would
 * make that less likely; this makes it impossible. Declare one of these
 * without a media token inside it and the bundle is refused.
 */
export const MEDIA_REQUIRING_LAYOUTS: ReadonlySet<string> = new Set(["split", "overlap", "mosaic", "bleed"]);

const LAYOUT_SET: ReadonlySet<string> = new Set(LAYOUT_KINDS);

/**
 * Words on the page must come from the content pack.
 *
 * The token mechanism guarantees that a *resolved* token carries application
 * copy. It never stopped the model typing words next to one, and a canary
 * proved that gap is real rather than theoretical: alongside correct tokens it
 * wrote "01 / MISMATCH", "STEP 1", and — the one that matters — "Solo Maker",
 * renaming a plan the content pack calls "Maker". Inventing product
 * nomenclature is exactly what the boundary existed to prevent, so the rule is
 * now enforced here instead of being asked for in the prompt.
 *
 * The test is "does this run of text contain a letter or a digit". Words are
 * content; punctuation is typography. That keeps legitimate separators between
 * tokens legal — `{{a}} — {{b}}`, a middot, a slash — while catching anything
 * that reads as language.
 *
 * KNOWN GAPS, deliberately not closed in this pass. Text can still reach a
 * page through an attribute the allowlist permits (`title`, `aria-label`,
 * `alt`) and through CSS `content:`. Both are narrower channels than a text
 * node and neither appeared in the canary; closing them means auditing every
 * allowlisted attribute and parsing declaration values, which is more than
 * this correction should carry.
 */
const TOKEN_RUN = /\{\{ventrio:text:[a-z0-9][a-z0-9._-]{0,63}\}\}/g;
const HAS_WORD = /[\p{L}\p{N}]/u;

/**
 * Checks one run of text between tags for model-authored words.
 *
 * Tokens are removed first, then HTML entities, so `&amp;` and `&#8212;` are
 * not mistaken for content. What remains is literal, and if any of it is a
 * letter or digit the bundle is refused.
 */
function literalTextIssues(text: string, at: string): RejectIssue[] {
  const residue = text.replace(TOKEN_RUN, " ").replace(/&[a-zA-Z]+;|&#[0-9]+;/g, " ");
  if (!HAS_WORD.test(residue)) return [];
  const sample = residue.trim().replace(/\s+/g, " ").slice(0, 60);
  return [{
    path: at,
    code: "literal_copy",
    detail: `Text "${sample}" is not from the content pack. Every word must be a {{ventrio:text:key}} token.`,
  }];
}

/* ─────────────────────────── markup scanning ───────────────────────────── */

/**
 * Tag names that must not appear, matched at a tag boundary.
 *
 * Boundary-matched rather than by prefix because `<head` is a prefix of
 * `<header>`, and `<header>` is one of the most useful elements in the
 * allowlist. A prefix check here rejected every conforming layout the prompt
 * asks for — caught by the benign control fixture, which is exactly what that
 * fixture is for.
 */
const FORBIDDEN_TAGS: ReadonlyArray<[string, string]> = [
  ["script", "script_tag"],
  ["style", "style_tag"],
  ["iframe", "frame_tag"],
  ["frame", "frame_tag"],
  ["frameset", "frame_tag"],
  ["object", "object_tag"],
  ["embed", "embed_tag"],
  ["applet", "object_tag"],
  ["link", "link_tag"],
  ["meta", "meta_tag"],
  ["base", "base_tag"],
  ["form", "form_tag"],
  ["input", "form_tag"],
  ["textarea", "form_tag"],
  ["select", "form_tag"],
  ["button", "form_tag"],
  ["svg", "svg_tag"],
  ["math", "math_tag"],
  ["template", "template_tag"],
  ["slot", "template_tag"],
  ["html", "document_tag"],
  ["head", "document_tag"],
  ["body", "document_tag"],
  ["canvas", "canvas_tag"],
  ["audio", "media_tag"],
  ["video", "media_tag"],
  ["portal", "frame_tag"],
];

/** Raw substrings that are never legitimate, regardless of tag structure. */
const FORBIDDEN_HTML_SUBSTRINGS: ReadonlyArray<[string, string]> = [
  ["<!doctype", "doctype"],
  ["<!--", "comment"],
  ["<![", "cdata"],
  ["javascript:", "js_url"],
  ["vbscript:", "js_url"],
  ["srcdoc", "srcdoc"],
];

/**
 * Scans one route's markup.
 *
 * Order matters: cheap whole-string refusals run before the tag walk, so a
 * bundle containing `<script>` is reported as `script_tag` rather than as
 * whatever the walker happens to trip over first.
 */
export interface ScanOptions {
  /** Ids the registry will resolve. An unknown id is refused at scan time. */
  assetIds?: ReadonlySet<string>;
}

/**
 * Both gates, merged.
 *
 * parse5 decides structure; the scanner below is a second, independently
 * written opinion that refuses constructs it cannot model rather than guessing
 * at them. Both run in full and their issues are combined — an earlier attempt
 * seeded the scanner's list with the parser's findings, which silently tripped
 * the scanner's own `if (issues.length > 0) return` short-circuit and skipped
 * its tag walker entirely. Two gates only help if both actually run.
 */
export function scanMarkup(bodyHtml: string, at: string, options: ScanOptions = {}): RejectIssue[] {
  const parserIssues = parseMarkupIssues(bodyHtml, at, PARSER_ALLOWLISTS);
  const scannerIssues = scanMarkupByScanner(bodyHtml, at, options);
  return [...parserIssues, ...scannerIssues].slice(0, 40);
}

function scanMarkupByScanner(bodyHtml: string, at: string, options: ScanOptions = {}): RejectIssue[] {
  const issues: RejectIssue[] = [];
  const lower = bodyHtml.toLowerCase();

  for (const [needle, code] of FORBIDDEN_HTML_SUBSTRINGS) {
    if (lower.includes(needle)) {
      issues.push({ path: at, code, detail: `Markup contains "${needle}", which is not permitted.` });
    }
  }

  // Opening or closing, with any whitespace the parser would tolerate between
  // the bracket and the name, and terminated at a real tag-name boundary.
  for (const [tag, code] of FORBIDDEN_TAGS) {
    const pattern = new RegExp(`<\\s*/?\\s*${tag}(?=[\\s/>]|$)`, "i");
    if (pattern.test(bodyHtml)) {
      issues.push({ path: at, code, detail: `<${tag}> is not permitted.` });
    }
  }

  // Event handlers. Matched on the attribute position (whitespace, then `on…`,
  // then `=`) so that prose like "on Monday" is not a false positive.
  const handler = /[\s"'/]on[a-z]+\s*=/gi;
  let handlerMatch: RegExpExecArray | null;
  while ((handlerMatch = handler.exec(bodyHtml)) !== null) {
    issues.push({
      path: at,
      code: "event_handler",
      detail: `Inline event handler "${handlerMatch[0].trim()}" is not permitted.`,
    });
    if (issues.length > 40) break;
  }

  if (issues.length > 0) return issues.slice(0, 40);

  return walkTags(bodyHtml, at, options);
}

/**
 * Hand-rolled tag walker.
 *
 * NOT an HTML parser. It recognises exactly the tag grammar this pipeline
 * permits — `<name attrs>`, `</name>`, `<name attrs/>` — and rejects anything
 * else outright, including the constructs a real parser would accept. See the
 * module header: refusing what it cannot model is the point.
 */
function walkTags(bodyHtml: string, at: string, options: ScanOptions): RejectIssue[] {
  const issues: RejectIssue[] = [];
  const stack: string[] = [];
  let elements = 0;
  let maxDepth = 0;

  /**
   * Open elements that declared a media-requiring layout.
   *
   * `satisfied` flips when a media token appears anywhere inside, and is
   * checked when the element closes — so the requirement is about the subtree,
   * not about the immediate children.
   */
  const openLayouts: Array<{ depth: number; kind: string; satisfied: boolean }> = [];

  // Matches a tag and captures name plus the raw attribute region.
  const tagPattern = /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  let match: RegExpExecArray | null;
  let consumed = 0;

  while ((match = tagPattern.exec(bodyHtml)) !== null) {
    const [raw, closing, rawName, attrRegion] = match;
    const name = rawName.toLowerCase();

    // Any `<` that did not begin a tag we recognise is a refusal, not text.
    const gap = bodyHtml.slice(consumed, match.index);
    if (gap.includes("<")) {
      issues.push({ path: at, code: "unparseable_markup", detail: "Found a '<' that does not begin a permitted tag." });
      break;
    }
    issues.push(...literalTextIssues(gap, at));
    consumed = match.index + raw.length;

    if (!ALLOWED_TAGS.has(name)) {
      issues.push({ path: at, code: "tag_not_allowed", detail: `<${name}> is not in the permitted element set.` });
      if (issues.length > 40) break;
      continue;
    }

    if (closing) {
      const expected = stack.pop();
      if (expected !== name) {
        issues.push({
          path: at,
          code: "unbalanced_tag",
          detail: `</${name}> closes ${expected ? `<${expected}>` : "nothing"}.`,
        });
        if (issues.length > 40) break;
      }
      // Closing at this depth settles any layout frame opened here.
      while (openLayouts.length > 0 && openLayouts[openLayouts.length - 1].depth > stack.length) {
        const frame = openLayouts.pop()!;
        if (!frame.satisfied) {
          issues.push({
            path: at,
            code: "layout_without_media",
            detail: `A "${frame.kind}" layout contains no media token. Use "stack" or "offset" when there is no asset to show.`,
          });
        }
      }
      continue;
    }

    elements += 1;
    const attrs = scanAttributes(attrRegion, name, at, options);
    issues.push(...attrs.issues);

    if (attrs.mediaId) {
      // Any open media-requiring ancestor is now satisfied.
      for (const frame of openLayouts) frame.satisfied = true;
    }

    const selfClosing = attrRegion.trimEnd().endsWith("/");
    if (!VOID_TAGS.has(name) && !selfClosing) {
      stack.push(name);
      if (stack.length > maxDepth) maxDepth = stack.length;
      if (attrs.layout && MEDIA_REQUIRING_LAYOUTS.has(attrs.layout)) {
        openLayouts.push({ depth: stack.length, kind: attrs.layout, satisfied: false });
      }
    } else if (attrs.layout && MEDIA_REQUIRING_LAYOUTS.has(attrs.layout)) {
      // A void or self-closed element has no subtree to hold media.
      issues.push({
        path: at,
        code: "layout_without_media",
        detail: `A "${attrs.layout}" layout on an empty element can never contain media.`,
      });
    }

    if (issues.length > 40) break;
  }

  for (const frame of openLayouts) {
    if (!frame.satisfied) {
      issues.push({
        path: at,
        code: "layout_without_media",
        detail: `A "${frame.kind}" layout contains no media token.`,
      });
    }
  }

  const tail = bodyHtml.slice(consumed);
  if (tail.includes("<")) {
    issues.push({ path: at, code: "unparseable_markup", detail: "Trailing '<' does not begin a permitted tag." });
  } else {
    issues.push(...literalTextIssues(tail, at));
  }

  if (stack.length > 0) {
    issues.push({ path: at, code: "unbalanced_tag", detail: `${stack.length} element(s) left unclosed: <${stack.slice(0, 5).join(">, <")}>.` });
  }
  if (elements > CODEGEN_BUDGETS.maxElementsPerRoute) {
    issues.push({ path: at, code: "budget_elements", detail: `${elements} elements exceeds ${CODEGEN_BUDGETS.maxElementsPerRoute}.` });
  }
  if (maxDepth > CODEGEN_BUDGETS.maxDepth) {
    issues.push({ path: at, code: "budget_depth", detail: `Nesting depth ${maxDepth} exceeds ${CODEGEN_BUDGETS.maxDepth}.` });
  }

  return issues.slice(0, 40);
}

interface AttributeScan {
  issues: RejectIssue[];
  /** Set when this element carries a valid media token. */
  mediaId?: string;
  /** Set when this element declares a layout. */
  layout?: string;
}

function scanAttributes(attrRegion: string, tag: string, at: string, options: ScanOptions): AttributeScan {
  const issues: RejectIssue[] = [];
  let mediaId: string | undefined;
  let layout: string | undefined;
  const attrPattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;

  while ((match = attrPattern.exec(attrRegion)) !== null) {
    const name = match[1].toLowerCase();
    if (name === "/") continue;
    const value = match[2] ?? match[3] ?? match[4] ?? "";

    const permitted =
      ALLOWED_ATTRS.has(name) || ALLOWED_ATTR_PREFIXES.some((prefix) => name.startsWith(prefix));
    if (!permitted) {
      issues.push({ path: at, code: "attribute_not_allowed", detail: `Attribute "${name}" on <${tag}> is not permitted.` });
      continue;
    }

    if (name.startsWith("data-ventrio-") && !RESERVED_ATTRS.has(name)) {
      issues.push({
        path: at,
        code: "reserved_attribute",
        detail: `"${name}" is in the reserved data-ventrio-* namespace.`,
      });
      continue;
    }

    if (name === "data-ventrio-media") {
      // Only on <span>: the compiler replaces the whole element, and a
      // replacement is only unambiguous when the element is a known empty one.
      if (tag !== "span") {
        issues.push({ path: at, code: "media_wrong_element", detail: `data-ventrio-media belongs on <span>, not <${tag}>.` });
        continue;
      }
      if (!ASSET_TOKEN_PATTERN.test(value)) {
        issues.push({ path: at, code: "bad_asset_id", detail: `"${value.slice(0, 48)}" is not a valid asset id.` });
        continue;
      }
      // Resolved against the real registry, so a plausible-looking but absent
      // name fails here rather than rendering a hole.
      if (options.assetIds && !options.assetIds.has(value)) {
        issues.push({ path: at, code: "unknown_asset", detail: `No trusted asset is registered as "${value}".` });
        continue;
      }
      mediaId = value;
      continue;
    }

    if (name === "data-ventrio-flip") {
      // A split may mirror. One value only, so the attribute cannot carry
      // anything but the fact that it was asked for.
      if (value !== "true") {
        issues.push({ path: at, code: "bad_flip", detail: 'data-ventrio-flip only accepts "true".' });
      }
      continue;
    }

    if (name === "data-ventrio-layout") {
      if (!LAYOUT_SET.has(value)) {
        issues.push({
          path: at,
          code: "unknown_layout",
          detail: `"${value.slice(0, 32)}" is not a layout. Use one of: ${LAYOUT_KINDS.join(", ")}.`,
        });
        continue;
      }
      layout = value;
      continue;
    }

    if (name === "href") {
      // Internal fragments and internal paths only. The frame is sandboxed and
      // cannot navigate anywhere regardless; this keeps the *intent* honest.
      const trimmed = value.trim();
      const internal = trimmed.startsWith("#") || /^\/(?![/\\])/.test(trimmed);
      if (!internal) {
        issues.push({ path: at, code: "href_not_internal", detail: `href "${trimmed.slice(0, 60)}" is not an internal path or fragment.` });
      }
    }
  }

  return { issues, mediaId, layout };
}

/** Asset ids referenced from markup share the registry's id grammar. */
const ASSET_TOKEN_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;

/* ──────────────────────────── CSS scanning ─────────────────────────────── */

const FORBIDDEN_CSS_SUBSTRINGS: ReadonlyArray<[string, string]> = [
  // The one that genuinely matters: `</style` inside the stylesheet would end
  // the shell's <style> element early and put the remainder into the document
  // as markup. Everything after it would be model-controlled document
  // structure, which is exactly what the envelope design exists to prevent.
  ["</", "style_escape"],
  ["@import", "css_import"],
  ["@charset", "css_charset"],
  ["javascript:", "js_url"],
  ["vbscript:", "js_url"],
  ["expression(", "css_expression"],
  ["behavior:", "css_behavior"],
  ["-moz-binding", "css_binding"],
  // No network, at all. The shell forbids it via CSP too; a bundle that tries
  // is misunderstanding the contract and should be seen, not silently blocked.
  ["url(", "css_url"],
  ["\\", "css_escape"],
];

/** Both gates, merged — see scanMarkup for why they are not chained. */
export function scanCss(css: string): RejectIssue[] {
  return [...parseCssIssues(css), ...scanCssByScanner(css)].slice(0, 40);
}

function scanCssByScanner(css: string): RejectIssue[] {
  const issues: RejectIssue[] = [];
  const lower = css.toLowerCase();

  for (const [needle, code] of FORBIDDEN_CSS_SUBSTRINGS) {
    if (lower.includes(needle)) {
      issues.push({ path: "$.css", code, detail: `Stylesheet contains "${needle}", which is not permitted.` });
    }
  }

  const rules = (css.match(/\{/g) ?? []).length;
  if (rules > CODEGEN_BUDGETS.maxCssRules) {
    issues.push({ path: "$.css", code: "budget_css_rules", detail: `${rules} rule blocks exceeds ${CODEGEN_BUDGETS.maxCssRules}.` });
  }

  const open = rules;
  const close = (css.match(/\}/g) ?? []).length;
  if (open !== close) {
    issues.push({ path: "$.css", code: "css_unbalanced", detail: `${open} '{' against ${close} '}'.` });
  }

  return issues.slice(0, 40);
}
