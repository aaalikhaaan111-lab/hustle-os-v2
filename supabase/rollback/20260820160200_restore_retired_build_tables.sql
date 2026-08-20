-- Restores what supabase/migrations/20260820160200_drop_retired_build_tables.sql
-- dropped: public.project_tasks, public.project_outputs, public.project_proofs.
--
-- FAITHFUL, NOT RECONSTRUCTED. Copied from 20260720120000_add_build.sql and
-- 20260721130000_add_project_proofs.sql, both still in supabase/migrations/.
-- Only the statements belonging to these three tables are reproduced: the
-- `projects` table, its indexes, its trigger and its policies live in the same
-- source migration and are ACTIVE — they must not be re-run from here.
--
-- Depends on public.set_updated_at(), deliberately kept by the cleanup.
--
-- AFTER RUNNING THIS, reload 110 rows from backups/legacy-<timestamp>/, parents
-- first: project_tasks.ndjson (88), then project_outputs.ndjson (22), then
-- project_proofs.ndjson (0, present for completeness).
--
-- The `project-proofs` storage bucket and its four storage.objects policies
-- were never dropped, so they are not recreated here.

begin;

-- ------------------------------------------------------------------ tables --
create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  stage text not null,
  order_index integer not null,
  title text not null,
  objective text not null,
  why_it_matters text not null,
  action text not null,
  expected_output text not null,
  estimated_time text not null,
  completion_criteria text not null,
  output_kind text not null default 'longtext' check (output_kind in ('text', 'longtext')),
  recommended_lesson_id text,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  completed_at timestamptz,
  xp integer not null default 0,
  xp_awarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_outputs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  task_id uuid not null unique references public.project_tasks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- ----------------------------------------------------------------- indexes --
create index if not exists project_tasks_project_id_order_idx
  on public.project_tasks (project_id, order_index);

create index if not exists project_tasks_user_id_idx
  on public.project_tasks (user_id);

create index if not exists project_outputs_project_id_idx
  on public.project_outputs (project_id);
-- ---------------------------------------------------------------- triggers --
drop trigger if exists set_project_tasks_updated_at on public.project_tasks;
create trigger set_project_tasks_updated_at
  before update on public.project_tasks
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_project_outputs_updated_at on public.project_outputs;
create trigger set_project_outputs_updated_at
  before update on public.project_outputs
  for each row
  execute function public.set_updated_at();
-- --------------------------------------------------------------------- RLS --
alter table public.project_tasks enable row level security;
alter table public.project_outputs enable row level security;

drop policy if exists "Users can view own project tasks" on public.project_tasks;
create policy "Users can view own project tasks"
  on public.project_tasks
  for select
  using (auth.uid() = user_id);

-- INSERT/UPDATE also verify that project_id actually belongs to the caller,
-- not just that the new row's own user_id column is self-reported correctly.
-- Without this, a user could attach a task row to another user's real
-- project_id (still invisible to that user under the SELECT policy above,
-- since it isn't RLS-visible to them, but a real integrity gap all the same).
drop policy if exists "Users can insert own project tasks" on public.project_tasks;
create policy "Users can insert own project tasks"
  on public.project_tasks
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update own project tasks" on public.project_tasks;
create policy "Users can update own project tasks"
  on public.project_tasks
  for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "Users can view own project outputs" on public.project_outputs;
create policy "Users can view own project outputs"
  on public.project_outputs
  for select
  using (auth.uid() = user_id);

-- INSERT/UPDATE also verify the referenced task actually belongs to the
-- caller (and that project_id matches that task's own project). Without
-- this, a user could target another user's real task_id: since task_id is
-- UNIQUE, a malicious row planted there would make the real owner's own
-- upsert (onConflict: "task_id") silently fail — the UPDATE half of that
-- upsert would be blocked by this table's own RLS because the existing
-- row's user_id wouldn't match — permanently and silently losing that
-- user's saved answer for that task.
drop policy if exists "Users can insert own project outputs" on public.project_outputs;
create policy "Users can insert own project outputs"
  on public.project_outputs
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.project_tasks t
      where t.id = task_id and t.user_id = auth.uid() and t.project_id = project_outputs.project_id
    )
  );

drop policy if exists "Users can update own project outputs" on public.project_outputs;
create policy "Users can update own project outputs"
  on public.project_outputs
  for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.project_tasks t
      where t.id = task_id and t.user_id = auth.uid() and t.project_id = project_outputs.project_id
    )
  );
-- ---------------------------------------------------------- project_proofs --
create table if not exists public.project_proofs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  task_id uuid references public.project_tasks (id) on delete set null,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('url', 'image', 'file', 'note')),
  title text not null,
  description text,
  -- For type 'url': the external link. For 'image'/'file': null (see file_path).
  url text,
  -- For type 'image'/'file': the storage object path in the project-proofs
  -- bucket (never a public URL). Null for 'url'/'note'.
  file_path text,
  stage text,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'verified')),
  created_at timestamptz not null default now()
);

create index if not exists project_proofs_project_idx
  on public.project_proofs (project_id, created_at desc);

create index if not exists project_proofs_user_idx
  on public.project_proofs (user_id);

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.project_proofs enable row level security;

drop policy if exists "own proofs select" on public.project_proofs;
create policy "own proofs select"
  on public.project_proofs for select
  using (auth.uid() = user_id);

drop policy if exists "own proofs insert" on public.project_proofs;
create policy "own proofs insert"
  on public.project_proofs for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
    and (
      task_id is null
      or exists (
        select 1 from public.project_tasks t
        where t.id = task_id and t.user_id = auth.uid() and t.project_id = project_proofs.project_id
      )
    )
  );

drop policy if exists "own proofs update" on public.project_proofs;
create policy "own proofs update"
  on public.project_proofs for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "own proofs delete" on public.project_proofs;
create policy "own proofs delete"
  on public.project_proofs for delete
  using (auth.uid() = user_id);


commit;
