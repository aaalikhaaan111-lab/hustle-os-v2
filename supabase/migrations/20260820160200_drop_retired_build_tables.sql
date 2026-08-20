-- ============================================================================
-- Drop the retired task/output/proof build system.
--
-- This is the V1 Ventrio product: a coach that broke a project into stages and
-- tasks, collected an output per task, and asked for proof of completion. The
-- V2 pivot to app generation replaced it, and its UI was deleted on 2026-08-03
-- in ade8ff6, which removed src/app/build/workspace/task/[taskId]/page.tsx and
-- src/lib/actions/proof.ts.
--
-- THE LARGEST DATA LOSS IN THIS CLEANUP: project_tasks 88 rows,
-- project_outputs 22, project_proofs 0 — 110 rows, all archived to
-- backups/legacy-*/ before this ran and verified line-for-line against the
-- manifest. This migration is last, and separate from the other two, precisely
-- because it is the one worth being able to revert on its own.
--
-- VERIFIED BEFORE WRITING THIS:
--
--   code           the ONLY surviving reference in the repository is
--                  scripts/security-rls.test.mts, which listed these three
--                  among the tables it checks for cross-user reads. That list
--                  is updated in the same commit — otherwise the suite would
--                  start failing against tables that no longer exist. No
--                  product code path reads or writes them
--   foreign keys   project_tasks is a PARENT: project_outputs.task_id references
--                  it `on delete cascade`, project_proofs.task_id `on delete
--                  set null`. Both children also reference public.projects.
--                  Dropping children first is what makes the parent droppable
--                  without cascade
--   triggers       set_project_tasks_updated_at and set_project_outputs_updated_at
--                  go with their tables. public.set_updated_at() itself is
--                  SHARED by nine migrations and is deliberately NOT dropped
--   indexes        project_tasks_* and project_outputs_* belong to these tables.
--                  projects_user_id_idx and projects_user_id_status_idx are on
--                  the ACTIVE projects table and are untouched
--   storage        the `project-proofs` bucket is left in place. It is empty and
--                  private; removing a bucket is a separate, storage-side
--                  decision and is reported as a manual action instead of being
--                  bundled into a schema migration
--
-- ROLLBACK: supabase/rollback/20260820160200_restore_retired_build_tables.sql
-- ============================================================================

begin;

-- Children before the parent, so no cascade is needed.
drop table if exists public.project_proofs;
drop table if exists public.project_outputs;
drop table if exists public.project_tasks;

commit;
