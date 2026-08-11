import "server-only";

/**
 * Compiling the Tailwind a generated project actually wrote.
 *
 * THE DEFECT THIS FIXES. Three paid Gemini generations all composed in
 * Tailwind — the setlist app carried 268 `className` attributes, 233 of them
 * utilities — and declared `@tailwind base/components/utilities` at the top of
 * its stylesheet. esbuild passes an unknown at-rule through untouched and
 * warns about nothing, so every one of those classes resolved to no CSS at
 * all. The apps worked and rendered as unstyled documents, identically at
 * 390 px and 1440 px, and the pipeline reported zero warnings while it
 * happened. Nothing was broken; everything was inert.
 *
 * WHAT RUNS HERE. Tailwind's own compiler, in process, over the virtual
 * project — no CDN, no external stylesheet, no browser-side compiler, no
 * script injected into the sandbox. The candidate list comes from scanning the
 * generated files with Tailwind's own scanner rather than from any list of
 * classes written here: a hard-coded list would silently miss whatever the
 * next model invents, which is the same class of failure as the one above.
 *
 * WHEN IT RUNS. When the project declares Tailwind, or when it plainly uses it
 * and forgot to say so. A project that uses neither is left byte-identical —
 * Tailwind's preflight resets margins and list styles, and injecting that into
 * hand-written CSS would restyle a project that never asked for it.
 */

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compile } from "tailwindcss";
import { Scanner } from "@tailwindcss/oxide";

/**
 * How many real utility rules an undeclared project must produce before
 * Tailwind is applied anyway.
 *
 * Not zero, because "did any candidate happen to match a utility name" is true
 * of almost any codebase — `grid`, `container` and `border` are ordinary words.
 * A project genuinely built on Tailwind produces hundreds.
 */
export const TAILWIND_AUTODETECT_MINIMUM = 12;

/** Files whose text is scanned for class candidates. Stylesheets are not. */
const SCANNABLE = /\.(tsx|ts|jsx|js)$/;

/**
 * Every form of "this stylesheet wants Tailwind", and there are three.
 *
 * Models write whichever their training favoured, and the paid generations
 * used two different ones: the `@tailwind` directive trio, and v3's
 * `@import "tailwindcss/base"` trio. Neither exists in v4, which takes a
 * single `@import "tailwindcss"` — and `tailwindcss/base.css` is not a file
 * v4 ships, so leaving the legacy names to be resolved fails the build with a
 * message about a missing stylesheet rather than about the real mismatch.
 */
