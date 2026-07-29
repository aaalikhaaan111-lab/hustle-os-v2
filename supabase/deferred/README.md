# Deferred migrations (do not apply)

Files here are intentionally kept **out** of `supabase/migrations/` so `supabase db push`
never applies them.

- `20260722120000_add_project_sprints.sql.hold` — the retired Sprint architecture.
  The V1 product pivot dropped user-facing sprints, so `project_sprints` must **not**
  be created. The only useful pieces (a `projects.iteration` version counter and a
  widened `projects.status` allowing `paused`/`archived`) will be reintroduced in the
  upcoming publishing migration if still needed. Kept for reference only.

- `20260713120000_add_game_progress.sql.hold` — adds `profiles.xp`, `streak_days`,
  `last_activity_at` for cross-device gamification sync. **Not obsolete** — this is
  real, still-wanted product behavior, not dead code: `src/lib/game-progress/GameProgressContext.tsx`
  and `src/lib/actions/game-progress.ts` are written specifically to use these columns
  once they exist, and already degrade gracefully (localStorage-only, per-device XP/streak)
  while they don't. Deferred only because it isn't launch-critical for the current
  product right now, not because the feature is unwanted. Do **not** remove the
  fallback/retry code in those files when this is un-deferred — it's what keeps the
  app working correctly both before and after this migration is eventually applied.

- `20260716120000_add_profile_locale.sql.hold` — adds `profiles.locale` for
  cross-device language-preference sync. **Not obsolete**, same situation as above:
  `src/lib/actions/locale.ts` is written to use this column once it exists, and
  currently degrades gracefully to a cookie-only (per-browser, not per-account)
  preference without it. Deferred only because it isn't launch-critical right now.
  Keep the fallback code in `locale.ts` in place.

- `20260715120000_drop_legacy_venture_tables.sql.hold` — drops `ventures` and several
  pre-Ventrio legacy tables (`workshops`, `workshop_registrations`, `challenge_progress`,
  `challenges`, `course_lessons`, `courses`). Confirmed genuinely obsolete: no code
  anywhere in `src/` queries any of these tables, and `src/types/supabase.ts` no longer
  even models a `ventures` table. Still deferred rather than ever run automatically
  because it's a real destructive `DROP TABLE ... CASCADE` and the actual row data in
  those tables (in the linked project) has not been inspected — review/back up before
  ever applying this for real.
