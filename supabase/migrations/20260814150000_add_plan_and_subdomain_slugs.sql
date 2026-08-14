-- Two small things launch needs: a plan per account, and slugs that are valid
-- hostnames.
--
-- PLAN. One column, because one column is the whole of the billing state this
-- product needs. Everything asks `src/lib/billing/plans.ts` what a plan may do;
-- nothing asks whether someone is paying. Stripe's only job later is to keep
-- this column correct — no subscription table is invented here, because a
-- second record of the same fact is a second thing that can be wrong.
--
-- SLUGS AS HOSTNAMES. A published slug is now also a DNS label
-- (`[slug].ventrio.org`). DNS labels stop at 63 characters, so the 64 the
-- column allowed would have produced a perfectly good path and an unreachable
-- hostname. The reserved list grows for the same reason: it used to protect
-- Ventrio's routes, and now has to protect Ventrio's infrastructure too —
-- `www.ventrio.org` serving a stranger's application was claimable before this.
--
-- Existing rows are checked, not assumed: the length constraint is only
-- tightened after confirming nothing violates it.

begin;

/* ── plan ─────────────────────────────────────────────────────────────────── */

alter table public.profiles
  add column if not exists plan text not null default 'free';

alter table public.profiles
  drop constraint if exists profiles_plan_check;

alter table public.profiles
  add constraint profiles_plan_check check (plan in ('free', 'pro', 'studio'));

comment on column public.profiles.plan is
  'Billing plan. The only billing state Ventrio stores; Stripe updates it. See src/lib/billing/plans.ts.';

/* ── slugs are DNS labels ─────────────────────────────────────────────────── */

do $$
declare
  v_too_long integer;
begin
  select count(*) into v_too_long
  from public.project_publications
  where char_length(slug) > 63;

  if v_too_long > 0 then
    raise exception using
      errcode = '23514',
      message = format('%s published slug(s) exceed 63 characters; shorten them before applying', v_too_long);
  end if;
end;
$$;

alter table public.project_publications
  drop constraint if exists project_publications_slug_length_check;

alter table public.project_publications
  add constraint project_publications_slug_length_check
  check (char_length(slug) between 2 and 63);

-- Mirrors RESERVED_SLUGS in src/lib/publishing/slug.ts. The application gives
-- the better error; this is the one that cannot be bypassed.
alter table public.project_publications
  drop constraint if exists project_publications_slug_reserved_check;

alter table public.project_publications
  add constraint project_publications_slug_reserved_check
  check (
    slug <> all (
      array[
        -- Ventrio's own surfaces
        'admin', 'api', 'app', 'auth', 'account', 'billing', 'blog', 'build',
        'challenges', 'contact', 'cookies', 'courses', 'create', 'dashboard',
        'delete-account', 'docs', 'first-session', 'help', 'login',
        'onboarding', 'p', 'pay', 'pricing', 'privacy', 'profile', 'projects',
        'settings', 'signup', 'status', 'support', 'terms', 'workshops',
        -- Infrastructure and hosting
        'assets', 'cdn', 'dev', 'ftp', 'imap', 'mail', 'mx', 'ns1', 'ns2',
        'pop', 'smtp', 'staging', 'static', 'test', 'vercel', 'www'
      ]::text[]
    )
  );

commit;
