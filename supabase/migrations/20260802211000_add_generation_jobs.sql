-- Durable state for long-running AI generation.
--
-- Generating a first version takes 30-90 seconds. Until now that work lived
-- only inside one server action: refreshing the page lost all trace of it, a
-- failure left no record, and there was nothing to retry from. This table is
-- the record. It does not by itself make the work durable — see the honest
-- limitation in src/lib/jobs/generationJobs.ts — but it makes the *state*
-- durable, which is what the interface needs in order to stop lying.
--
-- Deliberately narrow: one job kind ('first_version'). AI edits, signal
-- analysis and next-version proposals are not represented here, because none
-- of them is being converted in this phase and an unused enum value is an
-- invitation to build against something that does not exist yet.

begin;

create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  user_id uuid not null,
  kind text not null default 'first_version',
  status text not null default 'queued',
  -- Deterministic per attempt, so a replayed request cannot start a second
  -- model call. See the unique constraint below.
  request_id text not null,
  progress_stage text,
  -- A short machine code the interface maps to its own copy, never a raw
  -- provider or database message.
  error_code text,
  error_message text,
  attempt_count integer not null default 0,
  started_at timestamptz,
  -- Written at every real stage boundary. A running job whose heartbeat has
  -- gone quiet is how a killed request is distinguished from a slow one.
  heartbeat_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- The same composite-ownership pattern project_publications uses: ownership
  -- is enforced by the schema, not only by policy.
  constraint generation_jobs_project_owner_fk
    foreign key (project_id, user_id)
    references public.projects(id, user_id)
    on delete cascade,

  constraint generation_jobs_kind_check
    check (kind in ('first_version')),
  constraint generation_jobs_status_check
    check (status in ('queued', 'running', 'succeeded', 'failed')),
  constraint generation_jobs_progress_stage_check
    check (progress_stage is null or char_length(progress_stage) <= 40),
  constraint generation_jobs_error_code_check
    check (error_code is null or char_length(error_code) <= 40),
  constraint generation_jobs_error_message_check
    check (error_message is null or char_length(error_message) <= 2000),
  constraint generation_jobs_attempt_count_check
    check (attempt_count >= 0),
  constraint generation_jobs_request_id_check
    check (char_length(request_id) between 1 and 100),

  -- Replaying the same attempt is a no-op rather than a second model call.
  constraint generation_jobs_idempotency_unique
    unique (project_id, kind, request_id)
);

-- At most one job per project and kind may be in flight. This is the database
-- half of duplicate prevention; the server action checks first for a friendly
-- message, and this catches the race the check cannot.
create unique index generation_jobs_one_active_idx
  on public.generation_jobs(project_id, kind)
  where status in ('queued', 'running');

-- The history a project's Build screen reads.
create index generation_jobs_project_created_idx
  on public.generation_jobs(project_id, created_at desc);

-- The sweep that finds jobs whose heartbeat has stopped.
create index generation_jobs_active_heartbeat_idx
  on public.generation_jobs(status, heartbeat_at)
  where status in ('queued', 'running');

create trigger set_generation_jobs_updated_at
  before update on public.generation_jobs
  for each row execute function public.set_updated_at();

alter table public.generation_jobs enable row level security;

-- Owners may read their own jobs and nothing else. There is deliberately no
-- insert, update or delete policy: a client must never be able to create a
-- job, mark one succeeded, rewrite an error or reset an attempt count. Every
-- write goes through server-side code holding the service role, which bypasses
-- RLS. This mirrors user_ai_usage, which is likewise read-only to clients.
create policy "Owners can view their generation jobs"
  on public.generation_jobs
  for select
  to authenticated
  using (user_id = (select auth.uid()));

commit;
