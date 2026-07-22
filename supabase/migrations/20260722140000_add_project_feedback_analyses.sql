begin;

create table public.project_feedback_analyses (
  project_id uuid primary key,
  publication_id uuid not null,
  user_id uuid not null,
  analysis jsonb,
  analyzed_response_count integer,
  analyzed_response_fingerprint text,
  analyzed_at timestamptz,
  analysis_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint project_feedback_analyses_publication_identity_fk
    foreign key (publication_id, project_id, user_id)
    references public.project_publications(id, project_id, user_id)
    on delete cascade,
  constraint project_feedback_analyses_count_check
    check (analyzed_response_count is null or analyzed_response_count >= 0),
  constraint project_feedback_analyses_fingerprint_check
    check (
      analyzed_response_fingerprint is null
      or analyzed_response_fingerprint ~ '^[0-9a-f]{64}$'
    ),
  constraint project_feedback_analyses_object_check
    check (analysis is null or jsonb_typeof(analysis) = 'object'),
  constraint project_feedback_analyses_size_check
    check (analysis is null or octet_length(analysis::text) <= 65536),
  constraint project_feedback_analyses_complete_result_check
    check (
      (
        analysis is null
        and analyzed_response_count is null
        and analyzed_response_fingerprint is null
        and analyzed_at is null
      )
      or
      (
        analysis is not null
        and analyzed_response_count is not null
        and analyzed_response_fingerprint is not null
        and analyzed_at is not null
      )
    )
);

create trigger set_project_feedback_analyses_updated_at
before update on public.project_feedback_analyses
for each row execute function public.set_updated_at();

alter table public.project_feedback_analyses enable row level security;

create policy "Owners can view their feedback analysis"
on public.project_feedback_analyses for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Owners can create feedback analysis for their publication"
on public.project_feedback_analyses for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.project_publications publication
    where publication.id = project_feedback_analyses.publication_id
      and publication.project_id = project_feedback_analyses.project_id
      and publication.user_id = project_feedback_analyses.user_id
      and publication.user_id = (select auth.uid())
  )
);

create policy "Owners can update their feedback analysis"
on public.project_feedback_analyses for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.project_publications publication
    where publication.id = project_feedback_analyses.publication_id
      and publication.project_id = project_feedback_analyses.project_id
      and publication.user_id = project_feedback_analyses.user_id
      and publication.user_id = (select auth.uid())
  )
);

revoke all on table public.project_feedback_analyses from public, anon, authenticated;
grant select on table public.project_feedback_analyses to authenticated;
grant insert (
  project_id, publication_id, user_id, analysis,
  analyzed_response_count, analyzed_response_fingerprint,
  analyzed_at, analysis_started_at
) on public.project_feedback_analyses to authenticated;
grant update (
  analysis, analyzed_response_count, analyzed_response_fingerprint,
  analyzed_at, analysis_started_at
) on public.project_feedback_analyses to authenticated;

commit;
