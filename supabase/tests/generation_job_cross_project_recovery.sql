-- ============================================================================
-- Cross-project stale recovery: a dead hold in project A must not block a new
-- generation in project B, and must not touch anybody else's account.
-- Same shape as above: everything runs, asserts, then throws and rolls back.
-- ============================================================================
do $test2$
declare
  v_user uuid;
  v_other_user uuid;
  v_project_a uuid;
  v_project_b uuid;
  v_other_project uuid;
  v_job_a uuid;
  v_job_b uuid;
  v_other_job uuid;
  v_metric text := 'first_version_generation';
  v_used integer;
  v_ok boolean;
  v_n integer;
  v_cutoff timestamptz;
  v_log text := '';
  v_fail integer := 0;
begin
  -- A user who owns at least two projects, and an unrelated second user.
  select user_id into v_user from public.projects group by user_id having count(*) >= 2 limit 1;
  select id into v_project_a from public.projects where user_id = v_user order by created_at limit 1;
  select id into v_project_b from public.projects where user_id = v_user and id <> v_project_a order by created_at limit 1;
  select user_id, id into v_other_user, v_other_project
  from public.projects where user_id <> v_user limit 1;

  -- Start from a known, clean state for this account.
  update public.generation_jobs set status = 'failed', error_code = 'stale'
  where user_id in (v_user, v_other_user) and status in ('queued', 'running');
  insert into public.user_ai_usage (user_id, metric) values (v_user, v_metric)
  on conflict (user_id, metric) do nothing;
  update public.user_ai_usage set used = 0 where user_id = v_user and metric = v_metric;

  v_cutoff := now() - interval '5 minutes';

  ----------------------------------------------------------------------------
  -- Project A: a job that crashed mid-generation, still holding its unit.
  ----------------------------------------------------------------------------
  insert into public.generation_jobs (project_id, user_id, kind, status, request_id, progress_stage, attempt_count, started_at, heartbeat_at)
  values (v_project_a, v_user, 'first_version', 'running', 'x:a-stale', 'generating', 1, now() - interval '40 minutes', now() - interval '40 minutes')
  returning id into v_job_a;
  perform public.reserve_generation_job_usage(v_job_a, v_user, v_metric, 1);

  select used into v_used from public.user_ai_usage where user_id = v_user and metric = v_metric;
  if v_used = 1 then v_log := v_log || 'PASS  project A holds the account''s only unit' || chr(10);
  else v_log := v_log || format('FAIL  setup: used=%s%s', v_used, chr(10)); v_fail := v_fail + 1; end if;

  -- Another user, also stale, also holding a unit. Must survive untouched.
  insert into public.user_ai_usage (user_id, metric) values (v_other_user, v_metric)
  on conflict (user_id, metric) do nothing;
  update public.user_ai_usage set used = 0 where user_id = v_other_user and metric = v_metric;
  insert into public.generation_jobs (project_id, user_id, kind, status, request_id, progress_stage, attempt_count, started_at, heartbeat_at)
  values (v_other_project, v_other_user, 'first_version', 'running', 'x:other-stale', 'generating', 1, now() - interval '40 minutes', now() - interval '40 minutes')
  returning id into v_other_job;
  perform public.reserve_generation_job_usage(v_other_job, v_other_user, v_metric, 1);

  ----------------------------------------------------------------------------
  -- Before the fix this was the blocker: reserving for B while A holds.
  ----------------------------------------------------------------------------
  insert into public.generation_jobs (project_id, user_id, kind, status, request_id, attempt_count, started_at, heartbeat_at)
  values (v_project_b, v_user, 'first_version', 'running', 'x:b-1', 1, now(), now())
  returning id into v_job_b;
  select r.allowed into v_ok from public.reserve_generation_job_usage(v_job_b, v_user, v_metric, 1) r;
  if not v_ok then v_log := v_log || 'PASS  without cleanup, project B is blocked (the bug)' || chr(10);
  else v_log := v_log || 'FAIL  project B reserved while A held the unit' || chr(10); v_fail := v_fail + 1; end if;

  ----------------------------------------------------------------------------
  -- The fix: sweep the whole account, then reserve.
  ----------------------------------------------------------------------------
  select public.expire_stale_generation_jobs_for_user(v_user, 'first_version', v_cutoff, v_metric) into v_n;
  if v_n = 1 then v_log := v_log || 'PASS  account sweep ended exactly the stale job' || chr(10);
  else v_log := v_log || format('FAIL  sweep ended %s jobs%s', v_n, chr(10)); v_fail := v_fail + 1; end if;

  select (status = 'failed' and error_code = 'stale' and error_message = 'Generation stopped responding and was ended.'
          and finished_at is not null and usage_released_at is not null)
    into v_ok from public.generation_jobs where id = v_job_a;
  if v_ok then v_log := v_log || 'PASS  project A failed with the safe stale error and released' || chr(10);
  else v_log := v_log || 'FAIL  project A row state wrong after sweep' || chr(10); v_fail := v_fail + 1; end if;

  select used into v_used from public.user_ai_usage where user_id = v_user and metric = v_metric;
  if v_used = 0 then v_log := v_log || 'PASS  the unit came back to the account' || chr(10);
  else v_log := v_log || format('FAIL  after sweep used=%s%s', v_used, chr(10)); v_fail := v_fail + 1; end if;

  select r.allowed into v_ok from public.reserve_generation_job_usage(v_job_b, v_user, v_metric, 1) r;
  select used into v_used from public.user_ai_usage where user_id = v_user and metric = v_metric;
  if v_ok and v_used = 1 then v_log := v_log || 'PASS  project B can now reserve' || chr(10);
  else v_log := v_log || format('FAIL  project B still blocked: allowed=%s used=%s%s', v_ok, v_used, chr(10)); v_fail := v_fail + 1; end if;

  ----------------------------------------------------------------------------
  -- Repeating the sweep must not refund again, and must not touch B.
  ----------------------------------------------------------------------------
  select public.expire_stale_generation_jobs_for_user(v_user, 'first_version', v_cutoff, v_metric) into v_n;
  select used into v_used from public.user_ai_usage where user_id = v_user and metric = v_metric;
  if v_n = 0 and v_used = 1 then v_log := v_log || 'PASS  repeating the sweep refunds nothing more' || chr(10);
  else v_log := v_log || format('FAIL  repeat sweep: ended=%s used=%s%s', v_n, v_used, chr(10)); v_fail := v_fail + 1; end if;

  select (status = 'running') into v_ok from public.generation_jobs where id = v_job_b;
  if v_ok then v_log := v_log || 'PASS  project B''s healthy job survived the sweep' || chr(10);
  else v_log := v_log || 'FAIL  sweep ended the healthy job in B' || chr(10); v_fail := v_fail + 1; end if;

  ----------------------------------------------------------------------------
  -- The other user is untouched.
  ----------------------------------------------------------------------------
  select (status = 'running' and usage_released_at is null) into v_ok
  from public.generation_jobs where id = v_other_job;
  select used into v_used from public.user_ai_usage where user_id = v_other_user and metric = v_metric;
  if v_ok and v_used = 1 then v_log := v_log || 'PASS  another user''s stale job and quota are untouched' || chr(10);
  else v_log := v_log || format('FAIL  crossed accounts: other_running=%s other_used=%s%s', v_ok, v_used, chr(10)); v_fail := v_fail + 1; end if;

  ----------------------------------------------------------------------------
  -- A succeeded job stays charged even when the sweep runs over it.
  ----------------------------------------------------------------------------
  update public.generation_jobs set status = 'succeeded', progress_stage = 'completed', finished_at = now()
  where id = v_job_b;
  select public.expire_stale_generation_jobs_for_user(v_user, 'first_version', now() + interval '1 minute', v_metric) into v_n;
  select used into v_used from public.user_ai_usage where user_id = v_user and metric = v_metric;
  select (usage_released_at is null and status = 'succeeded') into v_ok from public.generation_jobs where id = v_job_b;
  if v_n = 0 and v_used = 1 and v_ok then v_log := v_log || 'PASS  a succeeded job stays charged and unswept' || chr(10);
  else v_log := v_log || format('FAIL  succeeded job disturbed: ended=%s used=%s intact=%s%s', v_n, v_used, v_ok, chr(10)); v_fail := v_fail + 1; end if;

  ----------------------------------------------------------------------------
  -- A stale job that never reserved is still ended, but refunds nothing.
  ----------------------------------------------------------------------------
  update public.generation_jobs set status = 'failed' where id = v_job_b;
  insert into public.generation_jobs (project_id, user_id, kind, status, request_id, attempt_count, started_at, heartbeat_at)
  values (v_project_b, v_user, 'first_version', 'running', 'x:b-noreserve', 2, now() - interval '40 minutes', now() - interval '40 minutes');
  select public.expire_stale_generation_jobs_for_user(v_user, 'first_version', v_cutoff, v_metric) into v_n;
  select used into v_used from public.user_ai_usage where user_id = v_user and metric = v_metric;
  if v_n = 1 and v_used = 1 then v_log := v_log || 'PASS  unreserved stale job ended without a refund' || chr(10);
  else v_log := v_log || format('FAIL  unreserved sweep: ended=%s used=%s%s', v_n, v_used, chr(10)); v_fail := v_fail + 1; end if;

  raise exception using message = format('%sRESULT: %s failing assertions. Everything above is rolled back.', chr(10) || v_log, v_fail);
end;
$test2$;
