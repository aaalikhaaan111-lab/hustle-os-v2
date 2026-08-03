-- Adds the interface-language preference to profiles.
--
-- Language selection is a shipped product feature: the workspace Settings
-- screen writes it and post-login sync reads it so the choice follows a person
-- across devices. Until now the column did not exist live and both code paths
-- silently no-opped, which meant the preference was per-browser only.
--
-- NOT NULL DEFAULT 'en' rather than nullable: the application types should not
-- carry an optional field for a column that always has a value. Existing rows
-- are backfilled to 'en' by the default. This does not change the language any
-- current user sees — the NEXT_LOCALE cookie is the source of truth for the
-- browser they are already in, and post-login sync only consults the profile
-- when no cookie is present. A person on a brand-new device would now start in
-- English rather than by Accept-Language detection, and can change it in
-- Settings at any time.

begin;

alter table public.profiles
  add column if not exists locale text not null default 'en';

-- Constrained to the two languages the product actually ships, so neither a
-- typo nor a stray client value can write anything else. Postgres has no
-- ADD CONSTRAINT IF NOT EXISTS, so this checks pg_constraint to stay
-- idempotent like the rest of the migration.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_locale_check'
  ) then
    alter table public.profiles
      add constraint profiles_locale_check
      check (locale in ('en', 'ru'));
  end if;
end $$;

commit;