const DIRECTIVE = /@tailwind\s+(?:base|components|utilities|screens|variants)\s*;/g;
const LEGACY_IMPORT = /@import\s+["']tailwindcss\/(?:base|components|utilities|screens|variants)["']\s*;?/g;
const V4_IMPORT = /@import\s+["']tailwindcss["']/;

export interface TailwindOutcome {
  css: string;
  applied: boolean;
  /** Why it did or did not run, for the compile report. */
  reason: "declared" | "detected" | "not-used";
  candidates: number;
  utilityRules: number;
  bytes: number;
}

export class TailwindCompileError extends Error {}

/**
 * Resolves a stylesheet import inside the generated CSS.
 *
 * Only Tailwind's own package is resolvable. A generated `@import` of anything
 * else is refused rather than fetched or read: the CSS is model-authored, and
 * an import is a path into this machine. The URL and network restrictions the
 * validator enforces do not stop existing here.
 */
function stylesheetLoader() {
  /**
   * Resolved from the project root, not from this module.
   *
   * `createRequire(import.meta.url)` works when this file is a real path on
   * disk — which it is under tsx, where every offline test passed. Inside
   * Next's server bundle it is not: the module's URL is a bundler-internal
   * location with no node_modules above it, and the first staging generation
   * failed with "tailwindcss/index.css could not be read on the server" after
   * spending two Gemini requests. The package root is stable in both.
   */
  const require_ = createRequire(join(process.cwd(), "package.json"));
  return async (id: string, base: string) => {
    const wanted = id.replace(/^["']|["']$/g, "");
    if (wanted !== "tailwindcss" && !wanted.startsWith("tailwindcss/")) {
      throw new TailwindCompileError(
        `The stylesheet imports "${wanted}". Only "tailwindcss" can be imported; put ordinary CSS in the file.`,
      );
    }
    const target = wanted === "tailwindcss" ? "tailwindcss/index.css" : `${wanted}.css`.replace(/\.css\.css$/, ".css");
    try {
      return { path: target, base, content: readFileSync(require_.resolve(target), "utf8") };
    } catch {
      throw new TailwindCompileError(`Tailwind's stylesheet "${target}" could not be read on the server.`);
    }
  };
}

/**
 * Rewrites the legacy directives into the one v4 understands.
 *
 * The models write v3 syntax — three `@tailwind` lines — because that is what
 * most of the training data says. v4 takes a single import. The first
 * directive becomes that import so authored rules keep their position relative
 * to it, and the rest are removed rather than left inert, which is the whole
 * point of this file.
 */
export function normaliseDirectives(css: string): { css: string; declared: boolean } {
  DIRECTIVE.lastIndex = 0;
  LEGACY_IMPORT.lastIndex = 0;
  const hasLegacy = DIRECTIVE.test(css) || LEGACY_IMPORT.test(css);
  DIRECTIVE.lastIndex = 0;
  LEGACY_IMPORT.lastIndex = 0;

  if (!hasLegacy) return { css, declared: V4_IMPORT.test(css) };

  // The first legacy declaration of either kind becomes the v4 import so
  // authored rules keep their position relative to it; the rest are removed
  // rather than left inert, which is the whole point of this file.
  let first = !V4_IMPORT.test(css);
  const take = () => {
    if (!first) return "";
    first = false;
    return '@import "tailwindcss";';
  };
  const rewritten = css.replace(DIRECTIVE, take).replace(LEGACY_IMPORT, take);
  return { css: rewritten, declared: true };
}

/** Class candidates, from the project's own source, via Tailwind's scanner. */
export function scanCandidates(files: Record<string, string>): string[] {
  const scanner = new Scanner({ sources: [] });
  const inputs = Object.entries(files)
    .filter(([path]) => SCANNABLE.test(path))
    .map(([path, content]) => ({ content, extension: path.split(".").pop() ?? "tsx" }));
  if (inputs.length === 0) return [];
  return scanner.scanFiles(inputs);
}

/** Counts the rules Tailwind actually emitted, as a measure of "is it used". */
function countUtilityRules(css: string): number {
  const layer = css.indexOf("@layer utilities");
  if (layer < 0) return 0;
  return (css.slice(layer).match(/^\s{2}\.[^\s{]+[^{]*\{/gm) ?? []).length;
}

/**
 * Compiles the project's stylesheet, resolving Tailwind if the project uses it.
 *
 * Throws `TailwindCompileError` on any failure. The caller turns that into a
 * compile diagnostic and refuses the project: a stylesheet that cannot be
 * built is not something to ship half of, and shipping the un-compiled version
 * is exactly the silent inertness this replaces.
 */
export async function compileProjectCss(
  files: Record<string, string>,
  bundledCss: string,
): Promise<TailwindOutcome> {
  const { css: entry, declared } = normaliseDirectives(bundledCss);
  const candidates = scanCandidates(files);

  // Nothing to do for a project with no stylesheet and no classes.
  if (!declared && candidates.length === 0) {
    return { css: bundledCss, applied: false, reason: "not-used", candidates: 0, utilityRules: 0, bytes: Buffer.byteLength(bundledCss, "utf8") };
  }

  const source = declared ? entry : `@import "tailwindcss";\n${entry}`;

  let built: string;
  try {
    const compiler = await compile(source, { base: "/", loadStylesheet: stylesheetLoader() });
    built = compiler.build(candidates);
  } catch (error) {
    if (error instanceof TailwindCompileError) throw error;
    throw new TailwindCompileError(
      `Tailwind could not compile the project's stylesheet: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }

  const utilityRules = countUtilityRules(built);

  // Undeclared and barely used: leave the authored CSS exactly as it was
  // rather than resetting a project that never asked for Tailwind.
  if (!declared && utilityRules < TAILWIND_AUTODETECT_MINIMUM) {
    return { css: bundledCss, applied: false, reason: "not-used", candidates: candidates.length, utilityRules, bytes: Buffer.byteLength(bundledCss, "utf8") };
  }

  if (/@tailwind\s/.test(built)) {
    // Unreachable unless the rewrite above missed a form. Refused rather than
    // shipped, because an inert directive is the defect this file exists for.
    throw new TailwindCompileError("A @tailwind directive survived compilation.");
  }

  return {
    css: built,
    applied: true,
    reason: declared ? "declared" : "detected",
    candidates: candidates.length,
    utilityRules,
    bytes: Buffer.byteLength(built, "utf8"),
  };
}
