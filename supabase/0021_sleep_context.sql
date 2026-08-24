-- Optional Napper-style sleep context on sleep_events.
-- Run in Supabase SQL Editor after deploying the app that writes these columns.

alter table public.sleep_events
  add column if not exists onset_method text
  check (
    onset_method is null
    or onset_method in (
      'crib', 'breast', 'held', 'cosleep', 'bottle', 'stroller', 'car', 'swing'
    )
  );

alter table public.sleep_events
  add column if not exists wake_manner text
  check (
    wake_manner is null
    or wake_manner in ('woken', 'self')
  );

alter table public.sleep_events
  add column if not exists wake_mood text
  check (
    wake_mood is null
    or wake_mood in ('fussy', 'ok', 'happy')
  );
