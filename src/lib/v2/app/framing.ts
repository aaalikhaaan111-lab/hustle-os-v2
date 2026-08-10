/**
 * The framed project format: metadata in JSON, file bodies as raw text.
 *
 * WHY THIS REPLACES THE JSON PAYLOAD. Eight live Gemini responses, six of them
 * unparseable, every failure the same shape: the model hand-escaping 25–100 kB
 * of source into JSON strings and slipping. `\'` in a JavaScript string. A raw
 * newline among hundreds of correct `\n`. Then `className="flex"` written with
 * bare quotes, which closes the string early and cannot be recovered without
 * guessing what was meant. A normaliser fixed the first two classes and the
 * third killed a whole generation anyway.
 *
 * The defect is structural, not a matter of a better parser: a format that
 * requires a model to escape every quote, backslash and newline in a TSX file
 * by hand will keep failing, because it asks for perfection over 100 kB.
 *
 * So file bodies stop being JSON. They are raw bytes between two markers that
 * own their lines, and nothing inside them needs escaping at all — JSX
 * attributes, nested template literals, regexes, CSS, JSON, Cyrillic, emoji
 * and markdown fences all travel verbatim.
 *
 * WHAT THIS IS NOT. It is not a relaxation. Every rule that existed still
 * runs: this module produces exactly the object shape `validateGeneratedApp`
 * and `applyPatch` already take, and they remain the authority on paths,
 * imports, budgets and forbidden APIs. Framing decides only where one file
 * ends and the next begins, and it refuses rather than guesses:
 *
 *   - markers must be alone on their line, matched exactly;
 *   - an end marker must name the same path its start marker did, so a
 *     reordered or nested block is a refusal rather than a silent merge;
 *   - a file body may not contain the marker prefix anywhere;
 *   - the manifest and the bodies must agree exactly, both directions;
 *   - end of input inside a block is a refusal — which is what a truncated
 *     response looks like, and it must never be salvaged into a partial file.
 *
 * No length prefixes: a model that has to count bytes will miscount. No
 * base64: it makes every response unreadable to the human debugging it.
 */

import { APP_BUDGETS, validatePath } from "./contract";
import { parseModelJsonSafe } from "../json/modelJson";

/** Everything Ventrio owns in this format starts with this. */
export const MARKER_PREFIX = "<<<VENTRIO:";

export const PROJECT_OPEN = "<<<VENTRIO:PROJECT>>>";
export const PROJECT_CLOSE = "<<<VENTRIO:END-PROJECT>>>";
export const PATCH_OPEN = "<<<VENTRIO:PATCH>>>";
export const PATCH_CLOSE = "<<<VENTRIO:END-PATCH>>>";

export const fileOpen = (path: string) => `${MARKER_PREFIX}FILE ${path}>>>`;
export const fileClose = (path: string) => `${MARKER_PREFIX}END-FILE ${path}>>>`;

const FILE_OPEN_RE = /^<<<VENTRIO:FILE (.+)>>>$/;
const FILE_CLOSE_RE = /^<<<VENTRIO:END-FILE (.+)>>>$/;

export interface FramingIssue {
  /** Where the problem is: a path, or a line number for structural faults. */
  path: string;
  code: string;
  detail: string;
}

export type FramedResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: FramingIssue[] };

const MAX_ISSUES = 20;

class Issues {
  readonly list: FramingIssue[] = [];
  add(path: string, code: string, detail: string): void {
    if (this.list.length < MAX_ISSUES) this.list.push({ path, code, detail });
  }
  get any(): boolean { return this.list.length > 0; }
}

/** A marker line, with the carriage return a Windows-minded model may add. */
function markerLine(line: string): string {
  return line.endsWith("\r") ? line.slice(0, -1) : line;
}

interface Block { path: string; body: string; startLine: number }

interface Framed {
  header: unknown;
  blocks: Block[];
}

/**
 * Splits a framed document into its header and file blocks.
 *
 * Shared by the project and patch formats, which differ only in the tags
 * around the header and in what that header means.
 */
/**
 * Drops a markdown fence wrapped around the whole response.
 *
 * The prompt forbids one and models add it anyway — every codegen canary
 * response did. A fence around the entire document is transport encoding, not
 * content: it is removed only when it opens the first non-blank line and
 * closes the last, so a fence *inside* a file body is untouched and stays part
 * of the file, which is exactly where fences legitimately appear.
 */
