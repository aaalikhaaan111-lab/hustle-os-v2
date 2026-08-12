# The generation worker

Runs Ventrio's first-version generation outside Vercel.

## Why it is a separate process

Generation takes two to four minutes. Three attempts to run it inside a Vercel
function failed in three different ways: a 300 s timeout that killed the work
mid-flight, and twice an invocation that simply stopped executing — heartbeats,
the provider abort and the consumer's own wall-clock deadline all ceasing in the
same instant, with no logs, until the platform reaped it. None of those is
addressable from inside the function, because the thing that stopped was the
function.

Vercel keeps everything else: auth, `/create`, the intake, project creation, the
job row, the quota reservation, polling, the workspace, publishing and every
public route. This process owns one sentence:

    a job with a payload → Gemini → parse → validate → compile → persist

## How it finds work

`generation_jobs` is the only job model. The web action claims a job, reserves a
quota unit, writes `payload` (the composed brief, locale and pinned model) and
returns in milliseconds. The worker polls for rows that are `queued`/`running`,
have `provider_requests = 0` and carry a payload.

Selecting is not owning. Two workers may read the same row; exactly one wins
`claim_generation_provider_request(id, 0)`, a compare-and-swap under a row lock,
and the loser skips without spending anything. That is the same guard the
in-Vercel executor used — there is no parallel accounting.

A worker that crashes mid-job leaves `provider_requests = 1`, so no second
worker can pay for the same generation. The stale sweep ends and refunds the job
after five minutes without a heartbeat, and the person is offered Retry.

## Running it

    npm run worker

Requires, and refuses to start without:

| Variable | Why |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | which database to poll |
| `SUPABASE_SERVICE_ROLE_KEY` | job rows have SELECT-only RLS; writes need the service role |
| `GEMINI_API_KEY` | the provider. Read here, never stored on a job row |
| `VENTRIO_APP_RUNTIME=1` | the same flag the web app gates the runtime on |

Optional: `VENTRIO_WORKER_IDLE_MS` (5000), `VENTRIO_WORKER_BACKOFF_MS` (30000),
`VENTRIO_WORKER_SWEEP_EVERY` (12 ticks).

Do not copy unrelated Vercel variables. It needs no Anthropic key, no PostHog
token, no site URL, no rate-limit secret.

## Deploying to Railway

`railway.json` sets the start command; there is no HTTP server and no health
endpoint, because a poller has nothing to serve and Railway restarts on exit.

1. New service from this repo.
2. Set the four variables above.
3. Deploy. `started` appears in the logs within seconds.

Render works the same way as a Background Worker with `npm run worker`.

## Reading the logs

One structured line per event, and never a prompt, a key or generated source:

    started          the process is polling
    job_claimed      jobId, projectId, briefChars
    job_finished     outcome, durationMs, and the gate's issues when refused
    job_threw        the run threw; the row is left for the stale sweep
    stale_recovered  jobs the sweep ended and refunded
    draining         SIGTERM/SIGINT: no new work, current job finishes

`briefChars` is a length, deliberately. The brief itself is the person's idea.
