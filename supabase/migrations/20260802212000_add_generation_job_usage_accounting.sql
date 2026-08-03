-- Makes the usage reservation behind a generation job durable and idempotent.
--
-- THE BUG THIS FIXES
--
-- Generation runs inline. The sequence was: claim the job, consume one unit of
-- quota, call the model, and release the unit from a catch block if anything
-- went wrong. A catch block only runs if the process is still alive. When the
-- request was killed instead — a serverless timeout, a deploy, a lost
-- connection — nothing released the unit. `expireStale` later marked the job
-- failed but touched no counter, so the quota stayed spent on work that never
-- produced anything. With a first-version limit of 1, one badly timed crash
-- locked a user out of the product's central action permanently.
--
-- Moving the release into `expireStale`'s application code would not have been
-- enough for two reasons. It could release a unit that was never reserved (the
-- process can also die between claiming the job and consuming quota), and the
-- release itself could be lost to the very same class of crash it exists to
-- compensate for.
--
-- So the reservation state lives on the job row, and every transition is a
-- single transaction:
--
--   * usage_reserved_at — this job holds exactly one unit.
--   * usage_released_at — that unit has been given back, once.
--
-- Both are timestamps rather than booleans because knowing *when* quota was
-- reserved is what makes a stuck counter diagnosable later. This is the whole
-- mechanism: no ledger, no transaction log, no generic billing. Two columns
-- and the rule that only a job that reserved may release.

begin;

alter table public.generation_jobs
  add column if not exists usage_reserved_at timestamptz,
  add column if not exists usage_released_at timestamptz;

-- A job cannot have given back what it never took.
alter table public.generation_jobs
  drop constraint if exists generation_jobs_usage_order_check;
alter table public.generation_jobs
  add constraint generation_jobs_usage_order_check
  check (usage_released_at is null or usage_reserved_at is not null);

-- Reserves quota and records that fact on the job in one transaction.
--
-- This atomicity is the point. Consuming first and stamping second leaves a
-- window where quota is spent but the job does not know it, which is the
-- original bug in miniature; stamping first and consuming second leaves the
-- mirror-image window where a release would give back a unit nobody took.
-- Neither window exists if both happen or neither does.
create or replace function public.reserve_generation_job_usage(
  p_job_id uuid,
  p_user_id uuid,
  p_metric text,
  p_limit integer
)
returns table (allowed boolean, used_count integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.generation_jobs%rowtype;
  v_used integer;
begin
  if p_job_id is null or p_user_id is null or p_metric is null or p_limit is null or p_limit < 0 then
    raise exception using errcode = '22023', message = 'reserve_generation_job_usage: invalid arguments';
  end if;

  select * into v_job
  from public.generation_jobs
  where id = p_job_id and user_id = p_user_id
  for update;

  -- Not this user's job, or no job at all. Fail closed: the caller treats a
  -- raised error as an infrastructure problem and never reaches the model.
  if not found then
    raise exception using errcode = 'P0002', message = 'reserve_generation_job_usage: job not found';
  end if;

  if v_job.status not in ('queued', 'running') then
    raise exception using errcode = '22023', message = 'reserve_generation_job_usage: job is not in flight';
  end if;

  -- Already reserved. A replay of the same attempt must not spend a second
  -- unit, so report the existing reservation rather than making a new one.
  if v_job.usage_reserved_at is not null then
    select u.used into v_used
    from public.user_ai_usage u
    where u.user_id = p_user_id and u.metric = p_metric;
    return query select true, coalesce(v_used, 0);
    return;
  end if;

  insert into public.user_ai_usage (user_id, metric)
  values (p_user_id, p_metric)
  on conflict (user_id, metric) do nothing;

  select u.used into v_used
  from public.user_ai_usage u
  where u.user_id = p_user_id and u.metric = p_metric
  for update;

  if v_used >= p_limit then
    return query select false, v_used;
    return;
  end if;

  v_used := v_used + 1;
  update public.user_ai_usage
  set used = v_used
  where user_id = p_user_id and metric = p_metric;

  update public.generation_jobs
  set usage_reserved_at = now()
  where id = p_job_id;

  return query select true, v_used;
end;
$$;

-- Gives back the unit a job reserved, at most once, and never for a job that
-- actually produced something.
--
-- Returns true only when a release genuinely happened, so callers can tell a
-- real compensation from a no-op. Every guard is read under the same row lock
-- that the write takes, which is what makes "exactly once" true even when two
-- stale sweeps and a failure handler all fire at the same moment.
create or replace function public.release_generation_job_usage(
  p_job_id uuid,
  p_metric text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.generation_jobs%rowtype;
begin
  if p_job_id is null or p_metric is null then
    raise exception using errcode = '22023', message = 'release_generation_job_usage: invalid arguments';
  end if;

  select * into v_job
  from public.generation_jobs
  where id = p_job_id
  for update;

  if not found then return false; end if;
  -- Nothing was ever taken for this job.
  if v_job.usage_reserved_at is null then return false; end if;
  -- Already given back.
  if v_job.usage_released_at is not null then return false; end if;
  -- The work succeeded. The unit was earned and is not refundable.
  if v_job.status = 'succeeded' then return false; end if;

  update public.user_ai_usage
  set used = greatest(used - 1, 0)
  where user_id = v_job.user_id and metric = p_metric;

  update public.generation_jobs
  set usage_released_at = now()
  where id = p_job_id;

  return true;
end;
$$;

-- Ends jobs that stopped breathing, and refunds whatever they were holding.
--
-- Marking the job failed and releasing its unit are one transaction, so the
-- crash that killed the original request cannot also strand its compensation
-- half-done. The heartbeat cutoff is re-checked under the row lock, so a job
-- that is merely slow can never be closed out from under itself.
create or replace function public.expire_stale_generation_jobs(
  p_project_id uuid,
  p_user_id uuid,
  p_kind text,
  p_cutoff timestamptz,
  p_metric text
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
  if p_project_id is null or p_user_id is null or p_kind is null or p_cutoff is null or p_metric is null then
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

    perform public.release_generation_job_usage(v_job.id, p_metric);
    v_expired := v_expired + 1;
  end loop;

  return v_expired;
end;
$$;

-- Same posture as consume_ai_usage and release_ai_usage: a counter a user's
-- own session could move is not a counter.
revoke all on function public.reserve_generation_job_usage(uuid, uuid, text, integer) from public, anon, authenticated;
revoke all on function public.release_generation_job_usage(uuid, text) from public, anon, authenticated;
revoke all on function public.expire_stale_generation_jobs(uuid, uuid, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.reserve_generation_job_usage(uuid, uuid, text, integer) to service_role;
grant execute on function public.release_generation_job_usage(uuid, text) to service_role;
grant execute on function public.expire_stale_generation_jobs(uuid, uuid, text, timestamptz, text) to service_role;

commit;
