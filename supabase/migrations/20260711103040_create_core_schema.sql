-- HUSTLE.OS core schema: profiles, ventures, triggers, and RLS policies.

create extension if not exists "pgcrypto";

-- ============================================================================
-- Tables
-- ============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ventures (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  mission text not null,
  budget text,
  deadline text,
  location text,
  resources text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- Indexes
-- ============================================================================

create index if not exists ventures_owner_id_idx
  on public.ventures (owner_id);

create index if not exists ventures_owner_id_created_at_idx
  on public.ventures (owner_id, created_at desc);

-- ============================================================================
-- updated_at trigger
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_ventures_updated_at on public.ventures;
create trigger set_ventures_updated_at
  before update on public.ventures
  for each row
  execute function public.set_updated_at();

-- ============================================================================
-- Automatic profile creation after signup
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, null)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.ventures enable row level security;

-- profiles: a user may only see and update their own profile row.
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ventures: a user may only insert/select/update/delete their own ventures.
drop policy if exists "Users can view own ventures" on public.ventures;
create policy "Users can view own ventures"
  on public.ventures
  for select
  using (auth.uid() = owner_id);

drop policy if exists "Users can insert own ventures" on public.ventures;
create policy "Users can insert own ventures"
  on public.ventures
  for insert
  with check (auth.uid() = owner_id);

drop policy if exists "Users can update own ventures" on public.ventures;
create policy "Users can update own ventures"
  on public.ventures
  for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "Users can delete own ventures" on public.ventures;
create policy "Users can delete own ventures"
  on public.ventures
  for delete
  using (auth.uid() = owner_id);
