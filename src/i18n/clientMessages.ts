/**
 * What the browser is allowed to be sent from the message bundle.
 *
 * WHY THIS EXISTS. `getMessages()` returns every namespace, and handing that
 * to `NextIntlClientProvider` serialises all of it into the HTML of every page.
 * Measured before this change: /privacy was 121 KB in English and 162 KB in
 * Russian — a page whose own text is a few KB — and the proof it was the bundle
 * was finding `analyticsScopeNote`, a workspace-only key, inlined in the markup
 * of the privacy page.
 *
 * The namespaces below are read only by Server Components, through
 * `getTranslations`, which resolves on the server and never touches this
 * provider. Removing them from the client payload therefore cannot change what
 * any page renders — it removes a copy nothing was reading.
 *
 * HOW THE LIST WAS DERIVED, and how to re-derive it. Every `"use client"` file
 * was scanned for `useTranslations("…")`; the namespaces below are the ones
 * that never appeared, and no file calls `useTranslations()` without a
 * namespace (which would need the whole bundle). If you add a client component
 * that reads one of these, delete it from this list — the symptom otherwise is
 * a MISSING_MESSAGE error at runtime, not a build failure.
 */
const SERVER_ONLY_NAMESPACES = [
  /** Terms, Privacy, Cookies, AI Policy — the largest single namespace. */
  "legal",
  /** About, FAQ, Who it's for. */
  "info",
  /** The /projects route's own server-rendered copy. */
  "projects",
  /** Read by generateMetadata, which is server-only by definition. */
  "metadata",
] as const;

/**
 * The bundle minus the namespaces no client component reads.
 *
 * Deliberately a subtraction rather than an allow-list of client namespaces: a
 * new client component that reads a new namespace keeps working, and only the
 * four names above are a decision anyone has to revisit.
 *
 * The return type is the input type rather than an `Omit<…>` of it. next-intl's
 * generated `IntlMessages` describes the whole bundle, and both the provider
 * and the `useTranslations` namespace autocomplete are typed against it — so
 * narrowing here would report every server-only namespace as unavailable to
 * Server Components that legitimately still read it through `getTranslations`.
 * What is removed is removed from the payload, not from the contract.
 */
export function clientMessages<T extends object>(messages: T): T {
  const trimmed: Record<string, unknown> = {};
  for (const [namespace, value] of Object.entries(messages)) {
    if ((SERVER_ONLY_NAMESPACES as readonly string[]).includes(namespace)) continue;
    trimmed[namespace] = value;
  }
  return trimmed as T;
}
