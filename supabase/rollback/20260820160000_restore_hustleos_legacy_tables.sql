-- Restores the six pre-repo Hustle OS tables dropped by
-- supabase/migrations/20260820160000_drop_hustleos_legacy_tables.sql
--
-- RECONSTRUCTED, NOT COPIED. No migration in this repository ever created these
-- tables. Every column name, type, default, nullability, primary key and
-- foreign key below was read from the live PostgREST schema on 2026-08-20
-- before the drop. What that source does not expose — the real `on delete`
-- actions, unique/check constraints, secondary indexes, and the RLS policies —
-- is NOT reproduced here. See supabase/rollback/README.md.
--
-- All six were empty, so there is no data to reload.
--
-- RLS is enabled with no policy, which is the safe default: the tables become
-- readable only by the service role until someone deliberately writes a policy.
-- That is a stricter posture than they had, and intentionally so.

begin;

create table if not exists public.workshops (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  scheduled_at timestamp with time zone not null,
  duration_minutes integer not null default 60,
  max_seats integer not null default 20,
  meeting_url text not null,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create table if not exists public.workshop_registrations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  workshop_id uuid not null references public.workshops (id) on delete cascade,
  registered_at timestamp with time zone not null default timezone('utc'::text, now())
);

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  day_number integer not null,
  title text not null,
  description text not null,
  action_prompt text not null,
  reflection_prompt text not null,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create table if not exists public.challenge_progress (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  reflection_text text,
  completed_at timestamp with time zone not null default timezone('utc'::text, now())
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create table if not exists public.course_lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  module_number integer not null,
  lesson_number integer not null,
  title text not null,
  content text not null,
  action_prompt text not null,
  reflection_prompt text not null,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

alter table public.workshops              enable row level security;
alter table public.workshop_registrations enable row level security;
alter table public.challenges             enable row level security;
alter table public.challenge_progress     enable row level security;
alter table public.courses                enable row level security;
alter table public.course_lessons         enable row level security;

commit;
