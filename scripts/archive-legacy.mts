import { mkdirSync, createWriteStream, writeFileSync } from "node:fs";

/**
 * A one-shot archive of the legacy tables, taken immediately before they are
 * dropped.
 *
 * WHY THIS IS NOT PART OF `backup.mts`. That script is the ongoing disaster
 * recovery copy of the LIVE product, and its table list is deliberately the
 * post-cleanup schema. These thirteen tables are leaving; folding them into the
 * recurring backup would mean every future run failed on relations that no
 * longer exist. This runs once, produces a dated archive, and is then only ever
 * read.
 *
 * WHY IT USES RAW REST RATHER THAN THE TYPED CLIENT. `src/types/supabase.ts` is
 * regenerated after the drops, at which point it stops modelling these tables
 * and a typed `.from("ventures")` would no longer compile. The archive must
 * remain runnable against a pre-cleanup database forever — including a restored
 * copy — so it deliberately depends on nothing but the REST endpoint.
 *
 * WHAT IT COVERS — the three groups from the audit:
 *
 *   pre-repo Hustle OS   workshops, workshop_registrations, challenges,
 *                        challenge_progress, courses, course_lessons
 *   retired Ventrio      ventures, workshop_sessions, workshop_participants,
 *                        workshop_answers
 *   retired build system project_proofs, project_outputs, project_tasks
 *
 *   npx tsx --env-file=.env.local scripts/archive-legacy.mts
 *
 * Writes `backups/legacy-<timestamp>/`, which is gitignored. THIS ARCHIVE IS
 * THE ROLLBACK for the data half of the cleanup; `supabase/rollback/` holds the
 * DDL half. Neither is any use without the other.
 */

const LEGACY_TABLES = [
  "workshops",
  "workshop_registrations",
  "challenges",
  "challenge_progress",
  "courses",
  "course_lessons",
  "ventures",
  "workshop_sessions",
  "workshop_participants",
  "workshop_answers",
  "project_proofs",
  "project_outputs",
  "project_tasks",
] as const;

const PAGE = 500;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("archive-legacy: needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}` };
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dir = new URL(`../backups/legacy-${stamp}/`, import.meta.url);
mkdirSync(dir, { recursive: true });

const manifest: Record<string, { rows: number; bytes: number; complete: boolean }> = {};
let failed = false;

for (const table of LEGACY_TABLES) {
  const out = createWriteStream(new URL(`${table}.ndjson`, dir));
  let from = 0;
  let rows = 0;
  let bytes = 0;
  let complete = true;

  for (;;) {
    /* No ordering: these tables are frozen — nothing writes to them any more —
       so paging cannot skip or repeat a row, and not every one of them has an
       `id` column to order by anyway. */
    const response = await fetch(`${url}/rest/v1/${table}?select=*`, {
      headers: { ...headers, Range: `${from}-${from + PAGE - 1}` },
    });

    if (!response.ok) {
      console.error(`  ${table}: FAILED at offset ${from} — ${response.status} ${await response.text()}`);
      complete = false;
      failed = true;
      break;
    }

    const data = (await response.json()) as unknown[];
    if (data.length === 0) break;

    for (const row of data) {
      const line = `${JSON.stringify(row)}\n`;
      out.write(line);
      bytes += Buffer.byteLength(line);
      rows += 1;
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }

  await new Promise<void>((resolve) => out.end(resolve));
  manifest[table] = { rows, bytes, complete };
  console.log(
    `  ${table.padEnd(24)} ${String(rows).padStart(5)} rows  ${String(Math.round(bytes / 1024)).padStart(5)} kB${complete ? "" : "  INCOMPLETE"}`,
  );
}

writeFileSync(
  new URL("manifest.json", dir),
  `${JSON.stringify(
    {
      takenAt: new Date().toISOString(),
      project: url,
      purpose: "pre-drop archive of legacy tables; see supabase/rollback/ for the matching DDL",
      tables: manifest,
      complete: !failed,
    },
    null,
    2,
  )}\n`,
);

console.log(`\n${failed ? "COMPLETED WITH ERRORS" : "OK"} — backups/legacy-${stamp}/`);
process.exit(failed ? 1 : 0);
