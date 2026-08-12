/**
 * The gate a generated project passes before anything compiles it.
 *
 * ORDERING IS THE DESIGN. Shape first, then paths, then budgets, then content.
 * Each stage assumes the previous one held, so nothing here parses a value it
 * has not already established is a string of a sane length at a path that is
 * allowed to exist. Reversing any two would mean running a regex over
 * unbounded model output, which is how a validator becomes the denial-of-
 * service it was meant to prevent.
 *
 * Nothing is repaired. A bundle either conforms or it is refused, and the
 * refusal names the file and the rule so a repair request has something exact
 * to act on. Silently dropping a bad file would ship a project missing a
 * component nobody knows is missing.
 *
 * What this does NOT do is judge the application. It has no opinion on the
 * component tree, the layout, the number of screens or the interactions —
 * those are the product, and enumerating them is precisely the mistake the
 * page renderer made.
 */

import {
  APP_BUDGETS,
  APP_SCHEMA_VERSION,
  validatePath,
  type GeneratedAppV1,
} from "./contract";
import { isAllowedDependency, isAllowedImport, isRuntimeTemplate, RUNTIME_TEMPLATES } from "./runtime";

export interface AppIssue {
  path: string;
  code: string;
  detail: string;
}

export type AppValidation =
  | { ok: true; app: GeneratedAppV1 }
  | { ok: false; issues: AppIssue[] };

const MAX_ISSUES = 40;

class Issues {
  readonly list: AppIssue[] = [];
  add(path: string, code: string, detail: string): void {
    if (this.list.length < MAX_ISSUES) this.list.push({ path, code, detail });
  }
  get any(): boolean { return this.list.length > 0; }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= max ? value : null;
}

/**
 * Import specifiers, found without executing anything.
 *
 * A regex over source is the right tool here *because* the question is narrow:
 * which module specifiers appear in static import positions. It is not being
 * asked to understand the code. Anything it misses is caught by the bundler,
 * which resolves for real and fails on an unknown specifier — so this check
 * exists to give a clear early error, not to be the only line of defence.
 *
 * Dynamic `import()` is matched too, and only its literal form: a computed
 * specifier cannot be checked here and is refused outright below.
 */
