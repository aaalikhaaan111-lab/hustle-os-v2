-- Build module: guided project-building workspace (interest -> pitch).
-- Adds projects, project_tasks, and project_outputs. Purely additive — does
-- not alter, drop, or rename any existing table.
--
-- NOT executed automatically. Apply manually via the Supabase SQL Editor or
-- `supabase db push` when ready, same as the other post-launch migrations in
-- this directory.
--
-- RLS follows the same direct-ownership pattern as public.ventures (core
-- schema migration): project_tasks and project_outputs denormalize user_id
-- so SELECT/DELETE stay a simple `auth.uid() = user_id` check. INSERT/UPDATE
-- additionally verify (via EXISTS) that the parent row referenced by
-- project_id/task_id is actually owned by the caller — otherwise a user
-- could self-report user_id correctly while still attaching a row to
-- another user's real project/task id.

-- ============================================================================
-- Tables
-- ============================================================================

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text,
  project_type text not null check (project_type in (
    'digital_product', 'service', 'content_media', 'community_social',
    'research', 'smart_city', 'physical_product', 'small_business'
  )),
  niche text not null,
  starting_stage text not null check (starting_stage in (
    'interest', 'problem', 'idea', 'building', 'early_version'
  )),
  target_audience text,
  intended_outcome text not null check (intended_outcome in (
    'validate_idea', 'first_version', 'launch_publicly', 'run_event',
    'complete_research', 'prepare_pitch'
  )),
  time_availability text not null check (time_availability in (
    'under_2h', '2_4h', '5_7h', 'over_7h'
  )),
  pathway_mode text not null default 'standard' check (pathway_mode in ('standard', 'quick_sprint')),
  current_stage text,
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  status text not null default 'active' check (status in ('active', 'completed')),
  locale text not null default 'en' check (locale in ('en', 'ru')),
  -- Small, well-defined, one-per-project structured content (final Project
  -- Summary and generated/edited pitch) — a dedicated table would be
  -- overkill for a single JSON object per project with no independent
  -- lifecycle of its own.
  project_summary jsonb,
  pitch jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

-- ============================================================================
-- Indexes
-- ============================================================================

create index if not exists projects_user_id_idx
  on public.projects (user_id);

create index if not exists projects_user_id_status_idx
  on public.projects (user_id, status);

create index if not exists project_tasks_project_id_order_idx
  on public.project_tasks (project_id, order_index);

create index if not exists project_tasks_user_id_idx
  on public.project_tasks (user_id);

create index if not exists project_outputs_project_id_idx
  on public.project_outputs (project_id);

-- ============================================================================
-- updated_at triggers (reuse public.set_updated_at() from the core schema)
-- ============================================================================

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
  before update on public.projects
  for each row
  execute function public.set_updated_at();

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

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.projects enable row level security;
alter table public.project_tasks enable row level security;
alter table public.project_outputs enable row level security;

drop policy if exists "Users can view own projects" on public.projects;
create policy "Users can view own projects"
  on public.projects
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own projects" on public.projects;
create policy "Users can insert own projects"
  on public.projects
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own projects" on public.projects;
create policy "Users can update own projects"
  on public.projects
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own projects" on public.projects;
create policy "Users can delete own projects"
  on public.projects
  for delete
  using (auth.uid() = user_id);

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
