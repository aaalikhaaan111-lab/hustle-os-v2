-- ============================================================================
-- Drop the pre-repo Hustle OS tables.
--
-- These six are the only tables in the database that NO migration in this
-- repository creates. They predate it — they come from the Hustle OS schema
-- Ventrio grew out of — which is why their policy, index and constraint names
-- are unknown here.
--
-- VERIFIED BEFORE WRITING THIS, on 2026-08-20 against the production project:
--
--   rows           all six are EMPTY (0 rows each), so no data is lost
--   code           zero references in src/, worker/ or scripts/. The strings
--                  "workshops", "challenges" and "courses" appear only in
--                  src/lib/publishing/slug.ts as reserved subdomain words,
--                  which has nothing to do with these tables
--   foreign keys   nothing references them. The FKs run the other way:
--                  workshop_registrations.profile_id and
--                  challenge_progress.profile_id point INTO public.profiles,
--                  so dropping these REMOVES two constraints from profiles'
--                  delete path rather than adding risk
--   functions      none of the schema's functions read them. In particular
--                  public.owns_project() and public.set_updated_at() are
--                  untouched — both are load-bearing for active tables
--
-- NO `cascade`, DELIBERATELY. Policies and indexes belong to their table and go
-- with it regardless. The only thing a bare `drop table` cannot do is drop a
-- table another object still depends on — and in that case we want this
-- migration to FAIL LOUDLY and tell us what we missed, rather than quietly
-- destroying whatever that object was. Children are dropped before parents so
-- the ordinary case needs no cascade at all.
--
-- ROLLBACK: supabase/rollback/20260820160000_restore_hustleos_legacy_tables.sql
-- ============================================================================

begin;

drop table if exists public.workshop_registrations;
drop table if exists public.workshops;

drop table if exists public.challenge_progress;
drop table if exists public.challenges;

drop table if exists public.course_lessons;
drop table if exists public.courses;

commit;
