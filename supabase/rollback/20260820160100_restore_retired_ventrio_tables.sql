-- Restores what supabase/migrations/20260820160100_drop_retired_ventrio_tables.sql
-- dropped: public.ventures, the three workshop tables, and is_workshop_member().
--
-- FAITHFUL, NOT RECONSTRUCTED. Every statement below is copied from the
-- migrations that originally created these objects — 20260711103040 and
-- 20260711185242 for ventures, 20260714150000 for the workshop group — both of
-- which remain in supabase/migrations/ and can be read side by side with this
-- file. Columns, indexes, triggers and RLS policies are exactly what Ventrio
-- had.
--
-- Depends on public.set_updated_at(), which the cleanup deliberately did not
-- drop because nine other migrations share it.
--
-- AFTER RUNNING THIS, reload 56 rows from backups/legacy-<timestamp>/:
--   ventures.ndjson (4), workshop_sessions.ndjson (13),
--   workshop_participants.ndjson (15), workshop_answers.ndjson (24)
-- Parents before children: sessions, then participants, then answers.
--
-- NOTE ON THE POLICY THIS RESTORES. "Authenticated users can look up sessions"
-- is `using (auth.uid() is not null)` — any signed-in user can read every
-- session row. That was one of the reasons for dropping the table. It is
-- reproduced here because a rollback must restore what existed, not an improved
-- version of it; if you ever run this, fix that policy immediately afterwards.

begin;

-- ---------------------------------------------------------------- ventures --
create table if not exists public.ventures (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  mission text not null,
  budget text,
  deadline text,
  location text,
  resources text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  research_report jsonb,
  research_completed_at timestamptz
);

create index if not exists ventures_owner_id_idx
  on public.ventures (owner_id);

create index if not exists ventures_owner_id_created_at_idx
  on public.ventures (owner_id, created_at desc);

drop trigger if exists set_ventures_updated_at on public.ventures;
create trigger set_ventures_updated_at
  before update on public.ventures
  for each row
  execute function public.set_updated_at();

alter table public.ventures enable row level security;

drop policy if exists "Users can view own ventures" on public.ventures;
create policy "Users can view own ventures"
  on public.ventures
  for select
  using (auth.uid() = owner_id);

drop policy if exists "Users can insert own ventures" on public.ventures;
create policy "Users can insert own ventures"
  on public.ventures
  for insert
  with check (auth.uid() = owner_id);

drop policy if exists "Users can update own ventures" on public.ventures;
create policy "Users can update own ventures"
  on public.ventures
  for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "Users can delete own ventures" on public.ventures;
create policy "Users can delete own ventures"
  on public.ventures
  for delete
  using (auth.uid() = owner_id);

-- ------------------------------------------------- workshop live-quiz group --
-- Replayed verbatim from 20260714150000_add_workshops.sql, which is entirely
-- about these three tables and this one function.
create table if not exists public.workshop_sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  workshop_slug text not null,
  host_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'lobby' check (status in ('lobby', 'question', 'reveal', 'finished')),
  current_question_index integer not null default -1,
  question_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workshop_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workshop_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null,
  joined_at timestamptz not null default now(),
  unique (session_id, user_id)
);

-- Score is intentionally not stored here: it's always derived by summing
-- workshop_answers.points_awarded for a participant, so it can never drift
-- out of sync with the individually recorded (server-scored) answers.
create table if not exists public.workshop_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workshop_sessions (id) on delete cascade,
  participant_id uuid not null references public.workshop_participants (id) on delete cascade,
  question_index integer not null,
  selected_option integer not null,
  is_correct boolean not null,
  response_ms integer not null,
  points_awarded integer not null default 0,
  answered_at timestamptz not null default now(),
  unique (participant_id, question_index)
);

