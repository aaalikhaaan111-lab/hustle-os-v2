# The free generation allowance

Written 2026-08-06, replacing the lifetime one-generation-per-account limit.

## What it is

Every free allowance is **per UTC day**, and every one of them refills:

| allowance | metric | per day |
| --- | --- | --- |
| first-version generations | `first_version_generation` | 3 (configurable) |
| edits to an existing version | `project_edit` | 5 |
| discovery messages | `discovery_turn` | 12 |

They are separate counters: generating does not spend edits, and running out of
discovery messages does not stop a generation.

All three used to be lifetime allowances. Raising only the generation limit
would have moved the wall rather than removed it — an account out of discovery
turns cannot start another creation conversation however many generations it
has left, which is exactly what happened while testing this change.

## Where it is enforced

Server-side only, in three layers. The client is never the enforcement point —
the Build button reflects the state, it does not decide it.

1. `src/lib/ai/usage.ts` owns the numbers, the per-day window and the ledger key.
2. `reserveUsage()` in `src/lib/jobs/generationJobs.ts` takes the unit, through
   the job row, after the job is claimed and before the model is called.
3. Postgres does the arithmetic: `consume_ai_usage` and
   `reserve_generation_job_usage` are `security definer`, granted to
   `service_role` only, and row-lock the counter so concurrent requests
   serialise. `user_ai_usage` grants `SELECT` to the owner and nothing else, so
   no session can write its own counter.

## What counts as one generation

One unit per **successful** generation, held against the job that produced it.

- Reserved after `claimJob` wins the idempotency race, so a duplicate submit
  collides on the request id instead of starting a second model call.
- The request id is derived (`first-version:<n>`), not random, so a replayed
  click cannot create a second job or a second charge.
- A failure releases the unit (`releaseAndFail` → `release_generation_job_usage`).
  A success never refunds — the unit was earned.
- A job that crashes without releasing is reclaimed account-wide by
  `expireStaleForUser` before the limit is next read.

So a failed generation does not consume the allowance, and retrying a failed
generation does not double-charge, duplicate the job, or create a second
version.

## Raising generations for local testing

Set this in `.env.local` — it needs no code change and no database edit:

```
VENTRIO_FREE_GENERATIONS_PER_DAY=20
```

The value is validated on read: missing, non-numeric, zero or negative falls
back to the default, and it is capped at 25. There is deliberately no value
that turns metering off, because the failure mode of a typo here is unmetered
paid generation.

This is the supported way to test repeated generations. Do not edit
`user_ai_usage` rows by hand, and do not commit a raised limit.

## Why a per-day ledger key rather than a schema change

`user_ai_usage.metric` is free-form text and the table was built to carry
composite keys (it already does for per-recommendation quotas). A daily
allowance is therefore just a new key each day — `first_version_generation:
2026-08-06` — and yesterday's row stops being read.

The alternative was adding a window column and changing the counter functions.
Those functions are service-role RPCs that fail closed, so shipping code that
expects a migration nobody has applied yet would block generation for every
user until it was. The key-based window needs no migration at all.

One consequence worth knowing: a refund has to be posted against the day the
unit was taken from, not the day the refund happens. `releaseUsage` reads the
job's `usage_reserved_at` and rebuilds the original key, so a job that fails
just after midnight credits the right day.
