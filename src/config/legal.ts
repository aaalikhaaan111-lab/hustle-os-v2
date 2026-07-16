/**
 * Legal/operator configuration for public legal pages (Privacy, Terms, Cookies, Contact).
 *
 * IMPORTANT — PLACEHOLDER VALUES:
 * `operatorName`, `operatorCountry`, `operatorCity`, and `governingLaw` are NOT real
 * registered-business facts. Ventrio has not been confirmed as an incorporated legal
 * entity. These fields must be reviewed and completed by the product owner before the
 * legal pages are treated as final/production-accurate. Until then, the legal pages
 * render honest placeholder language (e.g. "operated by an individual / pre-incorporation
 * team") rather than falsely claiming incorporation.
 */
export const legalConfig = {
  productName: "Ventrio",
  /** PLACEHOLDER — replace with the real legal operator name once decided (individual or registered entity). */
  operatorName: "[OPERATOR NAME NOT YET CONFIRMED]",
  /** PLACEHOLDER — country of operation/jurisdiction. */
  operatorCountry: "[COUNTRY NOT YET CONFIRMED]",
  /** PLACEHOLDER — city of operation, if relevant to the jurisdiction statement. */
  operatorCity: "[CITY NOT YET CONFIRMED]",
  /** PLACEHOLDER — must be a real, monitored inbox before launch. */
  contactEmail: "support@ventrio.app",
  minimumAge: 13,
  /** PLACEHOLDER — set to the actual date these documents go live. */
  effectiveDate: "2026-07-16",
  /** PLACEHOLDER — governing law/jurisdiction for Terms of Use; requires a real business/legal decision. */
  governingLaw: "[GOVERNING LAW / JURISDICTION NOT YET CONFIRMED]",
} as const;
