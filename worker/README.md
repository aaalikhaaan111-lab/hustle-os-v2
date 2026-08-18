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

Three things had to be set on the service, and all three are the kind that fail
loudly once and then never again:

- `NIXPACKS_NODE_VERSION=24`. Nixpacks defaults to Node 18, which this repo does
  not run on. `engines.node` in package.json says the same thing for anyone
  reading, but Nixpacks wants the variable.
- `NIXPACKS_INSTALL_CMD=rm -f package-lock.json && npm install --no-audit --no-fund`.
  Two reasons. Railway's npm resolves a transitive range under `next` to
  `@swc/helpers@0.5.23` where the lock pins 0.5.15, and `npm ci` refuses any
  drift by design. And a lock generated on macOS omits the Linux native binding
  for `@tailwindcss/oxide`, which the compile step needs — that is npm's
  optional-dependency bug (npm/cli#4828), and installing fresh on the target
  platform is the documented remedy. Vercel still builds the web app from the
  lock, where reproducibility matters more than it does for a poller.

1. New service from this repo.
2. Set the four variables above.
3. Deploy. `started` appears in the logs within seconds.

Render works the same way as a Background Worker with `npm run worker`.

## Project thumbnails

The worker also photographs generated apps for the gallery, on ticks where it
found no job to run. This needs a browser, and it is the only thing here that
does.

`playwright-core` is the dependency rather than `playwright` ON PURPOSE: the
latter downloads ~150 MB of Chromium on every install, including Vercel's,
where nothing uses it. So the browser is installed on this host and pointed at:

    # in the build command
    npx playwright install chromium

    # in the environment
    VENTRIO_CHROMIUM_PATH=/root/.cache/ms-playwright/chromium-*/chrome-linux/chrome

On Railway the path is stable per image; `ls /root/.cache/ms-playwright` after
the first build to read it off. Some images also need
`npx playwright install-deps chromium` for the shared libraries.

**Leaving it unset is a supported state.** The worker logs
`thumbnail_unavailable` once and carries on generating; the gallery keeps
drawing the fallbacks it drew before. Capture is the one thing here allowed to
be absent.

Optional tuning: `VENTRIO_THUMBNAIL_BATCH` (default 2) and
`VENTRIO_THUMBNAIL_TIMEOUT_MS` (default 20000).

One more prerequisite, in the database rather than here: the migration
`20260818140000_add_project_thumbnails.sql` creates the storage bucket and —
importantly — stops `set_projects_updated_at` from treating a capture as a
change to the project. Without that carve-out every capture makes its own
project stale again and the worker re-photographs the same handful forever.

## Reading the logs

One structured line per event, and never a prompt, a key or generated source:

    started               the process is polling
    job_claimed           jobId, projectId, briefChars
    job_finished          outcome, durationMs, and the gate's issues when refused
    job_threw             the run threw; the row is left for the stale sweep
    stale_recovered       jobs the sweep ended and refunded
    thumbnail_captured    projectId, bytes, durationMs
    thumbnail_skipped     nothing photographable; the attempt is recorded anyway
    thumbnail_unavailable no browser; capture is off, generation is unaffected
    draining              SIGTERM/SIGINT: no new work, current job finishes

`briefChars` is a length, deliberately. The brief itself is the person's idea.
