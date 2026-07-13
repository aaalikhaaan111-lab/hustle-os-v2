-- Add Research department report storage to ventures.

alter table public.ventures
  add column if not exists research_report jsonb,
  add column if not exists research_completed_at timestamptz;