function stripOuterFence(text: string): string {
  const lines = text.split("\n");
  let first = 0;
  while (first < lines.length && lines[first].trim() === "") first++;
  let last = lines.length - 1;
  while (last > first && lines[last].trim() === "") last--;
  if (first >= last) return text;
  if (!/^```[a-z]*$/i.test(lines[first].trim()) || lines[last].trim() !== "```") return text;
  return lines.slice(first + 1, last).join("\n");
}

function splitFrames(text: string, open: string, close: string, issues: Issues): Framed | null {
  const lines = stripOuterFence(text).split("\n");
  let i = 0;

  // Leading blank lines are tolerated; anything else before the header is not.
  while (i < lines.length && markerLine(lines[i]).trim() === "") i++;
  if (i >= lines.length || markerLine(lines[i]).trim() !== open) {
    issues.add(`line ${i + 1}`, "header_missing", `The response must begin with ${open}.`);
    return null;
  }
  i++;

  const headerLines: string[] = [];
  let headerClosed = false;
  for (; i < lines.length; i++) {
    const line = markerLine(lines[i]).trim();
    if (line === close) { headerClosed = true; i++; break; }
    if (line.startsWith(MARKER_PREFIX)) {
      issues.add(`line ${i + 1}`, "marker_unexpected", `Expected ${close} before any other marker.`);
      return null;
    }
    headerLines.push(lines[i]);
  }
  if (!headerClosed) {
    issues.add(`line ${i}`, "header_unterminated", `The header was never closed with ${close}.`);
    return null;
  }

  const parsedHeader = parseModelJsonSafe(headerLines.join("\n"));
  if (!parsedHeader.ok) {
    issues.add("$", "header_malformed", `The header is not valid JSON: ${parsedHeader.error}`);
    return null;
  }

  const blocks: Block[] = [];
  const seen = new Set<string>();

  while (i < lines.length) {
    const raw = markerLine(lines[i]);
    if (raw.trim() === "") { i++; continue; }

    const opened = FILE_OPEN_RE.exec(raw.trim());
    if (!opened) {
      issues.add(
        `line ${i + 1}`,
        raw.trim().startsWith(MARKER_PREFIX) ? "marker_unknown" : "content_outside_file",
        `Expected a ${MARKER_PREFIX}FILE <path>>>> marker.`,
      );
      return null;
    }

    const path = opened[1].trim();
    const startLine = i + 1;
    i++;

    const body: string[] = [];
    let closed = false;
    for (; i < lines.length; i++) {
      const line = markerLine(lines[i]);
      const trimmed = line.trim();

      const closing = FILE_CLOSE_RE.exec(trimmed);
      if (closing) {
        const closingPath = closing[1].trim();
        if (closingPath !== path) {
          // A mismatched close is a reordered or nested block. Refused rather
          // than repaired: the alternative is silently attributing one file's
          // bytes to another file's name.
          issues.add(path, "marker_mismatched",
            `Block opened for "${path}" but closed for "${closingPath}".`);
          return null;
        }
        closed = true;
        i++;
        break;
      }

      if (trimmed.startsWith(MARKER_PREFIX) || line.includes(MARKER_PREFIX)) {
        issues.add(path, "marker_in_content",
          `File contents may not contain "${MARKER_PREFIX}" (line ${i + 1}).`);
        return null;
      }

      body.push(line);
    }

    if (!closed) {
      // What a truncated response looks like. Never salvaged into a partial
      // file: half a component that happens to parse is worse than a refusal.
      issues.add(path, "file_unterminated",
        `"${path}" was opened at line ${startLine} and never closed. The response may be truncated.`);
      return null;
    }

    if (seen.has(path)) {
      issues.add(path, "file_duplicate", `"${path}" appears more than once.`);
      return null;
    }
    seen.add(path);
    blocks.push({ path, body: body.join("\n"), startLine });
  }

  return { header: parsedHeader.value, blocks };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Checks the paths and budgets framing is responsible for.
 *
 * Deliberately duplicated with the validator rather than deferred to it: a
 * body attributed to a traversal path should never be assembled into a project
 * object at all, and the file-count and byte budgets exist so a runaway
 * response is refused before anything holds all of it in memory twice.
 */
function checkBlocks(blocks: Block[], manifest: string[], issues: Issues): Record<string, string> | null {
  if (blocks.length > APP_BUDGETS.maxFiles) {
    issues.add("$", "budget_files", `${blocks.length} files, over the ${APP_BUDGETS.maxFiles} limit.`);
    return null;
  }

  const files: Record<string, string> = {};
  let total = 0;

  for (const block of blocks) {
    const pathIssue = validatePath(block.path);
    if (pathIssue) {
      issues.add(block.path, pathIssue.code, pathIssue.detail);
      continue;
    }
    const bytes = Buffer.byteLength(block.body, "utf8");
    if (bytes > APP_BUDGETS.maxFileBytes) {
      issues.add(block.path, "budget_file_bytes", `${bytes} B, over the ${APP_BUDGETS.maxFileBytes} B limit.`);
      continue;
    }
    total += bytes;
    files[block.path] = block.body;
  }

  if (total > APP_BUDGETS.maxTotalSourceBytes) {
    issues.add("$", "budget_total_bytes", `${total} B of source, over the ${APP_BUDGETS.maxTotalSourceBytes} B limit.`);
  }

  // The manifest and the bodies must agree in both directions. A file present
  // in one and absent from the other is a response that lost track of itself.
  const delivered = new Set(Object.keys(files));
  for (const path of manifest) {
    if (!delivered.has(path)) {
      issues.add(path, "file_missing", `The manifest lists "${path}" but no block delivered it.`);
    }
  }
  const listed = new Set(manifest);
  for (const path of delivered) {
    if (!listed.has(path)) {
      issues.add(path, "file_unlisted", `"${path}" was delivered but is not in the manifest.`);
    }
  }

  return issues.any ? null : files;
}

/**
 * Parses a framed project into the object the validator already takes.
 *
 * The returned value is deliberately untyped: it goes straight to
 * `validateGeneratedApp`, which is the only thing entitled to call it a
 * `GeneratedAppV1`.
 */
export function parseFramedProject(text: string): FramedResult<unknown> {
  const issues = new Issues();
  const framed = splitFrames(text, PROJECT_OPEN, PROJECT_CLOSE, issues);
  if (!framed) return { ok: false, issues: issues.list };

  if (!isRecord(framed.header)) {
    return { ok: false, issues: [{ path: "$", code: "header_not_object", detail: "The header must be a JSON object." }] };
  }

  const manifest = framed.header.manifest;
  if (!Array.isArray(manifest) || manifest.some((entry) => typeof entry !== "string")) {
    return { ok: false, issues: [{ path: "$.manifest", code: "manifest_missing", detail: "The header needs a \"manifest\" array of file paths." }] };
  }
  const paths = manifest as string[];
  if (new Set(paths).size !== paths.length) {
    return { ok: false, issues: [{ path: "$.manifest", code: "manifest_duplicate", detail: "The manifest lists the same path twice." }] };
  }

  const files = checkBlocks(framed.blocks, paths, issues);
  if (!files) return { ok: false, issues: issues.list };

  // `manifest` is framing's own bookkeeping and is not part of the contract.
  const rest = { ...framed.header };
  delete rest.manifest;
  return { ok: true, value: { ...rest, files } };
}

/**
 * Parses a framed patch into the object `applyPatch` already takes.
 *
 * The header's `write` is a manifest of the files whose bodies follow, so the
 * same agreement check applies: a patch that announces a file and does not
 * send it, or sends one it did not announce, is refused.
 */
export function parseFramedPatch(text: string): FramedResult<unknown> {
  const issues = new Issues();
  const framed = splitFrames(text, PATCH_OPEN, PATCH_CLOSE, issues);
  if (!framed) return { ok: false, issues: issues.list };

  if (!isRecord(framed.header)) {
    return { ok: false, issues: [{ path: "$", code: "header_not_object", detail: "The header must be a JSON object." }] };
  }

  const announced = framed.header.write;
  if (announced !== undefined && (!Array.isArray(announced) || announced.some((entry) => typeof entry !== "string"))) {
    return { ok: false, issues: [{ path: "$.write", code: "manifest_malformed", detail: "\"write\" must be an array of paths." }] };
  }
  const paths = (announced as string[] | undefined) ?? [];
  if (new Set(paths).size !== paths.length) {
    return { ok: false, issues: [{ path: "$.write", code: "manifest_duplicate", detail: "The same path is listed twice." }] };
  }

  const files = checkBlocks(framed.blocks, paths, issues);
  if (!files) return { ok: false, issues: issues.list };

  // `write` becomes path → contents, which is the shape applyPatch validates.
  const rest = { ...framed.header };
  delete rest.write;
  return { ok: true, value: { ...rest, write: files } };
}

/**
 * Writes a project in the framed format.
 *
 * Used by the tests to prove round trips, and by the repair prompt to show a
 * model the files it is being asked to change in the same format it must
 * answer in.
 */
export function encodeFramedProject(header: Record<string, unknown>, files: Record<string, string>): string {
  const manifest = Object.keys(files);
  const parts = [
    PROJECT_OPEN,
    JSON.stringify({ ...header, manifest }, null, 2),
    PROJECT_CLOSE,
  ];
  for (const path of manifest) {
    parts.push(fileOpen(path), files[path], fileClose(path));
  }
  return `${parts.join("\n")}\n`;
}

/** The same, for a set of files shown as context rather than as a project. */
export function encodeFramedFiles(files: Record<string, string>): string {
  const parts: string[] = [];
  for (const [path, body] of Object.entries(files)) {
    parts.push(fileOpen(path), body, fileClose(path));
  }
  return parts.join("\n");
}
