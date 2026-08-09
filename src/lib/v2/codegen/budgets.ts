/**
 * Hard numeric ceilings for a generated visual bundle.
 *
 * These are refusal thresholds, not hints. A bundle that exceeds any of them is
 * rejected outright rather than trimmed: truncating markup produces
 * unbalanced trees, and truncating CSS produces rules that style half a page,
 * and both failures look like renderer bugs when they are actually the model
 * overrunning a limit.
 *
 * The numbers are sized against the existing V2 fixtures — the largest compiled
 * fixture route serialises to roughly 18 KB of markup — so a well-behaved
 * bundle clears every budget with room to spare, and anything near the ceiling
 * is already anomalous.
 */
export const CODEGEN_BUDGETS = {
  /** Per route, measured on the model's raw markup before token expansion. */
  maxBodyHtmlBytes: 60_000,
  /**
   * Per route, measured after substitution AND media expansion.
   *
   * Far larger than the raw budget because the bytes it bounds are mostly
   * Ventrio's, not the model's: one base64 PNG runs to tens of kilobytes, so a
   * route placing three trusted assets legitimately dwarfs the markup that
   * positions them. The model is still held to `maxBodyHtmlBytes` on what it
   * actually wrote; this is a backstop on the finished document.
   */
  maxExpandedBodyHtmlBytes: 500_000,
  /** Media placements per route. Bounds expansion independently of bytes. */
  maxMediaPerRoute: 8,
  /** One stylesheet serves every route in the bundle. */
  maxCssBytes: 40_000,
  /** Elements per route. Counts start tags, so voids count once. */
  maxElementsPerRoute: 1_500,
  /** Nesting depth per route. Deep trees are a rendering hazard, not a style. */
  maxDepth: 20,
  /** Declaration blocks in the stylesheet, counted by `{`. */
  maxCssRules: 800,
  /** Routes per bundle. Matches the brief's own route ceiling. */
  maxRoutes: 4,
  /** Guards the whole payload before any per-part work happens. */
  maxBundleBytes: 300_000,
  /** Longest single substituted content value. */
  maxContentValueChars: 2_000,
  /** Entries in a content pack. */
  maxContentKeys: 400,
} as const;

export type CodegenBudgetName = keyof typeof CODEGEN_BUDGETS;
