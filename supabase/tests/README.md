# Database accounting tests

The rules that keep AI quota honest live in SQL — `reserve_generation_job_usage`,
`release_generation_job_usage`, and the two stale sweeps — because a reservation
held only in a request's memory is lost when that request is killed, which is
the exact failure they exist to survive. Testing them through a mocked Supabase
client would test the mock, so these run against a real database.

Each file is one `do $$ … $$` block that sets up its own fixtures, asserts, and
then **raises at the end so the whole transaction rolls back**. Nothing
persists: no job rows, no counter movement. The assertion log comes back in the
exception message.

## Running

```sh
npx supabase db query --linked --file supabase/tests/generation_job_usage.sql
npx supabase db query --linked --file supabase/tests/generation_job_cross_project_recovery.sql
```

Run them one file at a time. The final `raise` ends the batch, so a second block
in the same invocation would never execute.

Expected tail of each run:

```
RESULT: 0 failing assertions. Everything above is rolled back.
```

Any `FAIL` line names the assertion and prints the values it saw.

## What each file covers

**`generation_job_usage.sql`** — the accounting primitives: reserve increments
once and stamps the job, replays do not double-charge, release refunds exactly
once, a succeeded job is never refunded, a job that never reserved refunds
nothing, stale expiry both fails and refunds, repeated sweeps refund nothing
more, healthy jobs survive, and the unique / idempotency / check constraints
hold.

**`generation_job_cross_project_recovery.sql`** — the account-wide case. Quota is
per user, not per project, so a crash in project A used to block generation in
project B until someone reopened A. The test reproduces that block first, then
proves the sweep clears it, refunds once, leaves project B's healthy job and
another user's account untouched, and keeps succeeded jobs charged.

## Fixtures

Both files select real users and projects from the database rather than
inserting their own, so they exercise the same shapes production uses. They need
an account with at least two projects and one other account with a project. They
normalise the counters they touch during setup — safe, because the rollback
undoes it.
