-- Proof of work: lightweight evidence a user attaches to a project, a task, or
-- a stage (a link, an uploaded image/file, or a short note). Purely additive —
-- adds one table plus a PRIVATE storage bucket and does not alter anything
-- existing.
--
-- Ownership model mirrors the rest of Build: proofs denormalize user_id so
-- SELECT/DELETE are a simple auth.uid() = user_id check, while INSERT/UPDATE
-- additionally verify (inline, no dependency on other pending migrations) that
-- the referenced project — and task, when present — actually belong to the
-- caller. Uploaded files live in a private bucket under a per-user folder and
-- are only ever served through short-lived signed URLs.
--
-- NOT executed automatically. Apply manually via the Supabase SQL Editor or
-- `supabase db push`. Until applied, the proof UI degrades gracefully (empty
-- timeline; adding reports it's unavailable).

-- ============================================================================
-- Table
-- ============================================================================

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

-- ============================================================================
-- Private storage bucket for uploaded proof images/files
-- ============================================================================
-- Private (public = false): objects are only reachable via short-lived signed
-- URLs generated server-side. Object paths are namespaced by owner:
--   <user_id>/<project_id>/<uuid>-<sanitized-filename>
-- so the first path segment is the owner's uid and the policies below scope
-- every operation to that user's own folder.

insert into storage.buckets (id, name, public)
values ('project-proofs', 'project-proofs', false)
on conflict (id) do nothing;

drop policy if exists "own proof files select" on storage.objects;
create policy "own proof files select"
  on storage.objects for select
  using (
    bucket_id = 'project-proofs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "own proof files insert" on storage.objects;
create policy "own proof files insert"
  on storage.objects for insert
  with check (
    bucket_id = 'project-proofs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "own proof files update" on storage.objects;
create policy "own proof files update"
  on storage.objects for update
  using (
    bucket_id = 'project-proofs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "own proof files delete" on storage.objects;
create policy "own proof files delete"
  on storage.objects for delete
  using (
    bucket_id = 'project-proofs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
