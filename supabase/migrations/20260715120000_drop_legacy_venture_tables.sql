-- ============================================================================
-- Drop legacy Venture OS + pre-Ventrio tables.
--
-- REVIEW AND BACK UP BEFORE RUNNING (see the deployment report / backup
-- recommendation). This script is destructive but idempotent: every statement
-- uses IF EXISTS, so it is safe to run whether or not a given object is present.
--
-- It removes ONLY confirmed-unused legacy objects. It does NOT touch the active
-- Ventrio tables, and it does NOT drop any shared function:
--
--   KEPT (still in active use):
--     public.profiles
--     public.workshop_sessions
--     public.workshop_participants
--     public.workshop_answers
--     function public.set_updated_at()       -- shared: profiles + workshop_sessions triggers
--     function public.handle_new_user()      -- auto-provisions a profile on signup
--     function public.is_workshop_member()   -- live-quiz RLS helper
--
-- No functions are dropped here: the only functions in the schema are shared by
-- or exclusive to still-active features.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. public.ventures  (abandoned "Venture OS")
--    Defined in 20260711103040_create_core_schema.sql and extended in
--    20260711185242_add_research_report.sql. Only the now-removed /ventures
--    routes and the venture/research server actions ever read or wrote it.
--    Its policies, trigger, and indexes have known names, so they are dropped
--    explicitly before the table.
-- ----------------------------------------------------------------------------

drop policy if exists "Users can view own ventures"   on public.ventures;
drop policy if exists "Users can insert own ventures" on public.ventures;
drop policy if exists "Users can update own ventures" on public.ventures;
drop policy if exists "Users can delete own ventures" on public.ventures;

drop trigger if exists set_ventures_updated_at on public.ventures;

drop index if exists public.ventures_owner_id_idx;
drop index if exists public.ventures_owner_id_created_at_idx;

drop table if exists public.ventures;

-- ----------------------------------------------------------------------------
-- 2. Pre-Ventrio legacy tables from earlier schema versions.
--    These are NOT created by any migration in this repository and are
--    referenced by ZERO lines of the current codebase. Their names come from
--    the production database inspection. Because their policy/index/constraint
--    names predate this repo's migration history and are therefore unknown
--    here, each table is dropped with CASCADE so that its OWN dependent objects
--    (policies, indexes, constraints, and any FKs pointing INTO it) are removed
--    with it. Every target is named explicitly — this is not a schema-wide or
--    "drop everything" command. Children are dropped before parents.
-- ----------------------------------------------------------------------------

drop table if exists public.workshop_registrations cascade;
drop table if exists public.workshops              cascade;

drop table if exists public.challenge_progress     cascade;
drop table if exists public.challenges             cascade;

drop table if exists public.course_lessons         cascade;
drop table if exists public.courses                cascade;

commit;
