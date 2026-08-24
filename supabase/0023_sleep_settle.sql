-- Settle details (Einschlafdauer / Qualität / Hilfe / Schlafort).
-- Run in Supabase SQL Editor after 0021_sleep_context.sql.

alter table public.sleep_events
  add column if not exists settle_minutes integer
  check (settle_minutes is null or settle_minutes >= 0);

alter table public.sleep_events
  add column if not exists settle_quality text
  check (
    settle_quality is null
    or settle_quality in ('calm', 'restless', 'fussy', 'fighting')
  );

alter table public.sleep_events
  add column if not exists settle_aid text
  check (
    settle_aid is null
    or settle_aid in (
      'breast', 'held', 'on_mom', 'on_dad', 'visual_shield', 'combination'
    )
  );

alter table public.sleep_events
  add column if not exists sleep_place text
  check (
    sleep_place is null
    or sleep_place in ('mom', 'dad', 'crib')
  );
