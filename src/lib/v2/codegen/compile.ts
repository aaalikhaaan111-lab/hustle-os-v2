/**
 * The gate chain, in the one order that is defensible.
 *
 *   1. bundle size      — refuse absurd payloads before doing any work on them
 *   2. envelope shape   — decide it is the right kind of object
 *   3. content pack     — the application's own data, checked before it is used
 *   4. raw budgets      — on exactly the bytes the model produced
 *   5. reject pass      — on exactly the string the model wrote
 *   6. substitution     — escaped content, so it cannot add structure
 *   7. media expansion  — Ventrio's own <img>, from a name the gate approved
 *   8. expanded budgets — on the bytes the browser actually receives
 *   9. shell assembly   — Ventrio's document, around checked parts
 *
 * Steps 5, 6 and 7 are in that order deliberately. Scanning after substitution
 * would mean scanning a string the model did not author, and passing that scan
 * would say nothing about whether the model behaved. Scanning first, then
 * inserting only escaped text and Ventrio's own image markup, gives both
 * properties: the model's own output is judged, and nothing inserted
 * afterwards can carry structure the scan never saw.
 *
 * Every failure is terminal. There is no repair, no trimming and no fallback
 * content anywhere in this file — a bundle either conforms or it is refused,
 * and the caller decides whether to spend another request.
 */

import { CODEGEN_BUDGETS } from "./budgets";
import { validateCodegenEnvelope, type CodegenBundleV1 } from "./envelope";
import { substituteContent, validateContentPack, type ContentPack } from "./content";
import { scanCss, scanMarkup, type RejectIssue } from "./reject";
import { expandMedia } from "./media";
import { TRUSTED_ASSETS, type AssetRegistry } from "./assets";
import { buildSrcDoc } from "./shell";

export interface CompiledRoute {
  path: string;
  title: string;
  /** The complete document for the sandboxed frame. */
  srcDoc: string;
  elementBytes: number;
}

export interface CodegenReport {
  routeCount: number;
  cssBytes: number;
  totalSrcDocBytes: number;
  /** Content keys the bundle never referenced. Quality signal, not a failure. */
  unusedContentKeys: string[];
  /** Trusted assets actually placed, in document order per route. */
  assetsUsed: string[];
}

export type CodegenResult =
  | { ok: true; routes: CompiledRoute[]; report: CodegenReport }
  | { ok: false; stage: CodegenStage; issues: RejectIssue[] };

export type CodegenStage =
  | "payload"
  | "envelope"
  | "content"
  | "budget"
  | "reject"
  | "substitution"
  | "media";

export interface CompileOptions {
  content: ContentPack;
  lang?: string;
  /**
   * Assets the bundle may name. Defaults to the trusted registry.
   *
   * Injectable so tests can compile against an empty registry and prove that
   * a media token fails closed when nothing is registered.
   */
  assets?: AssetRegistry;
}

const byteLength = (value: string): number => Buffer.byteLength(value, "utf8");

