-- ============================================================================
-- Keep the name the identity provider already gave us, and stop a profile
-- failure from being a signup failure.
--
-- THE BUG. public.handle_new_user() has always inserted `values (new.id, null)`
-- — a hardcoded null display_name — while the row that triggers it carries the
-- user's real name in raw_user_meta_data. Measured on production 2026-08-20:
-- 21 of 29 auth users arrive with a name in their metadata (17 of them via
-- Google), and exactly 2 profiles have a display_name, both almost certainly
-- typed in by hand through Settings. The name was being read, ignored, and
-- discarded on every single signup since 2026-07-11.
--
-- It is visible in the product: src/app/dashboard/page.tsx and
-- src/app/projects/page.tsx fall back to `(user.email ?? "?").slice(0, 2)`, so
-- someone who signed in with Google and handed us "Alikhan K" gets an avatar
-- built from their email prefix instead.
--
-- THE KEY ORDER. Google and most OIDC providers populate `full_name` and
-- `name`; GitHub-style providers populate `user_name`; `preferred_username` is
-- the standard OIDC claim. Email signup has none of them, which is what the
-- email-prefix fallback is for. `nullif(btrim(...), '')` matters because a
-- provider that sends an empty string would otherwise beat a later key that has
-- a real value.
--
-- WHY `left(..., 80)`. src/components/profile/ProfileForm.tsx caps displayName
-- at 80 characters and updateProfileAction rejects anything longer. A name
-- stored above that limit would be a value the owner could see but never
-- re-save — the form would refuse their own name back. Clamping here keeps the
-- column and the form agreeing.
--
-- WHY THE EXCEPTION HANDLER. This trigger runs INSIDE the transaction that
-- inserts into auth.users. Anything it raises aborts that transaction, and the
-- user sees "Database error saving new user" — signup fails outright. Today the
-- only guarded case is a duplicate id; a NOT NULL column added to profiles
-- later, or a constraint, would turn a cosmetic problem into a total signup
-- outage. Catching and warning makes the profile row best-effort: the account
-- is always created, and a missed profile is recoverable afterwards (the
-- backfill at the bottom of this file is exactly that repair, run once).
--
-- That trade is deliberate and worth naming: it converts a loud failure into a
-- quiet one. The warning goes to the Postgres log, and the reconciliation query
-- in docs/disaster-recovery.md is how you find any row it left behind.
--
-- SECURITY IS UNCHANGED. Still SECURITY DEFINER with a pinned search_path,
-- which is what lets it write a table whose RLS has no INSERT policy at all.
-- The function still only ever writes a row keyed to NEW.id, so it cannot be
-- steered into writing somebody else's profile.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_name text;
begin
  resolved_name := left(
    nullif(
      btrim(
        coalesce(
          new.raw_user_meta_data ->> 'full_name',
          new.raw_user_meta_data ->> 'name',
          new.raw_user_meta_data ->> 'user_name',
          new.raw_user_meta_data ->> 'preferred_username',
          -- Email signup carries no name. The local part is not a name, but it
          -- is the person's own chosen handle and beats an empty panel.
          split_part(coalesce(new.email, ''), '@', 1)
        )
      ),
      ''
    ),
    80
  );

  insert into public.profiles (id, display_name)
  values (new.id, resolved_name)
  on conflict (id) do nothing;

  return new;
exception
  when others then
    raise warning 'handle_new_user: profile creation failed for % (%): %',
      new.id, sqlstate, sqlerrm;
    return new;
end;
$$;

-- The trigger itself is unchanged and is recreated only so this migration is
-- self-contained if replayed against a database that never had it.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Repair 1: the one auth user that has no profile row.
--
-- Created 2026-07-11 10:39:49, before this trigger was applied to production —
-- the next user, at 18:42 the same day, got a profile in the same transaction
-- and every one of the 27 since has too. It has no identities, has never signed
-- in and owns no rows, so this is bookkeeping rather than a rescue. It makes
-- auth.users and public.profiles agree, which is what the reconciliation check
-- in the runbook asserts.
-- ----------------------------------------------------------------------------
insert into public.profiles (id, display_name)
select
  u.id,
  left(
    nullif(
      btrim(
        coalesce(
          u.raw_user_meta_data ->> 'full_name',
          u.raw_user_meta_data ->> 'name',
          u.raw_user_meta_data ->> 'user_name',
          u.raw_user_meta_data ->> 'preferred_username',
          split_part(coalesce(u.email, ''), '@', 1)
        )
      ),
      ''
    ),
    80
  )
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Repair 2: recover the names of users who already signed up.
--
-- DELIBERATELY NARROWER THAN THE TRIGGER: this backfills only from real
-- provider metadata and does NOT apply the email-prefix fallback. The fallback
-- is right for a new signup, where the alternative is an empty panel. It is
-- wrong as a retroactive edit, because display_name is a field the owner can
-- see and change in Settings — writing "aaalikhaaan111" into it would look like
-- a name they chose, and nothing afterwards could distinguish a backfilled
-- value from a typed one. Existing users with no provider name keep their null
-- and go on falling back to their email in the UI, exactly as today.
--
-- Only touches rows that are still null, so it can never overwrite a name
-- somebody set themselves, and it is safe to re-run.
-- ----------------------------------------------------------------------------
with resolved as (
  select
    u.id,
    left(
      nullif(
        btrim(
          coalesce(
            u.raw_user_meta_data ->> 'full_name',
            u.raw_user_meta_data ->> 'name',
            u.raw_user_meta_data ->> 'user_name',
            u.raw_user_meta_data ->> 'preferred_username'
          )
        ),
        ''
      ),
      80
    ) as display_name
  from auth.users u
)
update public.profiles p
set display_name = r.display_name,
    updated_at = now()
from resolved r
where r.id = p.id
  and p.display_name is null
  and r.display_name is not null;

comment on function public.handle_new_user() is
  'Provisions public.profiles on signup, carrying the provider name from raw_user_meta_data (full_name/name/user_name/preferred_username, then email local part). Never raises: a profile failure must not fail the signup.';
