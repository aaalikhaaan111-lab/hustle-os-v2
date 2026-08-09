/**
 * Structure decided by parsers, not inferred by regular expressions.
 *
 * The prototype's reject pass was built from string scanning and a hand-rolled
 * tag walker, and said so in its own header: promoting it beyond a local
 * gallery needed declared parser dependencies. This is that promotion.
 *
 * Why it matters, concretely. A scanner sees text; a parser sees the tree the
 * browser will actually build. Those differ in ways an attacker picks on
 * purpose — implicit tag closing, malformed attribute quoting, unusual
 * whitespace inside a tag name, entities inside an attribute value, content
 * that reparents itself out of a table. A regex that "looks for `<script`"
 * cannot reason about any of that; parse5 resolves it the way Chrome would and
 * hands back nodes.
 *
 * This module does not replace the reject pass — it runs alongside it, and both
 * must pass. The scanner stays because it refuses some constructs outright
 * rather than modelling them, and a rule that refuses what it cannot parse is
 * worth keeping even once something else can parse it.
 *
 * Nothing here rewrites its input. Every function either returns no issues or
 * returns issues; there is no repair path, because a repair is a silent change
 * to something a person asked for.
 */

import { parseFragment, type DefaultTreeAdapterTypes } from "parse5";
import * as csstree from "css-tree";
import { CODEGEN_BUDGETS } from "./budgets";

export interface ParseIssue {
  path: string;
  code: string;
  detail: string;
}

type Node = DefaultTreeAdapterTypes.Node;
type Element = DefaultTreeAdapterTypes.Element;
type ParentNode = DefaultTreeAdapterTypes.ParentNode;

function isElement(node: Node): node is Element {
  return "tagName" in node;
}

function hasChildren(node: Node): node is ParentNode {
  return "childNodes" in node;
}

export interface ParseMarkupOptions {
  allowedTags: ReadonlySet<string>;
  allowedAttrs: ReadonlySet<string>;
  allowedAttrPrefixes: readonly string[];
  voidTags: ReadonlySet<string>;
}

/**
 * Walks the parsed tree and reports everything the contract does not allow.
 *
 * The checks are deliberately the same ones the scanner makes. Agreement is the
 * point: two independent implementations reaching the same verdict is evidence,
 * and a disagreement is a bug worth finding.
 */
export function parseMarkupIssues(
  bodyHtml: string,
  at: string,
  options: ParseMarkupOptions,
): ParseIssue[] {
  const issues: ParseIssue[] = [];
  const push = (code: string, detail: string) => {
    // One issue per kind is enough to reject; a hundred repeats of the same
    // mistake buries the others.
    if (issues.length < 40) issues.push({ path: at, code, detail });
  };

  let fragment: ParentNode;
  try {
    fragment = parseFragment(bodyHtml, { sourceCodeLocationInfo: false });
  } catch {
    return [{ path: at, code: "parse_failed", detail: "The markup could not be parsed." }];
  }

  let elementCount = 0;
  let maxDepth = 0;

  const walk = (node: Node, depth: number): void => {
    if (depth > maxDepth) maxDepth = depth;

    if (isElement(node)) {
      elementCount += 1;
      const tag = node.tagName.toLowerCase();

      // A tag the parser recognised that the contract does not allow. This is
      // where parse5 earns its place: `<scr<script>ipt>` and friends resolve to
      // a real `script` element here, whatever the source text looked like.
      if (!options.allowedTags.has(tag)) {
        push("tag_not_allowed", `<${tag}> is not an allowed element.`);
      }

      for (const attr of node.attrs ?? []) {
        const name = attr.name.toLowerCase();
        const value = attr.value ?? "";

        // Event handlers, however they were spelled in the source.
        if (name.startsWith("on")) {
          push("event_handler", `The "${name}" attribute is an event handler.`);
          continue;
        }
        // Inline styles are refused so the stylesheet stays the single place
        // styling comes from — and so `style-src 'unsafe-inline'` in the inner
        // policy covers exactly one <style> element and nothing else.
        if (name === "style") {
          push("attribute_not_allowed", "Inline style attributes are not allowed.");
          continue;
        }
        const allowed = options.allowedAttrs.has(name)
          || options.allowedAttrPrefixes.some((prefix) => name.startsWith(prefix));
        if (!allowed) {
          push("attribute_not_allowed", `The "${name}" attribute is not allowed.`);
          continue;
        }

        // A URL-bearing attribute may only be an internal path or a fragment.
        // The parser has already decoded entities, so `&#106;avascript:` is
        // plain text by the time it is compared here — which is exactly the
        // case a source-text regex misses.
        if (name === "href" || name === "cite") {
          const url = value.trim().toLowerCase();
          if (url && !url.startsWith("/") && !url.startsWith("#")) {
            push("href_not_internal", `"${name}" must be an internal path or a fragment.`);
          }
          if (url.includes(":") && !url.startsWith("#")) {
            push("href_not_internal", `"${name}" must not carry a scheme.`);
          }
        }
      }
    }

    // A comment can hide a conditional or an unbalanced construct, and nothing
    // in a generated page needs one.
    if (node.nodeName === "#comment") {
      push("comment", "Comments are not allowed in generated markup.");
    }

    if (hasChildren(node)) {
      const isVoid = isElement(node) && options.voidTags.has(node.tagName.toLowerCase());
      for (const child of node.childNodes) {
        walk(child, isVoid ? depth : depth + 1);
      }
    }
  };

  for (const child of fragment.childNodes) walk(child, 1);

  if (elementCount > CODEGEN_BUDGETS.maxElementsPerRoute) {
    push("budget_elements", `${elementCount} elements exceeds ${CODEGEN_BUDGETS.maxElementsPerRoute}.`);
  }
  if (maxDepth > CODEGEN_BUDGETS.maxDepth) {
    push("budget_depth", `Nesting depth ${maxDepth} exceeds ${CODEGEN_BUDGETS.maxDepth}.`);
  }

  return issues;
}