export function compileCodegenBundle(value: unknown, options: CompileOptions): CodegenResult {
  // ── 1. payload size ──────────────────────────────────────────────────────
  // Measured on the serialised form so a deeply nested object cannot be cheap
  // to check and expensive to process.
  let serialisedBytes = 0;
  try {
    serialisedBytes = byteLength(JSON.stringify(value) ?? "");
  } catch {
    return {
      ok: false,
      stage: "payload",
      issues: [{ path: "$", code: "unserialisable", detail: "The bundle could not be serialised." }],
    };
  }
  if (serialisedBytes > CODEGEN_BUDGETS.maxBundleBytes) {
    return {
      ok: false,
      stage: "payload",
      issues: [{ path: "$", code: "budget_bundle", detail: `${serialisedBytes} bytes exceeds ${CODEGEN_BUDGETS.maxBundleBytes}.` }],
    };
  }

  // ── 2. envelope shape ────────────────────────────────────────────────────
  const envelope = validateCodegenEnvelope(value);
  if (!envelope.ok) return { ok: false, stage: "envelope", issues: envelope.issues };
  const bundle: CodegenBundleV1 = envelope.bundle;

  // ── 3. content pack ──────────────────────────────────────────────────────
  const contentIssues = validateContentPack(options.content);
  if (contentIssues.length > 0) return { ok: false, stage: "content", issues: contentIssues };

  // ── 4. raw budgets ───────────────────────────────────────────────────────
  const budgetIssues: RejectIssue[] = [];
  const cssBytes = byteLength(bundle.css);
  if (cssBytes > CODEGEN_BUDGETS.maxCssBytes) {
    budgetIssues.push({ path: "$.css", code: "budget_css", detail: `${cssBytes} bytes exceeds ${CODEGEN_BUDGETS.maxCssBytes}.` });
  }
  bundle.routes.forEach((route, index) => {
    const bytes = byteLength(route.bodyHtml);
    if (bytes > CODEGEN_BUDGETS.maxBodyHtmlBytes) {
      budgetIssues.push({
        path: `$.routes[${index}].bodyHtml`,
        code: "budget_body",
        detail: `${bytes} bytes exceeds ${CODEGEN_BUDGETS.maxBodyHtmlBytes}.`,
      });
    }
  });
  if (budgetIssues.length > 0) return { ok: false, stage: "budget", issues: budgetIssues };

  // ── 5. reject pass ───────────────────────────────────────────────────────
  const assets = options.assets ?? TRUSTED_ASSETS;
  const assetIds = new Set(assets.keys());

  const rejectIssues: RejectIssue[] = scanCss(bundle.css);
  bundle.routes.forEach((route, index) => {
    rejectIssues.push(...scanMarkup(route.bodyHtml, `$.routes[${index}].bodyHtml`, { assetIds }));
  });
  if (rejectIssues.length > 0) return { ok: false, stage: "reject", issues: rejectIssues };

  // ── 6/7/8. substitution, media expansion, then the expanded budget ───────
  const substitutionIssues: RejectIssue[] = [];
  const mediaIssues: RejectIssue[] = [];
  const used = new Set<string>();
  const assetsUsed: string[] = [];
  const compiled: CompiledRoute[] = [];

  for (const [index, route] of bundle.routes.entries()) {
    const at = `$.routes[${index}].bodyHtml`;
    const body = substituteContent(route.bodyHtml, options.content, at);
    substitutionIssues.push(...body.issues);
    body.used.forEach((key) => used.add(key));

    // Titles carry tokens too, and are escaped a second time by the shell —
    // harmless for text, and it keeps the shell's contract simple.
    const title = substituteContent(route.title, options.content, `$.routes[${index}].title`);
    substitutionIssues.push(...title.issues);
    title.used.forEach((key) => used.add(key));

    // Media last: the replacement is Ventrio's own markup, so it must not be
    // in place while anything model-authored is still being judged.
    const media = expandMedia(body.text, assets, at);
    mediaIssues.push(...media.issues);
    assetsUsed.push(...media.used);

    // Measured after expansion, because that is the string the browser gets —
    // and a data-URI image is by far the largest thing this pipeline inserts.
    const expandedBytes = byteLength(media.html);
    if (expandedBytes > CODEGEN_BUDGETS.maxExpandedBodyHtmlBytes) {
      substitutionIssues.push({
        path: at,
        code: "budget_expanded_body",
        detail: `${expandedBytes} bytes after substitution and media exceeds ${CODEGEN_BUDGETS.maxExpandedBodyHtmlBytes}.`,
      });
    }

    compiled.push({
      path: route.path,
      title: title.text,
      srcDoc: buildSrcDoc({ title: title.text, css: bundle.css, bodyHtml: media.html, lang: options.lang }),
      elementBytes: expandedBytes,
    });
  }

  if (substitutionIssues.length > 0) {
    return { ok: false, stage: "substitution", issues: substitutionIssues.slice(0, 40) };
  }
  if (mediaIssues.length > 0) {
    return { ok: false, stage: "media", issues: mediaIssues.slice(0, 40) };
  }

  return {
    ok: true,
    routes: compiled,
    report: {
      routeCount: compiled.length,
      cssBytes,
      totalSrcDocBytes: compiled.reduce((sum, route) => sum + byteLength(route.srcDoc), 0),
      unusedContentKeys: Object.keys(options.content).filter((key) => !used.has(key)),
      assetsUsed,
    },
  };
}
