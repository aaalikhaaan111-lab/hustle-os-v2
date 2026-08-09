// Built per-request (needs a fresh nonce every time) rather than as a static
// next.config.ts header — see src/proxy.ts, the only caller.
//
// style-src keeps 'unsafe-inline' deliberately: the app renders React inline
// `style={{...}}` attributes (dynamic project theming, progress bars, etc.),
// and CSP nonces only cover <style> elements, not the style="" attribute —
// there is no nonce-based way to allow those without rewriting them to CSS
// classes, which is out of scope here.
/**
 * The one route with a relaxed policy, and only outside production.
 *
 * The codegen preview mounts generated markup in an `<iframe sandbox="" srcdoc>`,
 * and two facts make an exception necessary on this route alone:
 *
 * 1. A srcdoc frame is matched against `frame-src`. Under the app-wide policy
 *    the frame is created but never populated — verified by controlled A/B, the
 *    identical frame renders with the exception and stays blank without it.
 * 2. A srcdoc document *inherits* its embedder's policy and the two intersect
 *    rather than override. So the inner `img-src data:` cannot admit anything
 *    this header excludes: without `data:` here a byte-validated PNG rendered
 *    as a broken image whatever the inner policy said.
 *
 * The relaxation is image-only and matched with `===`, not a prefix, so no
 * future route under /v2-gallery can inherit it by accident. `data:` is not
 * added to script-src, style-src, connect-src or anything else — a data: image
 * cannot execute, whereas data: on a script or frame source is a known bypass.
 */
export const CODEGEN_PREVIEW_PATH = "/v2-gallery/codegen";

export function buildCspHeader(nonce: string, isProd: boolean, pathname?: string): string {
  const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const isCodegenPreview = !isProd && pathname === CODEGEN_PREVIEW_PATH;

  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isProd ? "" : " 'unsafe-eval'"}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' https://i.ytimg.com${isCodegenPreview ? " data:" : ""}`,
    `font-src 'self'`,
    `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
    `frame-src ${isCodegenPreview ? "'self' " : ""}https://www.youtube.com`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    ...(isProd ? ["upgrade-insecure-requests"] : []),
  ];

  return directives.join("; ");
}
