-- What each generation actually cost, kept instead of thrown away.
--
-- The transport has always read `promptTokenCount`, `candidatesTokenCount`,
-- `thoughtsTokenCount` and `cachedContentTokenCount` off every Gemini response
-- (see googleTransport.ts) and then logged them. Nothing persisted them, so the
-- only way to answer "what does a generation cost" was to estimate from prompt
-- sizes and comments. These four columns replace that estimate with the number
-- the provider reported.
--
-- Nullable on purpose, and no default. A row with nulls means "this job never
-- got a usage report" — a transport failure before the model answered, or a job
-- created before this migration — which is a different fact from zero tokens
-- and must not be averaged as if it were zero.
--
-- `thoughts_tokens` is separate from `candidates_tokens` because Gemini bills
-- thinking as output but reports it apart, and it is the fingerprint of the
-- failure mode that cost two paid Anthropic canaries: reasoning quietly eating
-- the whole output budget.
--
-- Cached input is carried because it is priced an order of magnitude below
-- fresh input ($0.15 vs $1.50 per million at the time of writing), so a cost
-- figure that ignores it is wrong in the direction of looking worse.
--
-- No index. Nothing reads these per-row in a hot path; they are for periodic
-- aggregate queries, and an index on four write-once columns would cost more
-- than it saves.

begin;

alter table public.generation_jobs
  add column if not exists input_tokens integer,
  add column if not exists output_tokens integer,
  add column if not exists thoughts_tokens integer,
  add column if not exists cached_tokens integer;

-- A token count is a count. Negative values would only ever be a bug upstream,
-- and silently storing one would poison every average taken afterwards.
alter table public.generation_jobs
  add constraint generation_jobs_token_counts_non_negative
  check (
    coalesce(input_tokens, 0) >= 0
    and coalesce(output_tokens, 0) >= 0
    and coalesce(thoughts_tokens, 0) >= 0
    and coalesce(cached_tokens, 0) >= 0
  );

comment on column public.generation_jobs.input_tokens is
  'Gemini promptTokenCount for this job''s generation request. Null means no usage was reported.';
comment on column public.generation_jobs.output_tokens is
  'Gemini candidatesTokenCount. Billed as output.';
comment on column public.generation_jobs.thoughts_tokens is
  'Gemini thoughtsTokenCount. Billed as output, reported separately.';
comment on column public.generation_jobs.cached_tokens is
  'Gemini cachedContentTokenCount. Billed well below fresh input.';

commit;
