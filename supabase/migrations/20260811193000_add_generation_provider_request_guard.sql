-- Makes "at most two provider requests" a property of the database.
--
-- WHY THIS IS NEEDED NOW
--
-- Generation used to run inside one request, where the ceiling of two provider
-- calls — one generation, at most one repair — was enforced by a counter in
-- memory. That worked because there was only ever one execution.
--
-- The pipeline now runs from a queue, and a queue delivers at least once. A
-- redelivered message re-enters the same code with the same arguments, and an
-- in-memory counter starts at zero again. Nothing in the message, and nothing
-- in the handler, can tell the second delivery from the first — so the guard
-- has to live where the state does.
--
-- HOW IT WORKS
--
-- One counter on the job, and a compare-and-swap to move it. The generation
-- phase claims by passing 0, the repair phase by passing 1. A second delivery
-- of either finds the counter already past its expected value and is refused,
-- so it returns without calling the provider. Ordering falls out of the same
-- rule: a repair cannot claim before a generation has, because until then the
-- counter is 0 and the repair expects 1.
--
-- The row is locked for the check and the increment together. Two deliveries
-- racing in different regions therefore cannot both read 0 and both proceed,
-- which is the one failure that would cost real money.
--
-- This is a marker on the existing job, not a second job model. The job row
-- remains the only product and accounting state; `generation_jobs.status`,
-- the usage reservation and the stale sweep are all unchanged.

begin;

alter table public.generation_jobs
  add column if not exists provider_requests integer not null default 0;

alter table public.generation_jobs
  drop constraint if exists generation_jobs_provider_requests_check;
alter table public.generation_jobs
  add constraint generation_jobs_provider_requests_check
  check (provider_requests >= 0 and provider_requests <= 2);

-- Claims the right to make one provider request. Returns true at most once per
-- expected value, for the lifetime of the job.
create or replace function public.claim_generation_provider_request(
  p_job_id uuid,
  p_expected integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.generation_jobs%rowtype;
begin
  if p_job_id is null or p_expected is null or p_expected < 0 then
    raise exception using errcode = '22023', message = 'claim_generation_provider_request: invalid arguments';
  end if;

  select * into v_job
  from public.generation_jobs
  where id = p_job_id
  for update;

  -- No job, or one that has already finished. A delivery that arrives after a
  -- stale sweep ended the job must not restart the work it was refunded for.
  if not found then return false; end if;
  if v_job.status not in ('queued', 'running') then return false; end if;

  -- Already claimed by an earlier delivery of this same phase.
  if v_job.provider_requests <> p_expected then return false; end if;

  update public.generation_jobs
  set provider_requests = p_expected + 1,
      heartbeat_at = now()
  where id = p_job_id;

  return true;
end;
$$;

revoke all on function public.claim_generation_provider_request(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_generation_provider_request(uuid, integer) to service_role;

commit;