-- ============================================================================
-- Indexes
-- ============================================================================
-- (unique constraints above already index code, (session_id, user_id), and
-- (participant_id, question_index) — only add indexes for lookup columns
-- that aren't already covered by those.)

create index if not exists workshop_sessions_host_id_idx
  on public.workshop_sessions (host_id);

create index if not exists workshop_answers_session_id_idx
  on public.workshop_answers (session_id);

-- ============================================================================
-- updated_at trigger (reuses public.set_updated_at() from the core schema)
-- ============================================================================

drop trigger if exists set_workshop_sessions_updated_at on public.workshop_sessions;
create trigger set_workshop_sessions_updated_at
  before update on public.workshop_sessions
  for each row
  execute function public.set_updated_at();

-- ============================================================================
-- Membership helper
-- ============================================================================
-- A user is a "member" of a session if they host it or have a participant
-- row in it. Used by every RLS policy below instead of repeating the same
-- two-branch EXISTS check on each table.

create or replace function public.is_workshop_member(p_session_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.workshop_sessions ws
    where ws.id = p_session_id
      and ws.host_id = auth.uid()
  )
  or exists (
    select 1 from public.workshop_participants wp
    where wp.session_id = p_session_id
      and wp.user_id = auth.uid()
  );
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.workshop_sessions enable row level security;
alter table public.workshop_participants enable row level security;
alter table public.workshop_answers enable row level security;

-- workshop_sessions: any authenticated user may host (create) a session.
-- Only the host may update it — this is the DB-level enforcement of
-- "host-only controls."
--
-- SELECT is intentionally NOT restricted to existing members: a brand-new
-- participant is (by definition) neither the host nor an existing
-- participant yet, so looking a session up by its join code — and the
-- workshop_participants insert policy below, which checks this session's
-- status — must be able to read the row *before* membership exists. The
-- code itself is the access gate (you can't filter by a code you don't
-- know); the columns exposed here (status/slug/timing) aren't sensitive.
-- Participant rosters and answers stay strictly member-gated below.
drop policy if exists "Authenticated users can host a session" on public.workshop_sessions;
create policy "Authenticated users can host a session"
  on public.workshop_sessions
  for insert
  with check (host_id = auth.uid());

drop policy if exists "Members can view their session" on public.workshop_sessions;
drop policy if exists "Authenticated users can look up sessions" on public.workshop_sessions;
create policy "Authenticated users can look up sessions"
  on public.workshop_sessions
  for select
  using (auth.uid() is not null);

drop policy if exists "Host can update own session" on public.workshop_sessions;
create policy "Host can update own session"
  on public.workshop_sessions
  for update
  using (host_id = auth.uid())
  with check (host_id = auth.uid());

-- workshop_participants: a user may only join as themselves, and only while
-- the session is still in its lobby. Any session member may see the roster
-- (needed for the live participant list and leaderboard names).
drop policy if exists "Users can join a session in lobby" on public.workshop_participants;
create policy "Users can join a session in lobby"
  on public.workshop_participants
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.workshop_sessions ws
      where ws.id = session_id
        and ws.status = 'lobby'
    )
  );

drop policy if exists "Members can view participants" on public.workshop_participants;
create policy "Members can view participants"
  on public.workshop_participants
  for select
  using (public.is_workshop_member(session_id));

-- workshop_answers: a user may only submit an answer under their own
-- participant row, and only one row per (participant, question) — the
-- unique constraint above backs this up at the storage layer. Any session
-- member may read answers (needed to compute the live leaderboard).
-- Answers are never updated or deleted — the recorded score is final.
drop policy if exists "Users can submit their own answers" on public.workshop_answers;
create policy "Users can submit their own answers"
  on public.workshop_answers
  for insert
  with check (
    exists (
      select 1 from public.workshop_participants wp
      where wp.id = participant_id
        and wp.user_id = auth.uid()
        and wp.session_id = workshop_answers.session_id
    )
  );

drop policy if exists "Members can view answers" on public.workshop_answers;
create policy "Members can view answers"
  on public.workshop_answers
  for select
  using (public.is_workshop_member(session_id));

commit;
