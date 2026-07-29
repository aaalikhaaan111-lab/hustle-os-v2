// Built per-request (needs a fresh nonce every time) rather than as a static
// next.config.ts header — see src/proxy.ts, the only caller.
//
// style-src keeps 'unsafe-inline' deliberately: the app renders React inline
// `style={{...}}` attributes (dynamic project theming, progress bars, etc.),
// and CSP nonces only cover <style> elements, not the style="" attribute —
// there is no nonce-based way to allow those without rewriting them to CSS
// classes, which is out of scope here.
export function buildCspHeader(nonce: string, isProd: boolean): string {
  const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isProd ? "" : " 'unsafe-eval'"}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' https://i.ytimg.com`,
    `font-src 'self'`,
    `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
    `frame-src https://www.youtube.com`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    ...(isProd ? ["upgrade-insecure-requests"] : []),
  ];

  return directives.join("; ");
}
