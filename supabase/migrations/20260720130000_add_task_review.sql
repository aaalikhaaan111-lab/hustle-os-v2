-- Build task review: stores the latest AI (or deterministic) review of a
-- task's answer so it survives refresh. Purely additive and backward
-- compatible — existing project_tasks rows get NULLs.
--
-- NOT executed automatically. Apply manually via the Supabase SQL Editor or
-- `supabase db push`. The app degrades gracefully if this hasn't been applied
-- yet: the review gate still works, the review just isn't persisted across a
-- refresh.

alter table public.project_tasks
  add column if not exists review_status text
    check (review_status is null or review_status in ('ready', 'needs_work')),
  add column if not exists review jsonb;
