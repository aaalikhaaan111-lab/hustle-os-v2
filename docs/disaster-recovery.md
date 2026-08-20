# Disaster recovery

## The situation, as measured on 2026-08-20

```
supabase backups list --project-ref bggkxahxogcdidbrnutx
  → {"region":"ap-southeast-1","walg_enabled":true,"pitr_enabled":false,"backups":[]}
```

**There are no automatic database backups.** The physical backup list is empty
and point-in-time recovery is off. The project is on a plan that includes
neither — the same entitlement check that refuses Custom Domains
(`entitlement_required: custom_domain`) is what gates them.

**Worst-case RPO today is total loss.** Not an hour, not a day: if the database
is dropped there is nothing on the platform to restore from. `scripts/backup.mts`
exists because of that, and its RPO is "whenever it was last run".

This is the single highest-severity item in the product. It is a plan change,
not a code change, and it is listed under *Manual actions* below.

## What is irreplaceable, and what is not

| Data | Where | Replaceable? |
| --- | --- | --- |
| Generated app source | `projects.snapshot_fields` | **No** — regenerating costs provider spend and produces a *different* app |
| Publications, slugs | `project_publications` | **No** — a slug is a live public URL |
| Conversations and turns | `project_ai_*` | **No** |
| Profiles, preferences, plan | `profiles` | **No** |
| Visitor responses | `project_responses` | **No** — someone else's submission |
| Feedback analyses | `project_feedback_analyses` | Derived, but expensive to recreate |
| Thumbnails | Storage `project-thumbnails` (16 objects, 8.6 MB) | **Yes** — the worker re-captures from `projects` |
| Proof uploads | Storage `project-proofs` | Empty (0 objects) |
| Quota counters | `user_ai_usage` | Yes — resets at the period boundary |
| Rate-limit counters | `rate_limit_events` | Yes, and should not be restored |
| Job queue | `generation_jobs` | Yes, and should not be restored |

**Storage is not a gap today**, which is worth stating precisely because it
usually is: database backups never restore deleted Storage objects, and the
usual advice is to back Storage up separately. Here the only populated bucket is
regenerable from rows the export already contains, and the other is empty. If
`project-proofs` ever receives real uploads, that stops being true and Storage
needs its own copy.

## Taking a backup

```bash
npx tsx --env-file=.env.local --conditions=react-server scripts/backup.mts
```

Writes `backups/<timestamp>/` — NDJSON per table plus `manifest.json`.
`backups/` is gitignored; the output contains real user data and must never be
committed. Credentials come from the environment and are never written out.

## Verifying a backup without touching production

```bash
python3 - <<'PY'
import json, glob, os
d = sorted(glob.glob("backups/*/"))[-1]
man = json.load(open(os.path.join(d, "manifest.json")))
for t, meta in man["tables"].items():
    n = sum(1 for line in open(os.path.join(d, f"{t}.ndjson")) if line.strip() and json.loads(line))
    print(f"{t:<28}{n:>6} lines  manifest {meta['rows']:>6}  {'OK' if n == meta['rows'] else 'MISMATCH'}")
print("complete:", man["complete"])
PY
```

Every line must parse and every count must match the manifest. **A dump nobody
has parsed is a dump nobody should trust.** Last run 2026-08-20: 8 tables,
557 rows, all OK.

## Before any dangerous migration

Anything containing `drop`, `alter … type`, `delete`, or a destructive `update`:

1. Run the backup above and confirm `manifest.json` reports `"complete": true`.
2. If the migration drops a table, **also archive that table's rows** — the
   recurring backup covers the live schema, not what is about to leave it.
3. Write the matching rollback DDL *before* applying, not after.

A migration that has already run is not the moment to discover the export was
broken.

### The 2026-08-20 legacy cleanup, as the worked example

