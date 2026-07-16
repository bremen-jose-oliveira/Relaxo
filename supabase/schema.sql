-- Relaxo cloud schema for Supabase (Postgres)
-- Run this in the Supabase SQL Editor after creating your project.
-- Then enable Apple provider under Authentication → Providers.

create extension if not exists "pgcrypto";

-- Profiles mirror auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Family',
  invite_code text not null unique,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index if not exists idx_household_members_user on public.household_members (user_id);

-- Helper: households the current user belongs to
create or replace function public.user_household_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from public.household_members where user_id = auth.uid();
$$;

create table if not exists public.babies (
  id text primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  birth_date text not null,
  nap_goal integer not null default 0,
  track_feeding_duration integer not null default 0,
  easily_overstimulated integer not null default 0,
  high_need integer not null default 0,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_babies_household on public.babies (household_id);

create table if not exists public.sleep_events (
  id text primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  baby_id text not null,
  type text not null check (type in ('nap', 'night')),
  start_time text not null,
  end_time text,
  extension text check (
    extension is null
    or extension in ('independent', 'feeding', 'rocking', 'contact', 'not_extended')
  ),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_sleep_events_household on public.sleep_events (household_id);
create index if not exists idx_sleep_events_baby on public.sleep_events (baby_id);

create table if not exists public.sleep_pauses (
  id text primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  sleep_event_id text not null,
  start_time text not null,
  end_time text,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_sleep_pauses_household on public.sleep_pauses (household_id);

create table if not exists public.feeding_events (
  id text primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  baby_id text not null,
  feed_type text not null check (feed_type in ('breast', 'bottle', 'solid')),
  start_time text not null,
  end_time text,
  side text,
  amount double precision,
  unit text,
  notes text,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_feeding_events_household on public.feeding_events (household_id);

create table if not exists public.diaper_events (
  id text primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  baby_id text not null,
  diaper_type text not null check (diaper_type in ('wet', 'dirty', 'mixed')),
  time text not null,
  notes text,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_diaper_events_household on public.diaper_events (household_id);

create table if not exists public.bath_events (
  id text primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  baby_id text not null,
  time text not null,
  notes text,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_bath_events_household on public.bath_events (household_id);

create table if not exists public.wake_events (
  id text primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  baby_id text not null,
  time text not null,
  end_time text,
  wake_type text not null default 'morning' check (wake_type in ('morning', 'night')),
  notes text,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_wake_events_household on public.wake_events (household_id);

create table if not exists public.daily_chores (
  id text primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  baby_id text not null,
  title text not null,
  sort_order integer not null default 0,
  created_at text not null,
  recurrence text not null default 'daily' check (recurrence in ('daily', 'once')),
  reminder_minutes integer,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_daily_chores_household on public.daily_chores (household_id);

create table if not exists public.daily_chore_completions (
  id text primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  chore_id text not null,
  date_key text not null,
  completed_at text not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_chore_completions_household on public.daily_chore_completions (household_id);

create table if not exists public.day_context_tags (
  id text primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  baby_id text not null,
  date_key text not null,
  tag text not null check (
    tag in (
      'outing', 'visitors', 'cafe', 'transit', 'car', 'vaccination', 'sick',
      'teething', 'baby_class', 'shopping', 'park', 'quiet_home', 'travel'
    )
  ),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (household_id, baby_id, date_key, tag)
);

create index if not exists idx_day_context_tags_household on public.day_context_tags (household_id);
create index if not exists idx_day_context_tags_baby_date on public.day_context_tags (baby_id, date_key);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.babies enable row level security;
alter table public.sleep_events enable row level security;
alter table public.sleep_pauses enable row level security;
alter table public.feeding_events enable row level security;
alter table public.diaper_events enable row level security;
alter table public.bath_events enable row level security;
alter table public.wake_events enable row level security;
alter table public.daily_chores enable row level security;
alter table public.daily_chore_completions enable row level security;
alter table public.day_context_tags enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());

create policy "households_select_member" on public.households
  for select using (id in (select public.user_household_ids()));
create policy "households_insert_auth" on public.households
  for insert with check (created_by = auth.uid());
create policy "households_update_member" on public.households
  for update using (id in (select public.user_household_ids()));

create policy "members_select" on public.household_members
  for select using (household_id in (select public.user_household_ids()) or user_id = auth.uid());
create policy "members_insert_self" on public.household_members
  for insert with check (user_id = auth.uid());
create policy "members_delete_self" on public.household_members
  for delete using (user_id = auth.uid());

-- Data tables: household members can read/write
create policy "babies_all" on public.babies
  for all using (household_id in (select public.user_household_ids()))
  with check (household_id in (select public.user_household_ids()));

create policy "sleep_events_all" on public.sleep_events
  for all using (household_id in (select public.user_household_ids()))
  with check (household_id in (select public.user_household_ids()));

create policy "sleep_pauses_all" on public.sleep_pauses
  for all using (household_id in (select public.user_household_ids()))
  with check (household_id in (select public.user_household_ids()));

create policy "feeding_events_all" on public.feeding_events
  for all using (household_id in (select public.user_household_ids()))
  with check (household_id in (select public.user_household_ids()));

create policy "diaper_events_all" on public.diaper_events
  for all using (household_id in (select public.user_household_ids()))
  with check (household_id in (select public.user_household_ids()));

create policy "bath_events_all" on public.bath_events
  for all using (household_id in (select public.user_household_ids()))
  with check (household_id in (select public.user_household_ids()));

create policy "wake_events_all" on public.wake_events
  for all using (household_id in (select public.user_household_ids()))
  with check (household_id in (select public.user_household_ids()));

create policy "daily_chores_all" on public.daily_chores
  for all using (household_id in (select public.user_household_ids()))
  with check (household_id in (select public.user_household_ids()));

create policy "daily_chore_completions_all" on public.daily_chore_completions
  for all using (household_id in (select public.user_household_ids()))
  with check (household_id in (select public.user_household_ids()));

create policy "day_context_tags_all" on public.day_context_tags
  for all using (household_id in (select public.user_household_ids()))
  with check (household_id in (select public.user_household_ids()));
