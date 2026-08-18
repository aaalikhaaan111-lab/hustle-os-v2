-- Stored pictures of generated projects, so the gallery can show one.
--
-- WHY A STORED IMAGE AND NOT A LIVE RENDER. A generated project is source, so
-- the only faithful picture of it is a running copy — and running one per card
-- is what made the gallery slow, made cards appear at different moments and
-- cropped a desktop layout into a corner. The alternative the gallery has been
-- using is a drawing built from metadata, which for APPS is a name and a list of
-- routes: true, but not a preview of anything.
--
-- The capture happens once, in the worker, from the same document the published
-- page serves. See `worker/thumbnail.ts`.
--
-- WHY ON `projects` AND NOT `project_publications`. A project has a picture as
-- soon as it has a generated version; publishing is a separate decision that may
-- never happen. Hanging the thumbnail off the publication would leave every
-- unpublished project — the majority — with nothing to show.
--
-- `thumbnail_captured_at` is compared against `projects.updated_at` to decide
-- whether a picture is stale, so a regeneration or an edit gets a fresh capture
-- without any explicit invalidation call. Nullable because "never captured" and
-- "captured at the epoch" are different statements.

begin;

alter table public.projects
  add column if not exists thumbnail_url text,
  add column if not exists thumbnail_captured_at timestamptz;

-- THE CAPTURE MUST NOT COUNT AS A CHANGE TO THE PROJECT.
--
-- `set_projects_updated_at` fires `before update ... for each row` and sets
-- `updated_at = now()` unconditionally. Writing a thumbnail is an update, so it
-- would push `updated_at` PAST the `thumbnail_captured_at` it just wrote — the
-- project would be stale the instant it was captured, and the worker would
-- re-screenshot the same handful of projects on every idle tick, forever.
--
-- A dedicated trigger function for `projects` keeps `updated_at` still when the
-- ONLY difference between the old and new row is the thumbnail. The comparison
-- is on the whole row minus those columns rather than a list of the ones that
-- matter, so a column added later is covered without anyone remembering to come
-- back here. `public.set_updated_at()` is untouched and still serves every other
-- table.
create or replace function public.set_projects_updated_at()
returns trigger
language plpgsql
as $$
begin
  if to_jsonb(new) - 'thumbnail_url' - 'thumbnail_captured_at' - 'updated_at'
   = to_jsonb(old) - 'thumbnail_url' - 'thumbnail_captured_at' - 'updated_at' then
    -- Only the picture moved. The project itself did not.
    new.updated_at = old.updated_at;
    return new;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
  before update on public.projects
  for each row
  execute function public.set_projects_updated_at();

-- Finding the work: projects whose picture is missing or older than the project
-- itself. Partial, because a project with a current thumbnail is not a
-- candidate and there is no reason to carry it in the index.
create index if not exists projects_thumbnail_pending_idx
  on public.projects (updated_at)
  where thumbnail_captured_at is null or thumbnail_captured_at < updated_at;

-- WHAT IS DUE, as a view.
--
-- PostgREST filters compare a column against a VALUE, never against another
-- column, so `thumbnail_captured_at < updated_at` cannot be expressed as a
-- query parameter. Putting the rule in a view keeps it in ONE place — the same
-- predicate as the index above — instead of half in SQL and half in a
-- JavaScript filter that would silently drift from it.
create or replace view public.projects_needing_thumbnail as
  select id, updated_at, snapshot_fields
  from public.projects
  where thumbnail_captured_at is null
     or thumbnail_captured_at < updated_at;

-- The view is reached only by the worker, which holds the service role. Revoking
-- the API roles is what keeps it that way: a view inherits no RLS of its own,
-- and `snapshot_fields` carries generated source.
revoke all on public.projects_needing_thumbnail from anon, authenticated;

-- The bucket. PUBLIC, deliberately: these are pictures of projects their owners
-- publish, the URL is unguessable, and a signed URL per card would put a round
-- trip in front of every image in the gallery.
insert into storage.buckets (id, name, public)
values ('project-thumbnails', 'project-thumbnails', true)
on conflict (id) do nothing;

-- Reading is open because the bucket is public; writing is not. Only the worker
-- touches these, and it holds the service role, which bypasses RLS — so there is
-- deliberately NO insert/update policy here. Anything without the service role
-- can read and nothing else.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'project_thumbnails_public_read'
  ) then
    create policy project_thumbnails_public_read
      on storage.objects for select
      using (bucket_id = 'project-thumbnails');
  end if;
end $$;

commit;
