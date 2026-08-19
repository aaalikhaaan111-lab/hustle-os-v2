-- Burst limiting, in the database, because that is the only shared surface.
--
-- WHY NOT IN THE APPLICATION. Vercel runs each request in its own isolate.
-- An in-memory counter there limits one lambda, not one user: the second
-- concurrent request lands somewhere else with an empty map and passes. Every
-- in-process limiter is a limiter that does not limit.
--
-- WHY THIS IS NOT THE SAME AS QUOTA. `consume_ai_usage` and the plan
-- entitlements already cap what somebody may spend in a MONTH, and they are
-- correct. Neither says anything about a minute: an account with thirty
-- generations left can start all thirty in ten seconds, and nothing in the
-- product stops it. This is that missing dimension, and it sits in front of
-- quota rather than replacing it — a request has to pass both.
--
-- ATOMICITY. The count and the insert happen under a transaction-scoped
-- advisory lock keyed on subject+action, so two simultaneous requests cannot
-- both read "4 used of 5" and both proceed. The lock is released with the
-- transaction whatever happens.

begin;

create table if not exists public.rate_limit_events (
  id bigserial primary key,
  -- 'user:<uuid>' when authenticated, 'ip:<hmac>' when not. Opaque on purpose:
  -- this table must never become a log of who did what from where.
  subject text not null,
  action text not null,
  created_at timestamptz not null default now()
);

-- The only query this table serves: recent events for one subject and action.
create index if not exists rate_limit_events_window_idx
  on public.rate_limit_events (action, subject, created_at desc);

-- Locked down entirely. There are no policies, so with RLS on, only the service
-- role and the SECURITY DEFINER function below can reach it. The API roles get
-- nothing at all — a client can neither read others' activity nor forge its own.
alter table public.rate_limit_events enable row level security;
revoke all on public.rate_limit_events from anon, authenticated;

/**
 * Records one attempt and says whether it is allowed.
 *
 * Returns { allowed, retry_after, remaining }. `retry_after` is whole seconds
 * until the oldest event in the window expires, which is exactly the moment a
 * slot frees — so it is a real Retry-After, not a fixed guess.
 */
create or replace function public.consume_rate_limit(
  p_subject text,
  p_action text,
  p_limit int,
  p_window_seconds int
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
  v_oldest timestamptz;
  v_cutoff timestamptz := now() - make_interval(secs => p_window_seconds);
begin
  if p_subject is null or p_action is null or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid rate limit arguments';
  end if;

  -- Serialise this subject+action for the rest of the transaction.
  perform pg_advisory_xact_lock(hashtextextended(p_action || ':' || p_subject, 0));

  select count(*), min(created_at)
    into v_count, v_oldest
  from public.rate_limit_events
  where action = p_action
    and subject = p_subject
    and created_at > v_cutoff;

  if v_count >= p_limit then
    return jsonb_build_object(
      'allowed', false,
      'retry_after', greatest(
        1,
        ceil(extract(epoch from (v_oldest + make_interval(secs => p_window_seconds)) - now()))::int
      ),
      'remaining', 0
    );
  end if;

  insert into public.rate_limit_events (subject, action) values (p_subject, p_action);

  /**
   * Opportunistic cleanup, so nothing has to schedule a job.
   *
   * One caller in a hundred pays for a bounded delete of rows no window can
   * still reach. The index makes it cheap, and skipping it entirely would only
   * mean the table grows — never that a limit stops working.
   */
  if random() < 0.01 then
    delete from public.rate_limit_events where created_at < now() - interval '1 day';
  end if;

  return jsonb_build_object('allowed', true, 'retry_after', 0, 'remaining', p_limit - v_count - 1);
end;
$$;

-- Reached only through the service role from server code, never from a browser.
revoke all on function public.consume_rate_limit(text, text, int, int) from anon, authenticated;

commit;
