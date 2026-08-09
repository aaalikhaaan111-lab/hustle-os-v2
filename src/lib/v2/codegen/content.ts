/**
 * Content tokens: the model composes, Ventrio supplies the words.
 *
 * The model writes `{{ventrio:text:hero.title}}` and never the title itself.
 * Two things follow, and both are the reason the indirection exists:
 *
 * 1. Copy comes from a content pack the application owns, so a generated page
 *    cannot invent a customer count, a price, or a compliance claim. The
 *    "do not fabricate" boundary stops being a prompt instruction and becomes
 *    a structural property.
 * 2. Every substituted value is HTML-escaped on the way in. Content is text and
 *    can never become markup, so substitution cannot introduce structure that
 *    the reject pass never saw — which is why substitution runs *after*
 *    scanning rather than before.
 *
 * Unknown keys are a hard failure. A missing token could be rendered as an
 * empty string, but a page with a silently blank headline looks like a renderer
 * bug and hides a model that referred to content it was never given.
 */

import { CODEGEN_BUDGETS } from "./budgets";
import type { RejectIssue } from "./reject";

/** Flat key/value copy. Keys are dotted, lowercase, stable. */
export type ContentPack = Readonly<Record<string, string>>;

export const CONTENT_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;

/** Matches a well-formed token. Anything else beginning `{{` is malformed. */
const TOKEN_PATTERN = /\{\{ventrio:text:([a-z0-9][a-z0-9._-]{0,63})\}\}/g;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function validateContentPack(pack: ContentPack): RejectIssue[] {
  const issues: RejectIssue[] = [];
  const keys = Object.keys(pack);

  if (keys.length > CODEGEN_BUDGETS.maxContentKeys) {
    issues.push({ path: "$.content", code: "budget_content_keys", detail: `${keys.length} keys exceeds ${CODEGEN_BUDGETS.maxContentKeys}.` });
  }
  for (const key of keys) {
    if (!CONTENT_KEY_PATTERN.test(key)) {
      issues.push({ path: `$.content.${key}`, code: "bad_content_key", detail: "Keys must be lowercase dotted identifiers." });
    }
    const value = pack[key];
    if (typeof value !== "string") {
      issues.push({ path: `$.content.${key}`, code: "bad_content_value", detail: "Content values must be strings." });
    } else if (value.length > CODEGEN_BUDGETS.maxContentValueChars) {
      issues.push({ path: `$.content.${key}`, code: "budget_content_value", detail: `${value.length} chars exceeds ${CODEGEN_BUDGETS.maxContentValueChars}.` });
    }
  }

  return issues;
}

export interface SubstitutionResult {
  text: string;
  issues: RejectIssue[];
  /** Keys actually referenced, for reporting unused content. */
  used: string[];
}

/**
 * Replaces every token with escaped content.
 *
 * The residual check afterwards is not redundant with the pattern: a token like
 * `{{ventrio:text:Hero Title}}` never matches, so without the second pass it
 * would be emitted to the page as literal braces. Malformed tokens are a
 * rejection, not a rendering artefact.
 */
export function substituteContent(text: string, pack: ContentPack, at: string): SubstitutionResult {
  const issues: RejectIssue[] = [];
  const used: string[] = [];

  const out = text.replace(TOKEN_PATTERN, (_match, key: string) => {
    const value = pack[key];
    if (typeof value !== "string") {
      issues.push({ path: at, code: "unknown_token", detail: `No content is defined for "${key}".` });
      return "";
    }
    used.push(key);
    return escapeHtml(value);
  });

  if (out.includes("{{") || out.includes("}}")) {
    const sample = /\{\{[^}]{0,60}\}?\}?/.exec(out)?.[0] ?? "{{";
    issues.push({
      path: at,
      code: "malformed_token",
      detail: `Unresolved template syntax remains: "${sample}". Tokens must be exactly {{ventrio:text:key}}.`,
    });
  }

  return { text: out, issues, used };
}