Thirteen tables were dropped: six pre-repo Hustle OS tables (all empty), the
retired Venture OS and workshop quiz tables, and the retired build system's
tasks/outputs/proofs. 166 rows in total. The procedure was:

```bash
# 1. archive what is leaving — 13 tables, one file each
npx tsx --env-file=.env.local scripts/archive-legacy.mts

# 2. verify it line-for-line against the manifest, then
# 3. back up the live schema as well
npx tsx --env-file=.env.local --conditions=react-server scripts/backup.mts

# 4. only then
supabase db push --linked
```

`scripts/archive-legacy.mts` is a one-shot tool, deliberately separate from
`backup.mts` and deliberately written against raw REST rather than the typed
client — `src/types/supabase.ts` stops modelling those tables once it is
regenerated, and the archive has to stay runnable against a pre-cleanup
database forever.

## Rollback

`DROP TABLE` is not reversible by Postgres. Rollback needs **two** halves, and
neither is any use alone:

| Half | Where |
| --- | --- |
| Structure | `supabase/rollback/*.sql` |
| Data | `backups/legacy-<timestamp>/*.ndjson` |

See `supabase/rollback/README.md` for the order and for what the reconstructed
DDL of the six pre-repo tables can and cannot promise.

## Restoring the whole database

No destructive restore has been performed against production, and none should be
rehearsed there. To rehearse safely, create a scratch Supabase project, apply
`supabase/migrations/` to it, then load the NDJSON:

```bash
# per table, into the SCRATCH project — never production
npx tsx --env-file=.env.scratch --conditions=react-server scripts/restore.mts <backup-dir>
```

`scripts/restore.mts` does not exist yet, deliberately: a restore tool pointed at
the wrong project is the fastest way to cause the disaster it exists to fix.
Write it when there is a scratch project to point it at, and make the target
project ref a required argument rather than an environment default.

Order matters on load — `projects` before `project_publications` and the
`project_ai_*` tables, because of foreign keys.

## What a restore does NOT bring back

- **`auth.users`.** Supabase owns it; the service role cannot dump it through
  PostgREST. Rows in `profiles` reference user ids that would no longer exist.
  Restoring identities is a Supabase-side operation, and on the current plan
  there is no mechanism for it at all. **This is the sharpest edge of the current
  situation:** even a perfect data restore would leave every project ownerless.
- **`generation_jobs`, `rate_limit_events`.** Deliberately excluded. A restored
  queue re-runs finished work and re-spends quota.
- **Storage objects.** See the table above — regenerable today.

## Reconciling auth.users against profiles

`handle_new_user()` provisions a profile inside the signup transaction. Since
2026-08-20 it also **catches its own failures** rather than aborting the signup
(`20260820160300_fix_new_user_profile_identity.sql`) — the account is created
either way, and a failure is a `warning` in the Postgres log rather than a
"Database error saving new user" shown to the person signing up.

That trade means a missing profile is now possible where it used to be
impossible, so it has to be checkable. This is the query:

```sql
select u.id, u.email, u.created_at
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
order by u.created_at;
```

Expected: **zero rows.** One row existed before that migration — an account from
2026-07-11 10:39:49, created in the nine minutes before the trigger was first
applied, with no identities and no sign-ins — and the migration inserted it.

To repair anything this finds, re-run the two idempotent statements at the
bottom of that migration; both are `on conflict do nothing` / null-guarded and
safe to apply repeatedly.

## Manual actions required

1. **Upgrade the Supabase project to Pro** — this is the fix. Pro includes daily
   automatic backups with 7-day retention; PITR is an additional add-on that
   reduces RPO to minutes. Until then `scripts/backup.mts` is the only copy and
   its RPO is however long ago somebody last ran it.
2. Once Pro is active, re-run `supabase backups list` and confirm the list is no
   longer empty, then decide whether PITR's cost is justified by the RPO it buys.
3. Schedule the export anyway — a copy that lives outside the platform survives
   an account-level problem that platform backups do not.
