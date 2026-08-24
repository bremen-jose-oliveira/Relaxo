-- Optional: only if something is still missing after sync works.
-- Run ONE statement at a time in SQL Editor (avoids deadlocks with live API traffic).
-- Skip any step that errors with "already exists".

-- 1) Sleep extension column
alter table public.sleep_events
  add column if not exists extension text;

-- 2) Chore reminder column
alter table public.daily_chores
  add column if not exists reminder_minutes integer;

-- 3) Day tags table (skip if it already exists)
-- create table if not exists … — only needed when table is missing

-- 4) Completions RLS alone (retry if deadlock; wait ~10s and run again)
alter table public.daily_chore_completions enable row level security;

drop policy if exists "daily_chore_completions_all" on public.daily_chore_completions;

create policy "daily_chore_completions_all" on public.daily_chore_completions
  for all using (household_id in (select public.user_household_ids()))
  with check (household_id in (select public.user_household_ids()));

notify pgrst, 'reload schema';
