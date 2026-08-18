/**
 * The routes that mount `PublicShell`, and therefore already have a header.
 *
 * WHY THIS LIST EXISTS. `AppShell` mounts `StudioTopBar` on every route that is
 * not the landing page or the workspace. That was correct while the landing was
 * the only page with its own navigation — but now that every public page wears
 * the shared `PublicHeader`, the same rule puts TWO stacked headers on
 * /pricing, /about, /faq, /contact, the legal pages and both auth pages.
 *
 * The alternative was to let `AppShell` guess from the pathname with a growing
 * `||` chain, which is exactly how the site ended up with four headers in the
 * first place. One list, imported by both sides, so adding a public page is a
 * single edit and forgetting it is visible immediately.
 */
export const PUBLIC_SHELL_ROUTES = [
  "/",
  "/pricing",
  "/about",
  "/who-its-for",
  "/faq",
  "/contact",
  "/privacy",
  "/terms",
  "/cookies",
  "/ai-policy",
  "/refund-policy",
  "/login",
  "/signup",
] as const;

/** True when the route renders `PublicShell` and supplies its own header. */
export function carriesPublicShell(pathname: string): boolean {
  return (PUBLIC_SHELL_ROUTES as readonly string[]).includes(pathname);
}
