-- Project-scoped AI assistant: per-project conversations, messages, and a
-- compact memory summary. Every table is scoped to one project owned by one
-- user, and INSERT/UPDATE policies verify ownership of the PARENT project
-- (not just the row's self-reported user_id) — the same class of check the
-- earlier Build RLS review added, applied here from the start.
--
-- NOT executed automatically. Apply manually via the Supabase SQL Editor or
-- `supabase db push`.

-- ============================================================================
-- Tables
-- ============================================================================

create table if not exists public.project_ai_conversations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.project_ai_conversations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

-- One compact memory summary per project.
create table if not exists public.project_ai_memory (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  summary text,
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- Indexes
-- ============================================================================

create index if not exists project_ai_conversations_project_idx
  on public.project_ai_conversations (project_id, updated_at desc);

create index if not exists project_ai_messages_conversation_idx
  on public.project_ai_messages (conversation_id, created_at);

-- ============================================================================
-- updated_at triggers (reuse public.set_updated_at())
-- ============================================================================

drop trigger if exists set_project_ai_conversations_updated_at on public.project_ai_conversations;
create trigger set_project_ai_conversations_updated_at
  before update on public.project_ai_conversations
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_project_ai_memory_updated_at on public.project_ai_memory;
create trigger set_project_ai_memory_updated_at
  before update on public.project_ai_memory
  for each row
  execute function public.set_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.project_ai_conversations enable row level security;
alter table public.project_ai_messages enable row level security;
alter table public.project_ai_memory enable row level security;

-- Helper: does the current user own this project?
create or replace function public.owns_project(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project_id and p.user_id = auth.uid()
  );
$$;

-- ── conversations ──
drop policy if exists "own ai conversations select" on public.project_ai_conversations;
create policy "own ai conversations select"
  on public.project_ai_conversations for select
  using (auth.uid() = user_id);

drop policy if exists "own ai conversations insert" on public.project_ai_conversations;
create policy "own ai conversations insert"
  on public.project_ai_conversations for insert
  with check (auth.uid() = user_id and public.owns_project(project_id));

drop policy if exists "own ai conversations update" on public.project_ai_conversations;
create policy "own ai conversations update"
  on public.project_ai_conversations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.owns_project(project_id));

drop policy if exists "own ai conversations delete" on public.project_ai_conversations;
create policy "own ai conversations delete"
  on public.project_ai_conversations for delete
  using (auth.uid() = user_id);

-- ── messages ──
drop policy if exists "own ai messages select" on public.project_ai_messages;
create policy "own ai messages select"
  on public.project_ai_messages for select
  using (auth.uid() = user_id);

-- Insert verifies: the caller owns the parent project AND the conversation
-- being written to belongs to the caller and to that same project — so a
-- message can never be attached to someone else's conversation or project.
drop policy if exists "own ai messages insert" on public.project_ai_messages;
create policy "own ai messages insert"
  on public.project_ai_messages for insert
  with check (
    auth.uid() = user_id
    and public.owns_project(project_id)
    and exists (
      select 1 from public.project_ai_conversations c
      where c.id = conversation_id
        and c.user_id = auth.uid()
        and c.project_id = project_ai_messages.project_id
    )
  );

-- ── memory ──
drop policy if exists "own ai memory select" on public.project_ai_memory;
create policy "own ai memory select"
  on public.project_ai_memory for select
  using (auth.uid() = user_id);

drop policy if exists "own ai memory insert" on public.project_ai_memory;
create policy "own ai memory insert"
  on public.project_ai_memory for insert
  with check (auth.uid() = user_id and public.owns_project(project_id));

drop policy if exists "own ai memory update" on public.project_ai_memory;
create policy "own ai memory update"
  on public.project_ai_memory for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.owns_project(project_id));
