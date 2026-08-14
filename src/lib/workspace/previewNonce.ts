/**
 * Keeping the preview document runnable after a client-side refresh.
 *
 * THE BUG THIS EXISTS TO FIX. A `srcdoc` frame inherits the embedding page's
 * Content-Security-Policy, and that policy is a response header — fixed for the
 * life of the document. Ventrio's policy allows scripts only by nonce, and
 * `'strict-dynamic'` makes `'self'` inert, so the nonce is the only way in.
 *
 * The preview document is rebuilt by the server on every render, taking the
 * nonce from `headers()` of whichever request is rendering. `router.refresh()`
 * — which the workspace fires the moment a generation succeeds — is a NEW
 * request with a NEW nonce. The page still trusts only the nonce it was served
 * with, so the refreshed document's scripts are refused: the stylesheet
 * applies, React never mounts, and the frame shows the app's background colour
 * and nothing else. Reloading just the frame re-parses the same rejected
 * document, which is why only a full page load looked like a cure.
 *
 * THE FIX. Re-stamp the document with the nonce the live page actually runs
 * under, read from a script the page is already executing.
 *
 * This grants nothing new. The nonce written is the one the page's own CSP
 * already trusts; none is invented, and the sandbox attributes, the inner CSP
 * and the opaque origin are untouched. On the first render the two values are
 * identical and the document is returned as-is, so the path that already worked
 * is unchanged and there is no hydration mismatch.
 */

/** The nonce shape the middleware emits: base64 of a UUID. */
const NONCE_ATTRIBUTE = / nonce="([A-Za-z0-9+/_=-]{16,256})"/;

/**
 * How the live nonce is found. Split out so a test can supply one without a DOM.
 *
 * Reads the IDL property rather than the attribute: browsers hide the content
 * attribute of `nonce` from `getAttribute`, and expose the value only on the
 * element itself.
 */
export function liveDocumentNonce(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce || undefined;
}

/**
 * The document with its nonce corrected to `live`.
 *
 * Returns the input unchanged when there is nothing to do: no live nonce to
 * read (server render, or a page served without one), no nonce in the document,
 * or the two already agree.
 *
 * Replaces the exact attribute string the builder wrote, so only the tags
 * `renderSandboxDocument` owns are touched. Model-authored markup is escaped
 * before it reaches the document and cannot carry a nonce attribute of its own.
 */
export function withLiveNonce(builtDocument: string, live = liveDocumentNonce()): string {
  if (!live) return builtDocument;
  const documentNonce = builtDocument.match(NONCE_ATTRIBUTE)?.[1];
  if (!documentNonce || documentNonce === live) return builtDocument;
  return builtDocument.replaceAll(` nonce="${documentNonce}"`, ` nonce="${live}"`);
}
