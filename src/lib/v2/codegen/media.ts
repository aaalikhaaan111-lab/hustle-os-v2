/**
 * Media expansion: turning a name into a picture.
 *
 * The model writes `<span data-ventrio-media="bench.surface"></span>` and this
 * pass replaces the whole span with an `<img>` element built by
 * `renderAsset` from a registry entry. Nothing in the replacement derives from
 * model text — the only thing the model contributed was a key, and that key was
 * already checked against the registry by the reject pass.
 *
 * This runs after scanning and after content substitution, which is the same
 * ordering rule the rest of the pipeline follows: everything model-authored is
 * judged first, and only then does Ventrio insert its own markup. The output
 * is deliberately not rescanned, because it is not model output; rescanning it
 * would only prove that `renderAsset` writes an `<img>`, which the element
 * allowlist forbids, and the scan would fail on Ventrio's own correct markup.
 *
 * The match is exact and narrow: an opening `<span>` whose only attributes are
 * the media token (plus an optional class), no children, and a closing tag. A
 * span carrying a media token that does not fit that shape is a rejection, not
 * a silent pass-through — a token left in the document would render as an empty
 * span and look like a layout bug.
 */

import { CODEGEN_BUDGETS } from "./budgets";
import { renderAsset, type AssetRegistry } from "./assets";
import type { RejectIssue } from "./reject";

/**
 * Matches the expandable form.
 *
 * `class` is permitted before or after the token so a bundle can style the
 * wrapper; both are captured so the class survives onto the figure.
 */
const MEDIA_SPAN =
  /<span((?:\s+(?:class="[^"]*"|data-ventrio-media="[a-z0-9][a-z0-9._-]{0,63}"))+)\s*>\s*<\/span>/g;

const TOKEN_IN_ATTRS = /data-ventrio-media="([a-z0-9][a-z0-9._-]{0,63})"/;
const CLASS_IN_ATTRS = /class="([^"]*)"/;

export interface MediaExpansion {
  html: string;
  issues: RejectIssue[];
  /** Asset ids actually placed, for reporting. */
  used: string[];
}

export function expandMedia(html: string, registry: AssetRegistry, at: string): MediaExpansion {
  const issues: RejectIssue[] = [];
  const used: string[] = [];

  const out = html.replace(MEDIA_SPAN, (whole, attrs: string) => {
    const token = TOKEN_IN_ATTRS.exec(attrs)?.[1];
    if (!token) return whole; // A class-only span: not a media span, leave it.

    const asset = registry.get(token);
    if (!asset) {
      // Unreachable when the reject pass ran with the same registry, which is
      // the only supported call order. Kept because "unreachable" is a claim
      // about today's callers, and the failure it prevents is a silent hole in
      // a rendered page.
      issues.push({ path: at, code: "unknown_asset", detail: `No trusted asset is registered as "${token}".` });
      return "";
    }

    used.push(token);
    const className = CLASS_IN_ATTRS.exec(attrs)?.[1] ?? "";
    const wrapperClass = `v-media${className ? ` ${escapeAttr(className)}` : ""}`;
    return `<figure class="${wrapperClass}">${renderAsset(asset)}</figure>`;
  });

  if (used.length > CODEGEN_BUDGETS.maxMediaPerRoute) {
    issues.push({
      path: at,
      code: "budget_media",
      detail: `${used.length} media placements exceeds ${CODEGEN_BUDGETS.maxMediaPerRoute} for one route.`,
    });
  }

  // Any surviving token means a span did not match the expandable shape.
  if (/data-ventrio-media/.test(out)) {
    issues.push({
      path: at,
      code: "media_not_expandable",
      detail: 'A media token must appear as exactly <span data-ventrio-media="id"></span> with no children.',
    });
  }

  return { html: out, issues, used };
}

/**
 * Escapes a class attribute lifted from model markup.
 *
 * The class string is the one part of the span the model authored that
 * survives into the replacement, so it is the one part that needs escaping.
 * The scanner already refuses a `"` inside a quoted attribute value, so this
 * is the second line rather than the first.
 */
function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
