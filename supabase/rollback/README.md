# Rollback for the 2026-08-20 legacy cleanup

`DROP TABLE` is not reversible by Postgres. "Rollback is possible" therefore
means two artifacts have to exist, and **neither is any use without the other**:

| Half | Where | Covers |
| --- | --- | --- |
| Structure | `supabase/rollback/*.sql` (this directory) | tables, columns, keys, indexes, RLS policies |
| Data | `backups/legacy-<timestamp>/*.ndjson` | the 166 rows that were in them |

Take the structure first, then load the NDJSON. Order matters within a group —
parents before children — and it is the reverse of the drop order.

## Restoring

1. Run the matching `supabase/rollback/<version>_restore_*.sql` against the
   target project.
2. Load the rows from the archive, parents first. `scripts/archive-legacy.mts`
   writes one file per table; each line is a complete row object and can be
   POSTed straight back to `/rest/v1/<table>` with the service role.
3. Re-run `supabase gen types typescript --linked > src/types/supabase.ts` if
   application code is expected to see the tables again.

## What these files are, and are not

`20260820160100` and `20260820160200` restore **verbatim** from the original
migrations, which are still in `supabase/migrations/` — the tables, indexes,
policies and triggers are exactly what Ventrio created. They are faithful.

`20260820160000` is different and weaker. Those six tables predate this
repository, so no migration ever described them. Their DDL here was
**reconstructed from the live PostgREST schema** on 2026-08-20 — real column
names, types, defaults, nullability, primary keys and foreign keys, all read
from the database itself. What that source cannot tell us:

- the real `on delete` action on each foreign key (`cascade` is assumed)
- unique constraints and check constraints
- non-primary-key indexes
- the RLS policies, and whether RLS was enabled at all

Those six tables were **empty**, so there is no data to lose and nothing that
depended on them. Restoring them would give you working tables of the right
shape, not a byte-exact copy of what was dropped. If byte-exact matters, the
Supabase daily backup is the only source that has it — and per
`docs/disaster-recovery.md` this project has none, which is itself the reason to
treat this directory as the safety net it is.
