begin;

-- Caches the last generated improvement proposal per recommendation id, so
-- re-clicking the same recommendation returns the already-generated result
-- instead of re-invoking the model. Deliberately NOT part of user_ai_usage:
-- this is a content cache tied to one analysis cycle, not an account-wide
-- spend limit, and recommendation ids are freshly model-generated on every
-- analysis run, so a new analysis naturally invalidates old cache entries by
-- using different keys — no explicit expiry needed.
alter table public.project_feedback_analyses
  add column proposal_cache jsonb not null default '{}'::jsonb;

alter table public.project_feedback_analyses
  add constraint project_feedback_analyses_proposal_cache_object_check
  check (jsonb_typeof(proposal_cache) = 'object');

-- Bounds worst case (3 recommendations per analysis, each holding a full
-- Stage3 output capped at 131072 bytes elsewhere — see
-- project_publications_output_size_check) with headroom.
alter table public.project_feedback_analyses
  add constraint project_feedback_analyses_proposal_cache_size_check
  check (octet_length(proposal_cache::text) <= 450000);

grant update (proposal_cache) on public.project_feedback_analyses to authenticated;

commit;
