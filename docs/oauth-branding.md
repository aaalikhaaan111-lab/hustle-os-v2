# Google sign-in branding

Real logins currently show the raw Supabase project domain
(`bggkxahxogcdidbrnutx.supabase.co`) and the obsolete product name **Hustle OS**.

**None of this is fixable in application code.** The code's only involvement is
choosing the provider and where to return afterwards:

```ts
// src/components/auth/GoogleSignInButton.tsx
supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } })
```

`redirectTo` already points at `ventrio.org/auth/callback`. Everything a person
reads on Google's screen comes from two consoles.

## What controls what

| What the person sees | Owned by | Changeable |
| --- | --- | --- |
| "Hustle OS" as the app name | Google Cloud → OAuth consent screen → *App name* | Yes, free, takes effect immediately |
| App logo on the consent screen | Google Cloud → OAuth consent screen → *App logo* | Yes, but a logo triggers Google **brand verification** (days to weeks) |
| Support / developer contact email | Google Cloud → OAuth consent screen | Yes, free |
| `bggkxahxogcdidbrnutx.supabase.co` in the URL and consent details | The OAuth **redirect host**, which is Supabase's auth domain | Only by configuring a Supabase **Custom Domain** (paid add-on) |
| Where the user lands after consent | Application code (`redirectTo`) | Already `ventrio.org` — nothing to do |

Verified against the live project on 2026-08-16: the Supabase URL is
`https://bggkxahxogcdidbrnutx.supabase.co`, i.e. **no custom domain is
configured**, so Google is currently registered against
`https://bggkxahxogcdidbrnutx.supabase.co/auth/v1/callback`.

## Checklist — Google Cloud Console

Do this first. It removes the wrong product name, costs nothing, and is
independent of the domain work.

1. Google Cloud Console → select the project holding the OAuth client.
2. **APIs & Services → OAuth consent screen → Edit app**.
3. *App name*: `Hustle OS` → **`Ventrio`**.
4. *User support email*: an address on the Ventrio domain.
5. *App domain*:
   - Application home page: `https://ventrio.org`
   - Privacy policy: `https://ventrio.org/privacy`
   - Terms of service: `https://ventrio.org/terms`
   All three already exist and return 200.
6. *Authorised domains*: add `ventrio.org`. Keep `supabase.co` **while** the
   callback still points there — removing it breaks sign-in.
7. *Developer contact information*: a Ventrio address.
8. Save. The new name appears on the next sign-in; no redeploy.

**Do not** upload a logo in the same pass unless you are ready for verification
— submitting one moves the app into Google's brand-verification queue, and an
unverified app can show a warning interstitial in the meantime.

## Checklist — removing `supabase.co` (optional, paid)

Only a Supabase Custom Domain moves the callback off `*.supabase.co`. It is a
paid add-on per project.

1. Supabase Dashboard → **Project Settings → General → Custom Domains**.
2. Add e.g. `auth.ventrio.org`, and create the CNAME it asks for at the DNS
   host for `ventrio.org`.
3. Wait for Supabase to report the domain verified and the certificate issued.
4. Google Cloud → **Credentials → the OAuth 2.0 Client ID → Authorised
   redirect URIs**: add `https://auth.ventrio.org/auth/v1/callback`.
   Keep the old `https://bggkxahxogcdidbrnutx.supabase.co/auth/v1/callback`
   until step 6 is done and confirmed working.
5. Update `NEXT_PUBLIC_SUPABASE_URL` to `https://auth.ventrio.org` in Vercel
   **and** on the Railway worker, then redeploy both. The worker reads the same
   variable.
6. Sign in with Google end to end. Confirm the URL bar shows `auth.ventrio.org`.
7. Only then remove the old redirect URI from Google and `supabase.co` from
   *Authorised domains*.

Order matters: changing the Supabase URL before Google accepts the new redirect
URI breaks Google sign-in for everyone.

## Not worth changing

The repository and Vercel project are still named `hustle-os-v2`. That name is
not visible to users anywhere in the OAuth flow — it appears only in the git
remote and the deployment URL — and renaming it would invalidate existing
deployment links for no user-facing gain.

## Secrets

No OAuth client ID or secret needs to change for any of the above, and none was
read or modified while establishing this.
