-- Structured project outputs confirmed via the assistant (problem, audience,
-- solution, evidence, first version, test results). Stored as one small JSONB
-- object per project, keyed by a fixed allowlist of field ids. Purely additive
-- — adds a single nullable column and changes nothing else.
--
-- Separating these from project_outputs (which hold per-task answers gated by
-- the AI review) is deliberate: an assistant-confirmed snapshot field must
-- never silently overwrite a task's reviewed answer, complete a task, or award
-- XP. The projects table's existing RLS already scopes this column to the
-- owner, so no new policy is required.
--
-- NOT executed automatically. Apply manually via the Supabase SQL Editor or
-- `supabase db push`. Until applied, saving structured outputs degrades
-- gracefully (the assistant still proposes; the save reports it's unavailable).

alter table public.projects
  add column if not exists snapshot_fields jsonb;
