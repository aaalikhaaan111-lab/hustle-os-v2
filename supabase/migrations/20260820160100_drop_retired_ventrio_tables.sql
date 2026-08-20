-- ============================================================================
-- Drop the retired Ventrio features: Venture OS and the live workshop quiz.
--
-- Unlike the Hustle OS tables, these ARE ours — created by
-- 20260711103040_create_core_schema.sql and 20260714150000_add_workshops.sql.
-- Their product surfaces were deleted on 2026-08-03 in a72075b ("finalize v1
-- workspace shell and remove retired product"), which removed
-- src/app/workshops/, src/components/workshops/ and src/lib/actions/workshops.ts.
-- The tables outlived the feature by seventeen days.
--
-- THEY ARE NOT EMPTY: ventures 4 rows, workshop_sessions 13,
-- workshop_participants 15, workshop_answers 24 — 56 rows in total, every one
-- archived to backups/legacy-*/ by scripts/archive-legacy.mts before this ran.
-- All four `ventures` rows belong to the dev test account.
--
-- VERIFIED BEFORE WRITING THIS:
--
--   code           zero references in src/, worker/ or scripts/
--   foreign keys   internal only — answers -> participants -> sessions, and
--                  ventures.owner_id -> auth.users. Nothing outside the group
--                  points in
--   RLS            worth recording as the reason this is more than tidiness:
--                  workshop_sessions carries `using (auth.uid() is not null)`,
--                  so ANY authenticated user could read all 13 rows across all
--                  4 hosts. That was deliberate once — you must find a session
--                  by its code before you can be a member of it — but it is now
--                  a live cross-user read serving a feature that no longer
--                  exists. Dropping the table is what closes it
--   functions      public.is_workshop_member() is used by exactly two policies,
--                  both on tables dropped here, so it goes too. Checked by
--                  grep across every migration: no other policy or function
--                  calls it
--
-- ROLLBACK: supabase/rollback/20260820160100_restore_retired_ventrio_tables.sql
-- ============================================================================

begin;

-- Children first: answers reference both participants and sessions.
drop table if exists public.workshop_answers;
drop table if exists public.workshop_participants;
drop table if exists public.workshop_sessions;

-- Only reachable from the two policies that just went with their tables.
drop function if exists public.is_workshop_member(uuid);

-- Venture OS. Its trigger and indexes belong to the table and go with it.
drop table if exists public.ventures;

commit;
