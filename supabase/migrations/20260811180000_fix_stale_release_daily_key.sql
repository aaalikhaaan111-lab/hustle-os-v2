-- Refund the key the limit is actually enforced against.
--
-- THE DEFECT, OBSERVED IN PRODUCTION ON 2026-08-11
--
-- A first-version generation was killed by the platform's function timeout at
-- 300 s. The stale sweep then ended the job and released its unit — against the
-- wrong counter. Afterwards:
--
--   first_version_generation             5 -> 4     (a legacy row nothing reads)
--   first_version_generation:2026-08-11  1 -> 1     (the row that gates the user)
--
-- The person lost a generation to a failure that was not theirs, and the
-- counter that governs them never moved.
--
-- WHY IT HAPPENED
--
-- Daily allowances are stored one key per UTC day: `reserve_generation_job_usage`
-- charges `first_version_generation:<day>`, because that is what `usageKeyFor`
-- produces and what the workspace reads back. Both sweeps, however, were handed
-- a single `p_metric` by their callers — the bare metric name from
-- `expire_stale_generation_jobs`, and today's resolved key from
-- `expire_stale_generation_jobs_for_user`. The first refunded a key nothing
-- reserves. The second was right only for jobs that did not cross midnight.
--
-- THE FIX
--
-- A sweep ends many jobs at once, so it cannot be handed one correct key — it
-- has to compose one per job. Both functions now take the metric *base* plus a
-- flag saying whether it is a daily metric, and derive each job's key from that
-- job's own `usage_reserved_at`, inside the same transaction and under the same
-- row lock that ends it. A hold taken yesterday is refunded to yesterday.
--
-- Idempotency is unchanged and still belongs to `release_generation_job_usage`:
-- it refuses a second refund (`usage_released_at`), refuses to refund a job that
-- never reserved (`usage_reserved_at is null`), and refuses to refund one that
-- succeeded. Calling either sweep twice therefore moves no counter twice.
--
-- The old four-argument signatures are dropped rather than left in place, so a
-- caller that has not been updated fails loudly instead of silently refunding
-- the wrong key again — which is precisely how this survived unnoticed.

begin;

-- The key one job's refund belongs to.
create or replace function public.usage_key_for_job(
  p_metric text,
  p_metric_daily boolean,
  p_reserved_at timestamptz
)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when not p_metric_daily then p_metric
    -- A job with no reservation gets the plain key; the release will refuse it
    -- anyway, because there is nothing to give back.
    when p_reserved_at is null then p_metric
    else p_metric || ':' || to_char((p_reserved_at at time zone 'UTC')::date, 'YYYY-MM-DD')
  end;
$$;

drop function if exists public.expire_stale_generation_jobs(uuid, uuid, text, timestamptz, text);

create or replace function public.expire_stale_generation_jobs(
  p_project_id uuid,
  p_user_id uuid,
  p_kind text,
  p_metric text,
  p_metric_daily boolean,
  p_cutoff timestamptz
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.generation_jobs%rowtype;
  v_expired integer := 0;
begin
  if p_project_id is null or p_user_id is null or p_kind is null
     or p_cutoff is null or p_metric is null or p_metric_daily is null then
    raise exception using errcode = '22023', message = 'expire_stale_generation_jobs: invalid arguments';
  end if;

  for v_job in
    select * from public.generation_jobs
    where project_id = p_project_id
      and user_id = p_user_id
      and kind = p_kind
      and status in ('queued', 'running')
      and coalesce(heartbeat_at, started_at, created_at) < p_cutoff
    for update
  loop
    update public.generation_jobs
    set status = 'failed',
        error_code = 'stale',
        error_message = 'Generation stopped responding and was ended.',
        finished_at = now()
    where id = v_job.id;

    perform public.release_generation_job_usage(
      v_job.id,
      public.usage_key_for_job(p_metric, p_metric_daily, v_job.usage_reserved_at)
    );
    v_expired := v_expired + 1;
  end loop;

  return v_expired;
end;
$$;

drop function if exists public.expire_stale_generation_jobs_for_user(uuid, text, timestamptz, text);

create or replace function public.expire_stale_generation_jobs_for_user(
  p_user_id uuid,
  p_kind text,
  p_metric text,
  p_metric_daily boolean,
  p_cutoff timestamptz
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.generation_jobs%rowtype;
  v_expired integer := 0;
begin
  if p_user_id is null or p_kind is null or p_cutoff is null
     or p_metric is null or p_metric_daily is null then
    raise exception using errcode = '22023', message = 'expire_stale_generation_jobs_for_user: invalid arguments';
  end if;

  for v_job in
    select * from public.generation_jobs
    where user_id = p_user_id
      and kind = p_kind
      and status in ('queued', 'running')
      and coalesce(heartbeat_at, started_at, created_at) < p_cutoff
    for update
  loop
    update public.generation_jobs
    set status = 'failed',
        error_code = 'stale',
        error_message = 'Generation stopped responding and was ended.',
        finished_at = now()
    where id = v_job.id;

    perform public.release_generation_job_usage(
      v_job.id,
      public.usage_key_for_job(p_metric, p_metric_daily, v_job.usage_reserved_at)
    );
    v_expired := v_expired + 1;
  end loop;

  return v_expired;
end;
$$;

-- Same posture as every other counter function: a user's own session must not
-- be able to move a counter that gates them.
revoke all on function public.usage_key_for_job(text, boolean, timestamptz) from public, anon, authenticated;
revoke all on function public.expire_stale_generation_jobs(uuid, uuid, text, text, boolean, timestamptz) from public, anon, authenticated;
revoke all on function public.expire_stale_generation_jobs_for_user(uuid, text, text, boolean, timestamptz) from public, anon, authenticated;
grant execute on function public.usage_key_for_job(text, boolean, timestamptz) to service_role;
grant execute on function public.expire_stale_generation_jobs(uuid, uuid, text, text, boolean, timestamptz) to service_role;
grant execute on function public.expire_stale_generation_jobs_for_user(uuid, text, text, boolean, timestamptz) to service_role;

commit;
