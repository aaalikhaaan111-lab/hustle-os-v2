/**
 * The owned JSON envelope.
 *
 * The model does not return a document. It returns this object, and Ventrio
 * builds the document around it (see shell.ts). That distinction is the whole
 * design: the model never controls the doctype, the `<head>`, the meta CSP, or
 * where its stylesheet is mounted, so there is no position in the output where
 * model text can become document structure it was not allocated.
 *
 * `bodyHtml` is inner markup for `<body>` — not a full document. A model that
 * returns `<!doctype html>` is rejected here rather than having its shell
 * silently stripped, because stripping is a repair and repairs hide mistakes
 * that matter.
 */

import { CODEGEN_BUDGETS } from "./budgets";

export const CODEGEN_ENVELOPE_VERSION = "codegen-1" as const;

export interface CodegenRouteV1 {
  /** Internal path, lowercase, must start with "/". */
  path: string;
  /** Plain text; escaped into <title> by the shell. */
  title: string;
  /** Inner markup for <body>. May contain {{ventrio:text:*}} tokens. */
  bodyHtml: string;
}

export interface CodegenBundleV1 {
  version: typeof CODEGEN_ENVELOPE_VERSION;
  /** One stylesheet for the whole bundle. */
  css: string;
  routes: CodegenRouteV1[];
}

export interface EnvelopeIssue {
  path: string;
  code: string;
  detail: string;
}

export type EnvelopeResult =
  | { ok: true; bundle: CodegenBundleV1 }
  | { ok: false; issues: EnvelopeIssue[] };

const PATH_PATTERN = /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?$/;

/**
 * Structural validation only — no markup or CSS inspection.
 *
 * Shape first, content second, so a malformed envelope produces a shape error
 * rather than a confusing scanner error about markup that was never really
 * markup. `reject.ts` is the next gate and assumes it is handed strings.
 */
export function validateCodegenEnvelope(value: unknown): EnvelopeResult {
  const issues: EnvelopeIssue[] = [];
  const fail = (path: string, code: string, detail: string): void => {
    issues.push({ path, code, detail });
  };

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, issues: [{ path: "$", code: "not_an_object", detail: "The bundle must be a JSON object." }] };
  }

  const record = value as Record<string, unknown>;

  // Unknown top-level keys are refused rather than ignored: a model that
  // invents a field is describing something it expects to take effect, and
  // silently dropping it means shipping a page that is not what was asked for.
  const allowedKeys = new Set(["version", "css", "routes"]);
  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key)) fail(`$.${key}`, "unknown_key", `"${key}" is not part of the envelope.`);
  }

  if (record.version !== CODEGEN_ENVELOPE_VERSION) {
    fail("$.version", "bad_version", `Expected "${CODEGEN_ENVELOPE_VERSION}".`);
  }

  if (typeof record.css !== "string") {
    fail("$.css", "not_a_string", "css must be a string (may be empty).");
  }

  const routes = record.routes;
  if (!Array.isArray(routes)) {
    fail("$.routes", "not_an_array", "routes must be an array.");
    return { ok: false, issues };
  }
  if (routes.length === 0) {
    fail("$.routes", "no_routes", "At least one route is required.");
  }
  if (routes.length > CODEGEN_BUDGETS.maxRoutes) {
    fail("$.routes", "too_many_routes", `${routes.length} routes exceeds the ceiling of ${CODEGEN_BUDGETS.maxRoutes}.`);
  }

  const seen = new Set<string>();
  routes.forEach((entry, index) => {
    const at = `$.routes[${index}]`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      fail(at, "not_an_object", "Each route must be an object.");
      return;
    }
    const route = entry as Record<string, unknown>;

    for (const key of Object.keys(route)) {
      if (!["path", "title", "bodyHtml"].includes(key)) {
        fail(`${at}.${key}`, "unknown_key", `"${key}" is not part of a route.`);
      }
    }

    if (typeof route.path !== "string") {
      fail(`${at}.path`, "not_a_string", "path must be a string.");
    } else if (!PATH_PATTERN.test(route.path)) {
      fail(`${at}.path`, "bad_path", `"${route.path}" is not a lowercase internal path.`);
    } else if (seen.has(route.path)) {
      fail(`${at}.path`, "duplicate_path", `"${route.path}" appears more than once.`);
    } else {
      seen.add(route.path);
    }

    if (typeof route.title !== "string" || !route.title.trim()) {
      fail(`${at}.title`, "bad_title", "title must be a non-empty string.");
    }

    if (typeof route.bodyHtml !== "string") {
      fail(`${at}.bodyHtml`, "not_a_string", "bodyHtml must be a string.");
    } else if (!route.bodyHtml.trim()) {
      fail(`${at}.bodyHtml`, "empty_body", "bodyHtml must not be empty.");
    }
  });

  if (routes.length > 0 && !seen.has("/")) {
    fail("$.routes", "no_root_route", 'Exactly one route must have the path "/".');
  }

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    bundle: {
      version: CODEGEN_ENVELOPE_VERSION,
      css: record.css as string,
      routes: (routes as Record<string, unknown>[]).map((route) => ({
        path: route.path as string,
        title: route.title as string,
        bodyHtml: route.bodyHtml as string,
      })),
    },
  };
}
