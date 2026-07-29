-- Adds a nullable locale preference column to profiles.
-- Purely additive: does not alter, drop, or rename anything existing, and
-- has no default value that would change behavior for existing rows (a
-- NULL locale is treated by the app as "no manual preference saved yet",
-- falling back to the NEXT_LOCALE cookie / Accept-Language detection).
--
-- NOT executed automatically. Apply manually via the Supabase SQL Editor
-- or `supabase db push` when ready.

alter table public.profiles
  add column if not exists locale text;

-- Keep it constrained to the two supported interface languages so a typo
-- or a stray client value can never write anything else. Postgres has no
-- `ADD CONSTRAINT IF NOT EXISTS`, so this checks pg_constraint directly to
-- stay idempotent like the rest of this file.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_locale_check'
  ) then
    alter table public.profiles
      add constraint profiles_locale_check
      check (locale is null or locale in ('ru', 'en'));
  end if;
end $$;
