# Custom domains — not built, and what building them would take

Written 2026-08-05, alongside the production UX pass. Nothing here has been
implemented; this exists so the next person starts from the actual state of the
code rather than from an assumption that some of it is already in place.

## What exists today

Published projects are served from one origin, on a path:

    https://ventrio.org/p/<slug>

That is the whole of it. `src/app/p/[slug]` renders the published snapshot, and
the slug is the only address a project has. A search across `src/` and
`messages/` for "custom domain", `customDomain` and `custom_domain` returns
nothing — there is no partial implementation, no dormant column, no disabled
UI, and no copy that promises one.

The share link the workspace copies, and the one the publish dock shows, are
both built from `publicBaseUrl` plus the slug. Anything that changes a
project's address has to change them together, or the workspace will keep
handing people the old URL.

## Why it is its own phase

It is not a UI change. A custom domain touches infrastructure that the current
product does not have at all:

- **Domain ownership has to be proved** before serving anything, or the product
  becomes a way to point a hostname at someone else's content. That means
  issuing a verification record per domain and re-checking it, not trusting a
  form.
- **Certificates have to be issued and renewed** per hostname. Whoever hosts
  this has an API for that; it needs an account-level token, a place to store
  the domain's state machine (pending → verifying → active → failed), and a
  retry path when issuance fails or a renewal lapses.
- **Requests have to be routed by `Host`.** Today every request resolves to one
  origin and the slug does the work. Serving `example.com` means resolving a
  hostname to a project before rendering, which is a new lookup on the hot path
  for every public page view, and a new cache key.
- **The security headers are per-response and origin-aware.** `src/proxy.ts`
  builds a CSP with a per-request nonce; `frame-ancestors` and anything that
  names an origin need to be correct for a hostname that is not ventrio.org.
- **Publication state gains a dimension.** A project could be reachable at its
  slug, at a custom domain, at both, or at a domain whose certificate has
  lapsed. "Published" stops being a boolean, and the Draft/Live chip and the
  copy-link control both have to say which address they mean.
- **Removal has to be as reliable as setup.** A domain that is deleted, expired
  or repointed must stop resolving to the project, and the project must fall
  back to its slug rather than becoming unreachable.

## What was checked

This audit was limited to establishing that the feature genuinely does not
exist and that nothing in the current UI implies it does. The list above is the
shape of the work, not a plan: no provider API was called, no schema was
designed, and no estimate is offered.
