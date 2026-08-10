/**
 * Parsing JSON a model wrote, without pretending it wrote JSON.
 *
 * WHAT THIS IS FOR. Five of six paid Gemini responses were discarded as
 * unparseable, each one a complete 20–28k-token project, and every failure was
 * the same class: the model escaped *most* of a source file correctly and then
 * slipped. Two shapes, both observed:
 *
 *   - `'Sweet Child O\' Mine'` — a JavaScript escape inside a JSON string.
 *     `\'` is not a JSON escape, so the whole document is invalid.
 *   - a literal newline or tab inside a string, sitting among hundreds of
 *     correctly written `\n` escapes in the same file.
 *
 * Both are transport encoding defects. Neither changes what the model meant,
 * and neither is worth a second paid request.
 *
 * WHY A STATE MACHINE AND NOT A REGEX. A global replace cannot tell a newline
 * inside a string from the newline between two properties, or a `\'` inside a
 * string from a backslash-quote sequence in code that happens to be outside
 * one. Getting that wrong does not fail loudly — it silently rewrites the
 * document into a different one. So this walks the text once, tracks whether
 * it is inside a string and whether the previous character was an escape, and
 * only ever touches bytes it knows are inside a string literal.
 *
 * WHAT THIS IS NOT. It is not a lenient schema, and it decides nothing about
 * what the JSON is allowed to contain. Every gate downstream — the app
 * validator, the source scanner, the path rules, the import allowlist, the
 * compiler — runs unchanged on the result and remains the only authority. This
 * fixes the envelope; the contents are still guilty until proven innocent.
 */

/** JSON's complete set of legal escape characters. */
const LEGAL_ESCAPES = new Set(['"', "\\", "/", "b", "f", "n", "r", "t", "u"]);

/** The control characters JSON has a short escape for. */
const SHORT_ESCAPES: Record<string, string> = {
  "\n": "\\n",
  "\r": "\\r",
  "\t": "\\t",
  "\b": "\\b",
  "\f": "\\f",
};

export interface NormaliseReport {
  /** Raw control characters found inside string literals and escaped. */
  controlCharacters: number;
  /** Invalid escape sequences inside string literals, repaired. */
  invalidEscapes: number;
  /** Whether a markdown fence was stripped from around the document. */
  fenced: boolean;
}

/**
 * Strips a markdown fence, if the whole document is wrapped in one.
 *
 * A fence is transport encoding, not content. Anchored at both ends on
 * purpose: prose before or after the object stays a parse failure, because
 * that is a model answering in prose rather than a model wrapping its answer.
 */
function stripFence(text: string): { text: string; fenced: boolean } {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  return fenced ? { text: fenced[1], fenced: true } : { text: trimmed, fenced: false };
}

/**
 * Repairs the two defects, inside string literals only.
 *
 * Everything outside a string is copied through untouched — including the
 * newlines and indentation between properties, which are legal JSON whitespace
 * and must stay exactly as they are.
 */
export function normaliseModelJson(input: string): { text: string; report: NormaliseReport } {
  const { text, fenced } = stripFence(input);
  const out: string[] = [];
  const report: NormaliseReport = { controlCharacters: 0, invalidEscapes: 0, fenced };

  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (!inString) {
      // Outside a string a quote opens one; everything else is structure or
      // whitespace and is never rewritten.
      if (char === '"') inString = true;
      out.push(char);
      continue;
    }

    if (escaped) {
      escaped = false;
      if (LEGAL_ESCAPES.has(char)) {
        out.push(char);
        continue;
      }
      /**
       * An illegal escape: the backslash is content, so it is escaped.
       *
       * `\'` becomes `\\'`, which parses to the two characters `\'` — exactly
       * what the model wrote. The tempting alternative is to drop the
       * backslash and keep the quote, and it is wrong: the payload is source
       * code, and `'Sweet Child O\' Mine'` is a JavaScript string whose
       * backslash is load-bearing. Removing it produced valid JSON containing
       * a syntax error, which the replay caught — the project parsed and then
       * failed to compile at that exact character.
       */
      report.invalidEscapes += 1;
      out.pop();
      out.push("\\\\");
      out.push(char);
      continue;
    }

    if (char === "\\") {
      escaped = true;
      out.push(char);
      continue;
    }

    if (char === '"') {
      inString = false;
      out.push(char);
      continue;
    }

    // A raw control character inside a string is illegal JSON. Escaped rather
    // than deleted: it is real content — a newline in a source file — and
    // dropping it would silently change the code the model wrote.
    if (char < " ") {
      report.controlCharacters += 1;
      out.push(SHORT_ESCAPES[char] ?? `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`);
      continue;
    }

    out.push(char);
  }

  return { text: out.join(""), report };
}

export interface ParseOutcome {
  ok: boolean;
  value?: unknown;
  report: NormaliseReport;
  /** Whether the document parsed only after normalisation. */
  repaired: boolean;
  error?: string;
}

/**
 * Parses a model's JSON, normalising only if it has to.
 *
 * The strict parse is tried first, so a well-formed response takes exactly the
 * path it always did and the normaliser cannot affect it at all. Normalisation
 * is a fallback for documents that are already failing.
 */
export function parseModelJsonSafe(text: string): ParseOutcome {
  const { text: unfenced, fenced } = stripFence(text);
  const clean: NormaliseReport = { controlCharacters: 0, invalidEscapes: 0, fenced };

  try {
    return { ok: true, value: JSON.parse(unfenced), report: clean, repaired: false };
  } catch {
    // fall through to the repair attempt
  }

  const { text: normalised, report } = normaliseModelJson(text);
  try {
    return { ok: true, value: JSON.parse(normalised), report, repaired: true };
  } catch (error) {
    return {
      ok: false,
      report,
      repaired: false,
      error: error instanceof Error ? error.message : "The response was not valid JSON.",
    };
  }
}

/** The throwing form, for callers that already have a failure path. */
export function parseModelJson(text: string): unknown {
  const outcome = parseModelJsonSafe(text);
  if (!outcome.ok) throw new SyntaxError(outcome.error ?? "invalid JSON");
  return outcome.value;
}
