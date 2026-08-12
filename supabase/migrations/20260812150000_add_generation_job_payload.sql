-- Gives a queued job everything the executor needs to run it.
--
-- WHY THIS COLUMN EXISTS NOW
--
-- Generation execution is moving out of Vercel. Three attempts to run a
-- multi-minute Gemini call inside a serverless function have failed in three
-- different ways — a 300 s timeout, a suspended invocation whose timers stopped
-- firing, and a second suspended invocation that produced no logs at all — and
-- none of them is fixable from inside the function. An external worker polls
-- for work instead.
--
-- Which means the work has to be *findable*. Until now the brief travelled in a
-- queue message and was never written down, so a job row said that a generation
-- was owed but not what to generate. A worker cannot reconstruct it: the intake
-- answers the person gave are inputs to the request, not project state.
--
-- So the row carries its own input. This is not a second job model — it is the
-- same row, with the argument it was always implicitly about.
--
-- WHAT MAY GO IN HERE
--
-- The composed brief, the locale and the pinned model. Nothing else, and in
-- particular nothing secret: the API key is read by the worker from its own
-- environment and never travels through the database.

begin;

alter table public.generation_jobs
  add column if not exists payload jsonb;

-- The worker's query: eligible first-version jobs, oldest first. Partial, so it
-- indexes only rows that can actually be picked up rather than the whole table.
create index if not exists generation_jobs_claimable_idx
  on public.generation_jobs (created_at)
  where status in ('queued', 'running') and provider_requests = 0 and payload is not null;

commit;
