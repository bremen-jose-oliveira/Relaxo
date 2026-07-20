-- Run in Supabase SQL Editor if partner sync fails on missing tables/columns.
-- Safe to re-run (IF NOT EXISTS / IF NOT EXISTS column).

-- From 0011_sleep_insights.sql
alter table public.sleep_events
  add column if not exists extension text
  check (
    extension is null
    or extension in ('independent', 'feeding', 'rocking', 'contact', 'not_extended')
  );

create table if not exists public.day_context_tags (
  id text primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  baby_id text not null,
  date_key text not null,
  tag text not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (household_id, baby_id, date_key, tag)
);

create index if not exists idx_day_context_tags_household on public.day_context_tags (household_id);

alter table public.day_context_tags enable row level security;

drop policy if exists "day_context_tags_all" on public.day_context_tags;
create policy "day_context_tags_all" on public.day_context_tags
  for all using (household_id in (select public.user_household_ids()))
  with check (household_id in (select public.user_household_ids()));

-- From 0012_task_reminders.sql
alter table public.daily_chores
  add column if not exists reminder_minutes integer;

-- From schema.sql (task completion sync)
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

alter table public.daily_chore_completions enable row level security;

drop policy if exists "daily_chore_completions_all" on public.daily_chore_completions;
create policy "daily_chore_completions_all" on public.daily_chore_completions
  for all using (household_id in (select public.user_household_ids()))
  with check (household_id in (select public.user_household_ids()));

notify pgrst, 'reload schema';
