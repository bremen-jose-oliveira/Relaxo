-- Enable Supabase Realtime on household care tables so partner phones
-- can pull within seconds of a change (postgres_changes).
-- Run in Supabase SQL Editor after 0021_sleep_context.sql.

-- Publication may already exist on hosted Supabase.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- Safer: add tables idempotently (ignore if already members).
do $$
declare
  tbl text;
  tables text[] := array[
    'sleep_events',
    'sleep_pauses',
    'feeding_events',
    'diaper_events',
    'bath_events',
    'wake_events',
    'day_context_tags',
    'babies',
    'daily_chores',
    'daily_chore_completions'
  ];
begin
  foreach tbl in array tables loop
    begin
      execute format(
        'alter publication supabase_realtime add table public.%I',
        tbl
      );
    exception
      when duplicate_object then
        null;
      when undefined_table then
        raise notice 'skip missing table %', tbl;
    end;
  end loop;
end $$;

-- DELETE events with filters need full old row identity.
alter table public.sleep_events replica identity full;
alter table public.sleep_pauses replica identity full;
alter table public.feeding_events replica identity full;
alter table public.diaper_events replica identity full;
alter table public.bath_events replica identity full;
alter table public.wake_events replica identity full;
alter table public.day_context_tags replica identity full;
alter table public.babies replica identity full;
alter table public.daily_chores replica identity full;
alter table public.daily_chore_completions replica identity full;
