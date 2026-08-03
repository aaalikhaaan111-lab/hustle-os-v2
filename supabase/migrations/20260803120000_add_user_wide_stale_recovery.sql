-- Recovers abandoned generation jobs across a user's whole account.
--
-- THE GAP THIS CLOSES
--
-- Stale jobs were only ever swept for the project being looked at. Quota,
-- though, is user-wide: `first_version_generation` is one unit per account, not
-- one per project. So a crash while generating project A left a unit reserved
-- against a job nobody would look at again, and the user hit "already used your
-- free generation" on project B — blocked by work that never produced anything,
-- with the only cure being to reopen a project they had no reason to reopen.
--
-- The sweep therefore has to be scoped the same way the quota is. This runs at
-- the one moment it matters: immediately before a new first-version generation
-- checks the limit, so the counter it reads is already free of dead holds.
--
-- Deliberately not a cron job. The condition is only interesting when someone
-- is about to spend quota, and that is exactly when this runs — a scheduled
-- sweeper would do the same work on a timer for no additional benefit, and add
-- a moving part the deployment does not currently have.
--
-- Guards are inherited rather than reimplemented: the row lock and cutoff
-- re-check prevent closing a job that is merely slow, the status filter skips
-- anything already finished, the user filter cannot reach another account, and
-- release_generation_job_usage decides on its own whether a refund is owed.
-- A stale job that never reserved is still ended — leaving it `running` would
-- block the account's next generation forever and spin the interface — it
-- simply gets no refund, because there is nothing to refund.

begin;

create or replace function public.expire_stale_generation_jobs_for_user(
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
  if p_user_id is null or p_kind is null or p_cutoff is null or p_metric is null then
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

    -- Returns false when this job held nothing. Exactly-once is the function's
    -- guarantee, not this loop's.
    perform public.release_generation_job_usage(v_job.id, p_metric);
    v_expired := v_expired + 1;
  end loop;

  return v_expired;
end;
$$;

revoke all on function public.expire_stale_generation_jobs_for_user(uuid, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.expire_stale_generation_jobs_for_user(uuid, text, timestamptz, text) to service_role;

commit;
