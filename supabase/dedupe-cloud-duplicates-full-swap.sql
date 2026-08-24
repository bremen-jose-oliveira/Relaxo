-- ============================================================================
-- Relaxo — FULL SWAP: soft-delete all exact duplicates in one run
-- File: supabase/dedupe-cloud-duplicates-full-swap.sql
-- ============================================================================
-- Paste the WHOLE file into Supabase SQL Editor → Run once.
-- Soft-deletes exact twins (same baby + kind + time + side/type/notes).
-- Keeps 1 row per group (newest updated_at).
-- Then: both phones → Settings → Sync now
--   (or reinstall the messy phone and join with invite code).
-- ============================================================================

begin;

-- Sleeps
with ranked as (
  select id,
    row_number() over (
      partition by household_id, baby_id, type, start_time, end_time
      order by updated_at desc nulls last, id
    ) as rn
  from public.sleep_events
  where deleted_at is null
)
update public.sleep_events t
set deleted_at = now(), updated_at = now()
from ranked
where t.id = ranked.id and ranked.rn > 1;

-- Pauses for soft-deleted sleeps
update public.sleep_pauses p
set deleted_at = now(), updated_at = now()
where p.deleted_at is null
  and p.sleep_event_id in (
    select id from public.sleep_events where deleted_at is not null
  );

-- Feedings
with ranked as (
  select id,
    row_number() over (
      partition by household_id, baby_id, feed_type, start_time, end_time, side, amount, unit, notes
      order by updated_at desc nulls last, id
    ) as rn
  from public.feeding_events
  where deleted_at is null
)
update public.feeding_events t
set deleted_at = now(), updated_at = now()
from ranked
where t.id = ranked.id and ranked.rn > 1;

-- Diapers
with ranked as (
  select id,
    row_number() over (
      partition by household_id, baby_id, diaper_type, time, notes
      order by updated_at desc nulls last, id
    ) as rn
  from public.diaper_events
  where deleted_at is null
)
update public.diaper_events t
set deleted_at = now(), updated_at = now()
from ranked
where t.id = ranked.id and ranked.rn > 1;

-- Baths
with ranked as (
  select id,
    row_number() over (
      partition by household_id, baby_id, time, notes
      order by updated_at desc nulls last, id
    ) as rn
  from public.bath_events
  where deleted_at is null
)
update public.bath_events t
set deleted_at = now(), updated_at = now()
from ranked
where t.id = ranked.id and ranked.rn > 1;

-- Wakes
with ranked as (
  select id,
    row_number() over (
      partition by household_id, baby_id, wake_type, time, end_time, notes
      order by updated_at desc nulls last, id
    ) as rn
  from public.wake_events
  where deleted_at is null
)
update public.wake_events t
set deleted_at = now(), updated_at = now()
from ranked
where t.id = ranked.id and ranked.rn > 1;

-- Day tags
with ranked as (
  select id,
    row_number() over (
      partition by household_id, baby_id, date_key, tag
      order by updated_at desc nulls last, id
    ) as rn
  from public.day_context_tags
  where deleted_at is null
)
update public.day_context_tags t
set deleted_at = now(), updated_at = now()
from ranked
where t.id = ranked.id and ranked.rn > 1;

-- Also collapse left+right (or empty+sided) breastfeeds at the SAME start_time
with ranked as (
  select id,
    row_number() over (
      partition by household_id, baby_id, start_time
      order by
        case when side is null then 1 else 0 end,
        updated_at desc nulls last,
        id
    ) as rn
  from public.feeding_events
  where deleted_at is null
    and feed_type = 'breast'
)
update public.feeding_events t
set deleted_at = now(), updated_at = now()
from ranked
where t.id = ranked.id and ranked.rn > 1;

commit;

-- Quick check: these should return 0 rows if cleanup worked
select 'sleeps' as kind, count(*) as dup_groups from (
  select 1 from public.sleep_events where deleted_at is null
  group by household_id, baby_id, type, start_time, end_time having count(*) > 1
) s
union all
select 'feedings_exact', count(*) from (
  select 1 from public.feeding_events where deleted_at is null
  group by household_id, baby_id, feed_type, start_time, end_time, side, amount, unit, notes having count(*) > 1
) f
union all
select 'breast_same_start', count(*) from (
  select 1 from public.feeding_events where deleted_at is null and feed_type = 'breast'
  group by household_id, baby_id, start_time having count(*) > 1
) b;
