-- Add gamification progress fields to profiles.

alter table public.profiles
  add column if not exists xp integer not null default 0,
  add column if not exists streak_days integer not null default 0,
  add column if not exists last_activity_at date;