/** At-rules a static generated page has any business using. */
const ALLOWED_AT_RULES = new Set(["media", "supports", "keyframes", "layer", "container", "page"]);

/**
 * Parses the stylesheet and reports what the contract does not allow.
 *
 * css-tree reports its own syntax errors, which matters: a stylesheet the
 * parser cannot read is refused rather than partially understood. A scanner
 * that skips what it cannot parse is the failure mode this replaces.
 */
export function parseCssIssues(css: string, at = "$.css"): ParseIssue[] {
  const issues: ParseIssue[] = [];
  const push = (code: string, detail: string) => {
    if (issues.length < 40) issues.push({ path: at, code, detail });
  };

  const parseErrors: string[] = [];
  let ast: csstree.CssNode;
  try {
    ast = csstree.parse(css, {
      positions: false,
      onParseError: (error) => parseErrors.push(error.message),
    });
  } catch {
    return [{ path: at, code: "css_parse_failed", detail: "The stylesheet could not be parsed." }];
  }

  // Malformed CSS is refused outright. Browsers recover from it by discarding
  // what they cannot read, which means the page a person reviews and the page
  // a visitor sees can differ.
  if (parseErrors.length > 0) {
    push("css_malformed", `The stylesheet has ${parseErrors.length} syntax error(s).`);
  }

  let rules = 0;
  let declarations = 0;
  // Declarations are counted as well as rules: a single selector carrying
  // thousands of declarations is the same denial-of-service shape as thousands
  // of rules, and the rule count alone would not see it.

  csstree.walk(ast, (node) => {
    if (node.type === "Rule") rules += 1;
    if (node.type === "Declaration") declarations += 1;

    if (node.type === "Atrule") {
      const name = node.name.toLowerCase();
      if (!ALLOWED_AT_RULES.has(name)) {
        // @import is the one that matters most: it is a network fetch written
        // in CSS, and it is the reason this check exists at all.
        push("at_rule_not_allowed", `@${name} is not allowed.`);
      }
    }

    // Any url() is refused. Media reaches the page through the owned asset
    // registry as a token, never as a stylesheet reference, so a url() here is
    // either an external fetch or a data URI that bypassed the registry.
    if (node.type === "Url") {
      push("css_url", "url() is not allowed; media comes from the asset registry.");
    }

    // Legacy IE/Mozilla escapes that execute.
    if (node.type === "Function") {
      const name = node.name.toLowerCase();
      if (name === "expression" || name === "-moz-binding") {
        push("css_expression", `${name}() is not allowed.`);
      }
    }
  });

  if (rules > CODEGEN_BUDGETS.maxCssRules) {
    push("budget_css_rules", `${rules} rules exceeds ${CODEGEN_BUDGETS.maxCssRules}.`);
  }
  const maxDeclarations = CODEGEN_BUDGETS.maxCssRules * 20;
  if (declarations > maxDeclarations) {
    push("budget_css_rules", `${declarations} declarations exceeds ${maxDeclarations}.`);
  }

  return issues;
}
