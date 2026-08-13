/**
 * Operator details for the public legal pages (Privacy, Terms, Cookies, AI
 * Policy, Contact, Delete Account).
 *
 * These are the values the pages render, so changing one changes what Ventrio
 * publicly states about who operates it and under whose law. They were
 * placeholders until 2026-08-13 and rendered visibly as
 * "[OPERATOR NAME NOT YET CONFIRMED]" rather than guessing — the pages said
 * nothing they could not back. The values below were supplied by the product
 * owner.
 *
 * `contactEmail` appears on every legal page as the address for privacy
 * requests, deletion requests and reports of harmful output. It has to stay a
 * monitored inbox.
 */
export const legalConfig = {
  productName: "Ventrio",
  operatorName: "Ventrio",
  operatorCountry: "Kazakhstan",
  operatorCity: "Pavlodar",
  contactEmail: "founder@ventrio.org",
  minimumAge: 13,
  /** The date the current wording went live; update it when the text changes materially. */
  effectiveDate: "2026-08-13",
  governingLaw: "Laws of the Republic of Kazakhstan",
} as const;
