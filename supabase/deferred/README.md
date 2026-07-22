# Deferred migrations (do not apply)

Files here are intentionally kept **out** of `supabase/migrations/` so `supabase db push`
never applies them.

- `20260722120000_add_project_sprints.sql.hold` — the retired Sprint architecture.
  The V1 product pivot dropped user-facing sprints, so `project_sprints` must **not**
  be created. The only useful pieces (a `projects.iteration` version counter and a
  widened `projects.status` allowing `paused`/`archived`) will be reintroduced in the
  upcoming publishing migration if still needed. Kept for reference only.
