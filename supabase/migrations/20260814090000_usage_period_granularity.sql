-- The stale sweep has to know a metric's PERIOD, not just whether it is daily.
--
-- `first_version_generation` refills monthly now (see src/lib/ai/usageLimits.ts:
-- three per day is up to ninety a month, and a generation costs real provider
-- spend). Reservations and refunds taken through the application are unaffected
-- — those receive an already-resolved key from `usageKeyFor`.
--
-- The stale sweep is the exception, and the reason this migration exists. It
-- composes one refund key per job from that job's own `usage_reserved_at`, so
-- it derives the key itself, and it was hardcoded to 'YYYY-MM-DD' behind a
-- boolean. Left alone, a swept monthly job would refund to a daily key that
-- nothing reads: the row would gain a credit nobody can spend and the user
-- would silently lose a generation they never received.
--
-- So the boolean becomes the period. 'day' and 'month' compose a key, anything
-- else is a lifetime metric and uses the bare name.
--
-- The four- and five-argument signatures are dropped rather than left in place,
-- following the precedent of 20260811180000: a caller that has not been updated
-- fails loudly instead of silently refunding the wrong key, which is exactly
-- how the previous version of this bug survived unnoticed.

begin;

-- The key one job's refund belongs to.
create or replace function public.usage_key_for_job(
  p_metric text,
  p_metric_period text,
  p_reserved_at timestamptz
)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    -- A job with no reservation gets the plain key; the release will refuse it
    -- anyway, because there is nothing to give back.
    when p_reserved_at is null then p_metric
    when p_metric_period = 'day'
      then p_metric || ':' || to_char((p_reserved_at at time zone 'UTC')::date, 'YYYY-MM-DD')
    when p_metric_period = 'month'
      then p_metric || ':' || to_char((p_reserved_at at time zone 'UTC')::date, 'YYYY-MM')
    else p_metric
  end;
$$;

drop function if exists public.usage_key_for_job(text, boolean, timestamptz);
drop function if exists public.expire_stale_generation_jobs(uuid, uuid, text, text, boolean, timestamptz);

create or replace function public.expire_stale_generation_jobs(
  p_project_id uuid,
  p_user_id uuid,
  p_kind text,
  p_metric text,
  p_metric_period text,
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
     or p_cutoff is null or p_metric is null or p_metric_period is null then
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
      public.usage_key_for_job(p_metric, p_metric_period, v_job.usage_reserved_at)
    );
    v_expired := v_expired + 1;
  end loop;

  return v_expired;
end;
$$;

drop function if exists public.expire_stale_generation_jobs_for_user(uuid, text, text, boolean, timestamptz);

create or replace function public.expire_stale_generation_jobs_for_user(
  p_user_id uuid,
  p_kind text,
  p_metric text,
  p_metric_period text,
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
     or p_metric is null or p_metric_period is null then
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
      public.usage_key_for_job(p_metric, p_metric_period, v_job.usage_reserved_at)
    );
    v_expired := v_expired + 1;
  end loop;

  return v_expired;
end;
$$;

-- Same posture as every other counter function: a user's own session must not
-- be able to move a counter that gates them.
revoke all on function public.usage_key_for_job(text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.expire_stale_generation_jobs(uuid, uuid, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.expire_stale_generation_jobs_for_user(uuid, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.usage_key_for_job(text, text, timestamptz) to service_role;
grant execute on function public.expire_stale_generation_jobs(uuid, uuid, text, text, text, timestamptz) to service_role;
grant execute on function public.expire_stale_generation_jobs_for_user(uuid, text, text, text, timestamptz) to service_role;

commit;
