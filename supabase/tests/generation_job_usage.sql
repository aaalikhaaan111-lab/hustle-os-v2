-- Exercises the generation-job usage functions against the real schema and
-- then throws, so the whole thing rolls back and nothing persists. The final
-- exception message carries the assertion log.
--
-- Only one job may be active per project at a time (that is the point of the
-- partial unique index), so each case finishes its job before the next begins.
do $test$
declare
  v_user uuid;
  v_project uuid;
  v_job uuid;
  v_metric text := 'first_version_generation';
  v_used_start integer;
  v_used integer;
  v_ok boolean;
  v_n integer;
  v_log text := '';
  v_fail integer := 0;
begin
  select p.user_id, p.id into v_user, v_project
  from public.projects p order by p.created_at desc limit 1;

  select coalesce(used, 0) into v_used_start
  from public.user_ai_usage where user_id = v_user and metric = v_metric;
  v_used_start := coalesce(v_used_start, 0);

  -- Clear the decks: this project may legitimately have an active job.
  update public.generation_jobs set status = 'failed', error_code = 'stale'
  where project_id = v_project and status in ('queued', 'running');

  ----------------------------------------------------------------------------
  -- 1. reserve consumes exactly one unit and stamps the job
  ----------------------------------------------------------------------------
  insert into public.generation_jobs (project_id, user_id, kind, status, request_id, progress_stage, attempt_count, started_at, heartbeat_at)
  values (v_project, v_user, 'first_version', 'running', 'test:1', 'preparing', 1, now(), now())
  returning id into v_job;

  select r.used_count into v_used from public.reserve_generation_job_usage(v_job, v_user, v_metric, 99) r;
  if v_used = v_used_start + 1 then v_log := v_log || 'PASS  reserve increments by one' || chr(10);
  else v_log := v_log || format('FAIL  reserve: used=%s expected=%s%s', v_used, v_used_start + 1, chr(10)); v_fail := v_fail + 1; end if;

  select (usage_reserved_at is not null) into v_ok from public.generation_jobs where id = v_job;
  if v_ok then v_log := v_log || 'PASS  usage_reserved_at stamped' || chr(10);
  else v_log := v_log || 'FAIL  usage_reserved_at not stamped' || chr(10); v_fail := v_fail + 1; end if;

  ----------------------------------------------------------------------------
  -- 2. reserve is idempotent: a replay must not spend a second unit
  ----------------------------------------------------------------------------
  perform public.reserve_generation_job_usage(v_job, v_user, v_metric, 99);
  select used into v_used from public.user_ai_usage where user_id = v_user and metric = v_metric;
  if v_used = v_used_start + 1 then v_log := v_log || 'PASS  reserve replay does not double-charge' || chr(10);
  else v_log := v_log || format('FAIL  reserve replay: used=%s%s', v_used, chr(10)); v_fail := v_fail + 1; end if;

  ----------------------------------------------------------------------------
  -- 3. release refunds exactly once
  ----------------------------------------------------------------------------
  update public.generation_jobs set status = 'failed', error_code = 'provider_unavailable' where id = v_job;
  select public.release_generation_job_usage(v_job, v_metric) into v_ok;
  select used into v_used from public.user_ai_usage where user_id = v_user and metric = v_metric;
  if v_ok and v_used = v_used_start then v_log := v_log || 'PASS  release refunds one unit' || chr(10);
  else v_log := v_log || format('FAIL  release: returned=%s used=%s%s', v_ok, v_used, chr(10)); v_fail := v_fail + 1; end if;

  select public.release_generation_job_usage(v_job, v_metric) into v_ok;
  select used into v_used from public.user_ai_usage where user_id = v_user and metric = v_metric;
  if not v_ok and v_used = v_used_start then v_log := v_log || 'PASS  second release is a no-op' || chr(10);
  else v_log := v_log || format('FAIL  double release: returned=%s used=%s%s', v_ok, v_used, chr(10)); v_fail := v_fail + 1; end if;
  delete from public.generation_jobs where id = v_job;

  ----------------------------------------------------------------------------
  -- 4. reserve refuses at the limit, and stamps nothing
  ----------------------------------------------------------------------------
  insert into public.generation_jobs (project_id, user_id, kind, status, request_id, attempt_count, started_at, heartbeat_at)
  values (v_project, v_user, 'first_version', 'running', 'test:limit', 1, now(), now())
  returning id into v_job;

  select r.allowed into v_ok from public.reserve_generation_job_usage(v_job, v_user, v_metric, v_used_start) r;
  select used into v_used from public.user_ai_usage where user_id = v_user and metric = v_metric;
  if not v_ok and v_used = v_used_start then v_log := v_log || 'PASS  reserve denied at limit, counter untouched' || chr(10);
  else v_log := v_log || format('FAIL  limit path: allowed=%s used=%s%s', v_ok, v_used, chr(10)); v_fail := v_fail + 1; end if;

  select (usage_reserved_at is null) into v_ok from public.generation_jobs where id = v_job;
  if v_ok then v_log := v_log || 'PASS  denied job holds no reservation' || chr(10);
  else v_log := v_log || 'FAIL  denied job was stamped as reserved' || chr(10); v_fail := v_fail + 1; end if;

  ----------------------------------------------------------------------------
  -- 5. release on a job that never reserved refunds nothing
  ----------------------------------------------------------------------------
  select public.release_generation_job_usage(v_job, v_metric) into v_ok;
  select used into v_used from public.user_ai_usage where user_id = v_user and metric = v_metric;
  if not v_ok and v_used = v_used_start then v_log := v_log || 'PASS  release without reservation refunds nothing' || chr(10);
  else v_log := v_log || format('FAIL  phantom release: returned=%s used=%s%s', v_ok, v_used, chr(10)); v_fail := v_fail + 1; end if;
  delete from public.generation_jobs where id = v_job;

  ----------------------------------------------------------------------------
  -- 6. a succeeded job never refunds
  ----------------------------------------------------------------------------
  insert into public.generation_jobs (project_id, user_id, kind, status, request_id, attempt_count, started_at, heartbeat_at)
  values (v_project, v_user, 'first_version', 'running', 'test:success', 1, now(), now())
  returning id into v_job;
  perform public.reserve_generation_job_usage(v_job, v_user, v_metric, 99);
  update public.generation_jobs set status = 'succeeded' where id = v_job;
  select public.release_generation_job_usage(v_job, v_metric) into v_ok;
  select used into v_used from public.user_ai_usage where user_id = v_user and metric = v_metric;
  if not v_ok and v_used = v_used_start + 1 then v_log := v_log || 'PASS  succeeded job keeps its unit' || chr(10);
  else v_log := v_log || format('FAIL  succeeded refunded: returned=%s used=%s%s', v_ok, v_used, chr(10)); v_fail := v_fail + 1; end if;
  delete from public.generation_jobs where id = v_job;
  update public.user_ai_usage set used = v_used_start where user_id = v_user and metric = v_metric;

  ----------------------------------------------------------------------------
  -- 7. stale expiry fails the job AND refunds, exactly once
  ----------------------------------------------------------------------------
  insert into public.generation_jobs (project_id, user_id, kind, status, request_id, progress_stage, attempt_count, started_at, heartbeat_at)
  values (v_project, v_user, 'first_version', 'running', 'test:stale', 'generating', 1, now() - interval '30 minutes', now() - interval '30 minutes')
  returning id into v_job;
  perform public.reserve_generation_job_usage(v_job, v_user, v_metric, 99);

  select public.expire_stale_generation_jobs(v_project, v_user, 'first_version', now() - interval '5 minutes', v_metric) into v_n;
  select used into v_used from public.user_ai_usage where user_id = v_user and metric = v_metric;
  if v_n = 1 and v_used = v_used_start then v_log := v_log || 'PASS  stale expiry refunds the reserved unit' || chr(10);
  else v_log := v_log || format('FAIL  stale expiry: expired=%s used=%s%s', v_n, v_used, chr(10)); v_fail := v_fail + 1; end if;

  select (status = 'failed' and error_code = 'stale' and finished_at is not null and usage_released_at is not null)
    into v_ok from public.generation_jobs where id = v_job;
  if v_ok then v_log := v_log || 'PASS  stale job failed, finished_at and release stamped' || chr(10);
  else v_log := v_log || 'FAIL  stale job row state wrong' || chr(10); v_fail := v_fail + 1; end if;

  select public.expire_stale_generation_jobs(v_project, v_user, 'first_version', now() - interval '5 minutes', v_metric) into v_n;
  select used into v_used from public.user_ai_usage where user_id = v_user and metric = v_metric;
  if v_n = 0 and v_used = v_used_start then v_log := v_log || 'PASS  repeated stale sweep releases nothing more' || chr(10);
  else v_log := v_log || format('FAIL  repeat sweep: expired=%s used=%s%s', v_n, v_used, chr(10)); v_fail := v_fail + 1; end if;
  delete from public.generation_jobs where id = v_job;

  ----------------------------------------------------------------------------
  -- 8. a healthy job is never swept
  ----------------------------------------------------------------------------
  insert into public.generation_jobs (project_id, user_id, kind, status, request_id, attempt_count, started_at, heartbeat_at)
  values (v_project, v_user, 'first_version', 'running', 'test:healthy', 1, now(), now())
  returning id into v_job;
  select public.expire_stale_generation_jobs(v_project, v_user, 'first_version', now() - interval '5 minutes', v_metric) into v_n;
  select (status = 'running') into v_ok from public.generation_jobs where id = v_job;
  if v_n = 0 and v_ok then v_log := v_log || 'PASS  healthy job survives the sweep' || chr(10);
  else v_log := v_log || format('FAIL  healthy job swept: expired=%s%s', v_n, chr(10)); v_fail := v_fail + 1; end if;

  ----------------------------------------------------------------------------
  -- 9. only one active job per project
  ----------------------------------------------------------------------------
  begin
    insert into public.generation_jobs (project_id, user_id, kind, status, request_id, attempt_count, started_at, heartbeat_at)
    values (v_project, v_user, 'first_version', 'running', 'test:duplicate', 2, now(), now());
    v_log := v_log || 'FAIL  second active job was allowed' || chr(10); v_fail := v_fail + 1;
  exception when unique_violation then
    v_log := v_log || 'PASS  second active job rejected by unique index' || chr(10);
  end;

  ----------------------------------------------------------------------------
  -- 10. reserve refuses a job that is no longer in flight
  ----------------------------------------------------------------------------
  update public.generation_jobs set status = 'failed' where id = v_job;
  begin
    perform public.reserve_generation_job_usage(v_job, v_user, v_metric, 99);
    v_log := v_log || 'FAIL  reserve accepted a finished job' || chr(10); v_fail := v_fail + 1;
  exception when others then
    v_log := v_log || 'PASS  reserve refuses a finished job' || chr(10);
  end;

  ----------------------------------------------------------------------------
  -- 11. the same request_id cannot be replayed into a second row
  ----------------------------------------------------------------------------
  begin
    insert into public.generation_jobs (project_id, user_id, kind, status, request_id, attempt_count, started_at, heartbeat_at)
    values (v_project, v_user, 'first_version', 'running', 'test:healthy', 2, now(), now());
    v_log := v_log || 'FAIL  request_id replay created a second row' || chr(10); v_fail := v_fail + 1;
  exception when unique_violation then
    v_log := v_log || 'PASS  request_id replay rejected by idempotency constraint' || chr(10);
  end;

  ----------------------------------------------------------------------------
  -- 12. usage_released_at cannot exist without usage_reserved_at
  ----------------------------------------------------------------------------
  begin
    update public.generation_jobs set usage_released_at = now(), usage_reserved_at = null where id = v_job;
    v_log := v_log || 'FAIL  release-without-reserve was accepted' || chr(10); v_fail := v_fail + 1;
  exception when check_violation then
    v_log := v_log || 'PASS  release-without-reserve rejected by check constraint' || chr(10);
  end;

  raise exception using message = format('%sRESULT: %s failing assertions. Everything above is rolled back.', chr(10) || v_log, v_fail);
end;
$test$;
