-- Add onboarding preferences to profiles.

alter table public.profiles
  add column if not exists interests text[],
  add column if not exists daily_minutes integer,
  add column if not exists onboarding_completed_at timestamptz;
