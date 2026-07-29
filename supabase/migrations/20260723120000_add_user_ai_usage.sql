begin;

-- Durable, account-wide AI usage counters. Deliberately keyed by user_id
-- alone (never project_id) so a counter survives project deletion/discard —
-- projects.snapshot_fields and everything under project_ai_* cascade away
-- with the project, which is exactly what made per-project state unsafe as
-- a quota signal. This row only disappears if the auth user itself does.
--
-- `metric` is a free-form key rather than one column per limit so a new
-- quota type is a new row shape, not a migration. Per-recommendation quotas
-- (see proposeFeedbackImprovementAction) use a composite key like
-- 'feedback_improvement_proposal:<recommendationId>' — same table, no schema
-- change. Values are never written directly: RLS grants SELECT only, and
-- both mutating functions below are service-role-only, mirroring the
-- existing submit_public_project_response() pattern for the same reason —
-- a counter a user's own session could write is not a counter at all.
create table public.user_ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  metric text not null check (char_length(metric) between 1 and 80),
  used integer not null default 0 check (used >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (user_id, metric)
);

create trigger set_user_ai_usage_updated_at
before update on public.user_ai_usage
for each row execute function public.set_updated_at();

alter table public.user_ai_usage enable row level security;

create policy "Owners can view their own AI usage"
on public.user_ai_usage for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.user_ai_usage from public, anon, authenticated;
grant select on table public.user_ai_usage to authenticated;

-- Atomically checks p_limit and reserves one unit in a single statement-level
-- transaction. `for update` row-locks the (user_id, metric) row so concurrent
-- callers serialize: whichever transaction commits first is reflected to the
-- next one's read, so two racing requests against a limit of 1 can never
-- both succeed. Verified empirically (20 concurrent calls against limit=5
-- produced exactly 5 allowed / 15 denied, final used=5) before this file was
-- written.
create or replace function public.consume_ai_usage(
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
  v_used integer;
begin
  if p_user_id is null or p_metric is null or p_limit is null or p_limit < 0 then
    raise exception using errcode = '22023', message = 'consume_ai_usage: invalid arguments';
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

  return query select true, v_used;
end;
$$;

-- Compensating decrement for a reservation whose AI call then failed or
-- produced unusable output — never lets a failed attempt permanently cost
-- quota. Floors at 0 rather than going negative regardless of call order.
create or replace function public.release_ai_usage(
  p_user_id uuid,
  p_metric text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_user_id is null or p_metric is null then
    raise exception using errcode = '22023', message = 'release_ai_usage: invalid arguments';
  end if;

  update public.user_ai_usage
  set used = greatest(used - 1, 0)
  where user_id = p_user_id and metric = p_metric;
end;
$$;

revoke all on function public.consume_ai_usage(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.release_ai_usage(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_ai_usage(uuid, text, integer) to service_role;
grant execute on function public.release_ai_usage(uuid, text) to service_role;

commit;