const STATIC_IMPORT = /(?:^|[\s;}])import\s+(?:[\w*{}\s,]+\s+from\s+)?["']([^"']+)["']/g;
const EXPORT_FROM = /(?:^|[\s;}])export\s+(?:[\w*{}\s,]+\s+)?from\s+["']([^"']+)["']/g;
const DYNAMIC_IMPORT = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
const COMPUTED_IMPORT = /\bimport\s*\(\s*(?!["'])/;
const REQUIRE_CALL = /\brequire\s*\(/;

function specifiersIn(source: string): string[] {
  const found: string[] = [];
  for (const re of [STATIC_IMPORT, EXPORT_FROM, DYNAMIC_IMPORT]) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(source)) !== null) found.push(match[1]);
  }
  return found;
}

/**
 * Source patterns refused regardless of what they are for.
 *
 * These are not style rules. Each one is a way for code inside the sandbox to
 * reach something outside it, or to become code the build never saw:
 *
 *   - `eval` and `new Function` turn a string into code after every static
 *     check has run;
 *   - `parent`, `top`, `opener` and `postMessage` to anything but the protocol
 *     are attempts to talk to the embedder;
 *   - `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `navigator.send-
 *     Beacon` are network, which is denied by CSP anyway — refusing them here
 *     means a generated app fails at validation with a clear reason instead of
 *     silently doing nothing at runtime;
 *   - `document.cookie`, `localStorage`, `sessionStorage`, `indexedDB` are
 *     storage, unavailable on an opaque origin and equally worth naming;
 *   - `import.meta` exposes build environment.
 *
 * The sandbox denies all of it independently. This layer exists so a violation
 * is a build error the model can be told about, rather than a feature that
 * appears to exist and does not work.
 */
/**
 * Blanks string literals, template literals and comments, keeping length and
 * line structure so nothing else shifts.
 *
 * THE DEFECT THIS FIXES, observed in production on 2026-08-12. A generated
 * woodworking app was refused with
 * `frame_escape — Reaching the embedding page is not allowed` in
 * `src/data/mistakesData.ts`, a file of advice strings. The rule's bare-identifier
 * branch matches `top.` preceded by anything that is not a dot or word
 * character — which is exactly what the end of the sentence "Clamp it to the
 * top." looks like. The app was correct and safe; the copy contained an English
 * sentence about the top of a workpiece.
 *
 * A pattern that reads prose as code cannot be answered by any instruction to
 * the model short of "do not write that word", so it is fixed here. Only rules
 * that opt in are affected, and only the text they read changes: every real
 * escape — `window.parent`, `parent.postMessage(...)`, `top.document` — is still
 * matched, because those live in code, which is exactly what survives.
 */
function codeOnly(source: string): string {
  // Order matters: a quote inside a comment must not open a string, and a
  // comment marker inside a string must not open a comment.
  return source.replace(
    /\/\*[\s\S]*?\*\/|\/\/[^\n]*|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g,
    (match) => match.replace(/[^\n]/g, " "),
  );
}

/**
 * The matched text, with a little of what surrounds it.
 *
 * Server-side only: this is appended to a diagnostic that reaches the queue
 * consumer's log and the repair prompt, never the browser — the action hands a
 * person a translated sentence and nothing from here. Bounded hard, because a
 * diagnostic is a clue and not a place to copy a project into.
 *
 * Read from the original source rather than the blanked copy, so the quote is
 * what the model actually wrote.
 */
const EVIDENCE_CONTEXT = 60;
const EVIDENCE_MAX = 180;

function quoteMatch(source: string, index: number, length: number): string {
  const from = Math.max(0, index - EVIDENCE_CONTEXT);
  const to = Math.min(source.length, index + length + EVIDENCE_CONTEXT);
  const quote = source.slice(from, to).replace(/\s+/g, " ").trim().slice(0, EVIDENCE_MAX);
  return `Found: "${quote}"`;
}

const FORBIDDEN_SOURCE: Array<{
  code: string;
  pattern: RegExp;
  detail: string;
  codeOnly?: boolean;
  /** Append the matched text and a little context to the diagnostic. */
  evidence?: boolean;
}> = [
  { code: "eval", pattern: /\beval\s*\(/, detail: "eval() is not allowed." },
  { code: "new_function", pattern: /\bnew\s+Function\s*\(/, detail: "new Function() is not allowed." },
  /**
   * Reaching the embedder, as a static check.
   *
   * NARROWED, DELIBERATELY, AND HERE IS THE ARGUMENT. Earlier versions matched
   * a bare `parent.` / `top.` / `opener.` member access. That refused three
   * production generations, and `parent` and `top` are ordinary variable names:
   *
   *     const parent = node.parentElement;  parent.appendChild(child);
   *     const top = rect.top;               top.toFixed(1);
   *
   * Telling those from the globals needs scope analysis, which means a parser,
   * which is far more machinery than this layer is worth — because this layer
   * is not what makes the sandbox safe. The runtime boundary is, and it holds
   * independently of anything a model writes:
   *
   *   read the parent DOM      `allow-same-origin` is absent, so the frame has
   *                            an opaque origin and any cross-origin property
   *                            access throws. Browser-enforced.
   *   read parent storage      same-origin policy, and an opaque origin has no
   *                            storage of its own to reach from.
   *   navigate the parent      `allow-top-navigation` and its user-activation
   *                            variant are both absent from SANDBOX_TOKENS.
   *   send a trusted message   there is exactly one `message` listener in the
   *                            product, and `parsePreviewMessage` checks the
   *                            source object, the origin, the envelope, the
   *                            protocol version, and then accepts three bounded
   *                            shapes — ready, runtime-error, size. None grants
   *                            anything. The published view listens for nothing.
   *
   * So what remains here is the unambiguous form: an explicitly global access.
   * `window.parent` cannot be a local binding, and a model that writes it is
   * reaching for the embedder on purpose rather than naming a variable. That is
   * worth refusing with a clear message. The ambiguous form is left to the
   * runtime, which was always the control that mattered.
   */
  {
    code: "frame_escape",
    pattern: /\b(?:window|globalThis|self|frames)\s*\.\s*(?:parent|top|opener)\b/,
    detail: "Reaching the embedding page is not allowed.",
    // Strings, template literals and comments are blanked first, so a sentence
    // that happens to contain "window.top" in prose is not a violation.
    codeOnly: true,
    // Record what actually matched. Three generations were refused by this rule
    // and none of them said which characters tripped it, so none could be
    // diagnosed without spending another provider request.
    evidence: true,
  },
  { code: "network", pattern: /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/, detail: "Network access is not available to a generated app." },
  { code: "network", pattern: /navigator\.sendBeacon/, detail: "Network access is not available to a generated app." },
  { code: "storage", pattern: /\b(?:localStorage|sessionStorage|indexedDB)\b/, detail: "Persistent storage is not available; use React state." },
  { code: "cookies", pattern: /document\.cookie/, detail: "Cookies are not available to a generated app." },
  { code: "import_meta", pattern: /\bimport\.meta\b/, detail: "import.meta is not available." },
  { code: "service_worker", pattern: /navigator\.serviceWorker/, detail: "Service workers are not allowed." },
  { code: "dynamic_code", pattern: COMPUTED_IMPORT, detail: "Dynamic import() must use a literal specifier." },
  { code: "require", pattern: REQUIRE_CALL, detail: "require() is not available; use ES imports." },
  /**
   * Remote media, refused at the gate rather than at the browser.
   *
   * A live generation hardcoded nine Unsplash avatar URLs. CSP blocked every
   * one — no bytes left the machine, the boundary did exactly its job — and
   * the app rendered nine broken-image icons. The security control worked and
   * the product still looked broken, which is the argument for catching it
   * here: a URL nobody approved is not something to render half of.
   *
   * Scoped to media positions on purpose. An earlier draft refused every
   * `https://` in source and would have rejected a footer link to the
   * company's own Instagram, which is not a fetch and not a defect. What is
   * refused is a remote URL in a position the browser will *load*: an image or
   * media element's source, or a CSS url().
   */
  {
    code: "remote_media",
    pattern: /(?:src|srcSet|srcset|poster)\s*=\s*["'`{\s]*["'`]?https?:\/\//,
    detail: "External media URLs are not available. Use a Ventrio asset id, or compose without an image.",
  },
  {
    code: "remote_media",
    pattern: /url\(\s*["']?https?:\/\//,
    detail: "External media URLs are not available. Use a Ventrio asset id, or compose without an image.",
  },
  {
    code: "remote_media",
    pattern: /\b(?:backgroundImage|background)\s*:\s*[`"'][^`"']*https?:\/\//,
    detail: "External media URLs are not available. Use a Ventrio asset id, or compose without an image.",
  },
];

/**
 * Validates a generated project.
 *
 * Returns the typed bundle or every reason it was refused, up to a cap — one
 * screenful of specific problems is actionable, four hundred is not.
 */
export function validateGeneratedApp(value: unknown): AppValidation {
  const issues = new Issues();

  if (!isRecord(value)) {
    return { ok: false, issues: [{ path: "$", code: "not_an_object", detail: "The bundle must be a JSON object." }] };
  }
  if (value.schemaVersion !== APP_SCHEMA_VERSION) {
    return { ok: false, issues: [{ path: "$.schemaVersion", code: "bad_version", detail: `Expected "${APP_SCHEMA_VERSION}".` }] };
  }

  // Unknown top-level keys are refused rather than ignored: a model that
  // invents a field is telling us it believes in a capability we do not have,
  // and ignoring it means shipping a project built on that belief.
  const KNOWN = new Set(["schemaVersion", "metadata", "runtime", "routes", "files", "assets"]);
  for (const key of Object.keys(value)) {
    if (!KNOWN.has(key)) issues.add(`$.${key}`, "unknown_key", `"${key}" is not part of the contract.`);
  }

  /* ── metadata ──────────────────────────────────────────────────────────── */
  const metadata = isRecord(value.metadata) ? value.metadata : null;
  if (!metadata) {
    issues.add("$.metadata", "missing", "metadata is required.");
  } else {
    if (!str(metadata.name, APP_BUDGETS.maxNameChars)) issues.add("$.metadata.name", "bad_value", "A name is required.");
    if (!str(metadata.description, APP_BUDGETS.maxDescriptionChars)) issues.add("$.metadata.description", "bad_value", "A description is required.");
    if (!str(metadata.locale, 16)) issues.add("$.metadata.locale", "bad_value", "A locale is required.");
  }

  /* ── runtime ───────────────────────────────────────────────────────────── */
  const runtime = isRecord(value.runtime) ? value.runtime : null;
  let template: string | null = null;
  if (!runtime) {
    issues.add("$.runtime", "missing", "runtime is required.");
  } else {
    template = str(runtime.template, 40);
    if (!template || !isRuntimeTemplate(template)) {
      issues.add("$.runtime.template", "bad_template", `Unknown runtime template. Available: ${Object.keys(RUNTIME_TEMPLATES).join(", ")}.`);
      template = null;
    }
    const deps = runtime.dependencies;
    if (!Array.isArray(deps)) {
      issues.add("$.runtime.dependencies", "bad_value", "dependencies must be an array.");
    } else if (deps.length > APP_BUDGETS.maxDependencies) {
      issues.add("$.runtime.dependencies", "budget_dependencies", `${deps.length} exceeds ${APP_BUDGETS.maxDependencies}.`);
    } else {
      for (const dep of deps) {
        if (typeof dep !== "string" || !isAllowedDependency(dep)) {
          issues.add("$.runtime.dependencies", "dependency_not_allowed", `"${String(dep)}" is not in the Ventrio runtime.`);
        }
      }
    }
  }

  /* ── files and paths ───────────────────────────────────────────────────── */
  const files = isRecord(value.files) ? value.files : null;
  const paths: string[] = [];
  let totalBytes = 0;

  if (!files) {
    issues.add("$.files", "missing", "files is required.");
  } else {
    const entries = Object.entries(files);
    if (entries.length === 0) issues.add("$.files", "empty", "A project needs at least one file.");
    if (entries.length > APP_BUDGETS.maxFiles) {
      issues.add("$.files", "budget_files", `${entries.length} files exceeds ${APP_BUDGETS.maxFiles}.`);
    }
    for (const [path, source] of entries) {
      const pathIssue = validatePath(path);
      if (pathIssue) {
        issues.add(`$.files["${path}"]`, pathIssue.code, pathIssue.detail);
        continue;
      }
      if (typeof source !== "string") {
        issues.add(`$.files["${path}"]`, "bad_value", "File contents must be a string.");
        continue;
      }
      const bytes = Buffer.byteLength(source, "utf8");
      if (bytes > APP_BUDGETS.maxFileBytes) {
        issues.add(`$.files["${path}"]`, "budget_file_bytes", `${bytes} B exceeds ${APP_BUDGETS.maxFileBytes} B.`);
        continue;
      }
      totalBytes += bytes;
      paths.push(path);
    }
    if (totalBytes > APP_BUDGETS.maxTotalSourceBytes) {
      issues.add("$.files", "budget_total_bytes", `${totalBytes} B exceeds ${APP_BUDGETS.maxTotalSourceBytes} B.`);
    }
  }

  /* ── source content ────────────────────────────────────────────────────── */
  // Only over files that already passed the path and size checks above.
  if (files) {
    const known = new Set(paths);
    for (const path of paths) {
      const source = files[path] as string;
      // Stylesheets are scanned for remote media only: the JavaScript rules
      // below do not apply to CSS, but `url(https://…)` very much does.
      if (/\.css$/.test(path)) {
        for (const rule of FORBIDDEN_SOURCE) {
          if (rule.code === "remote_media" && rule.pattern.test(source)) {
            issues.add(`$.files["${path}"]`, rule.code, rule.detail);
          }
        }
        continue;
      }
      if (!/\.(tsx|ts|jsx|js)$/.test(path)) continue;

      // Computed once and only if some rule wants it; most read the raw source.
      let stripped: string | null = null;
      for (const rule of FORBIDDEN_SOURCE) {
        const text = rule.codeOnly ? (stripped ??= codeOnly(source)) : source;
        if (!rule.evidence) {
          if (rule.pattern.test(text)) issues.add(`$.files["${path}"]`, rule.code, rule.detail);
          continue;
        }
        const match = rule.pattern.exec(text);
        if (match) {
          issues.add(`$.files["${path}"]`, rule.code, `${rule.detail} ${quoteMatch(source, match.index, match[0].length)}`);
        }
      }

      for (const specifier of specifiersIn(source)) {
        if (specifier.startsWith(".")) {
          const resolved = resolveRelative(path, specifier);
          if (!resolved) {
            issues.add(`$.files["${path}"]`, "import_escapes", `"${specifier}" resolves outside the project.`);
          } else if (!known.has(resolved) && !known.has(`${resolved}.tsx`) && !known.has(`${resolved}.ts`)
            && !known.has(`${resolved}.jsx`) && !known.has(`${resolved}.js`)
            && !known.has(`${resolved}/index.tsx`) && !known.has(`${resolved}/index.ts`)) {
            issues.add(`$.files["${path}"]`, "import_missing", `"${specifier}" does not exist in the project.`);
          }
          continue;
        }
        if (specifier.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(specifier)) {
          issues.add(`$.files["${path}"]`, "import_not_local", `"${specifier}" must be a project file or an allowed library.`);
          continue;
        }
        if (!isAllowedImport(specifier)) {
          issues.add(`$.files["${path}"]`, "import_not_allowed", `"${specifier}" is not in the Ventrio runtime.`);
        }
      }
    }
  }

  /* ── routes ────────────────────────────────────────────────────────────── */
  const routes = Array.isArray(value.routes) ? value.routes : null;
  if (!routes) {
    issues.add("$.routes", "missing", "routes is required.");
  } else if (routes.length === 0) {
    issues.add("$.routes", "empty", "A project needs at least one route.");
  } else if (routes.length > APP_BUDGETS.maxRoutes) {
    issues.add("$.routes", "budget_routes", `${routes.length} exceeds ${APP_BUDGETS.maxRoutes}.`);
  } else {
    const seen = new Set<string>();
    for (const [i, entry] of routes.entries()) {
      const at = `$.routes[${i}]`;
      if (!isRecord(entry)) { issues.add(at, "bad_value", "Each route must be an object."); continue; }
      const path = str(entry.path, 120);
      if (!path || !path.startsWith("/") || path.includes("://") || path.includes("..")) {
        issues.add(`${at}.path`, "bad_route_path", "A route path must be internal and begin with \"/\".");
      } else if (seen.has(path)) {
        issues.add(`${at}.path`, "duplicate_route", `"${path}" is declared twice.`);
      } else {
        seen.add(path);
      }
      if (!str(entry.title, 160)) issues.add(`${at}.title`, "bad_value", "A route title is required.");
      const routeModule = str(entry.module, APP_BUDGETS.maxPathLength);
      if (!routeModule) {
        issues.add(`${at}.module`, "bad_value", "A route module is required.");
      } else if (files && !paths.includes(routeModule)) {
        issues.add(`${at}.module`, "module_missing", `"${routeModule}" is not a file in this project.`);
      }
    }
  }

  /* ── the template's own requirements ───────────────────────────────────── */
  if (template && isRuntimeTemplate(template) && files) {
    const root = RUNTIME_TEMPLATES[template].root;
    if (!paths.includes(root)) {
      issues.add("$.files", "root_missing", `The "${template}" template mounts ${root}, which is missing.`);
    }
    // The entry is Ventrio's, so a model supplying one is refused rather than
    // overwritten — an overwrite would hide the disagreement.
    const entry = RUNTIME_TEMPLATES[template].entry;
    if (paths.includes(entry)) {
      issues.add(`$.files["${entry}"]`, "entry_reserved", `${entry} is generated by Ventrio.`);
    }
  }

  /* ── assets ────────────────────────────────────────────────────────────── */
  if (value.assets !== undefined) {
    if (!Array.isArray(value.assets)) {
      issues.add("$.assets", "bad_value", "assets must be an array of ids.");
    } else if (value.assets.length > APP_BUDGETS.maxAssets) {
      issues.add("$.assets", "budget_assets", `${value.assets.length} exceeds ${APP_BUDGETS.maxAssets}.`);
    } else {
      for (const id of value.assets) {
        if (typeof id !== "string" || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(id)) {
          issues.add("$.assets", "bad_asset_id", `"${String(id)}" is not a valid asset id.`);
        }
      }
    }
  }

  if (issues.any) return { ok: false, issues: issues.list };
  return { ok: true, app: value as unknown as GeneratedAppV1 };
}

/**
 * Resolves a relative import against the importing file.
 *
 * Returns null when the result climbs out of the project, which is the only
 * outcome that matters for safety — the bundler would resolve it against the
 * real filesystem, and "outside the project" there means our source tree.
 */
function resolveRelative(from: string, specifier: string): string | null {
  const base = from.split("/").slice(0, -1);
  const parts = specifier.split("/");
  const out = [...base];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (out.length === 0) return null;
      out.pop();
      continue;
    }
    out.push(part);
  }
  if (out.length === 0) return null;
  const joined = out.join("/");
  // Must still be inside an allowed root after resolution.
  return joined.startsWith("src/") || joined.startsWith("public/") ? joined : null;
}
