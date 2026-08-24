-- ============================================================================
-- Collapse near-duplicate events on cloud (same baby + same start MINUTE).
-- Paste WHOLE file → Run once in Supabase SQL Editor.
--
-- AFTER THIS (important — or doubles come back):
--   1) Do NOT sync from a phone that still has doubles.
--   2) Delete Relaxo on BOTH phones (or at least every phone that had doubles).
--   3) Reinstall → sign in → join invite → Sync.
-- ============================================================================

begin;

-- Breastfeeds: keep 1 per baby + start_minute (prefer sided, then newest)
with ranked as (
  select id,
    row_number() over (
      partition by baby_id, left(start_time, 16)
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

-- Other feed types: same minute + same feed_type
with ranked as (
  select id,
    row_number() over (
      partition by baby_id, feed_type, left(start_time, 16)
      order by updated_at desc nulls last, id
    ) as rn
  from public.feeding_events
  where deleted_at is null
    and feed_type <> 'breast'
)
update public.feeding_events t
set deleted_at = now(), updated_at = now()
from ranked
where t.id = ranked.id and ranked.rn > 1;

-- Sleeps/naps: same baby + type + start minute
with ranked as (
  select id,
    row_number() over (
      partition by baby_id, type, left(start_time, 16)
      order by updated_at desc nulls last, id
    ) as rn
  from public.sleep_events
  where deleted_at is null
)
update public.sleep_events t
set deleted_at = now(), updated_at = now()
from ranked
where t.id = ranked.id and ranked.rn > 1;

-- Soft-delete pauses for removed sleeps
update public.sleep_pauses p
set deleted_at = now(), updated_at = now()
where p.deleted_at is null
  and p.sleep_event_id in (
    select id from public.sleep_events where deleted_at is not null
  );

-- Diapers: same baby + type + time minute
with ranked as (
  select id,
    row_number() over (
      partition by baby_id, diaper_type, left(time, 16)
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
      partition by baby_id, left(time, 16)
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
      partition by baby_id, wake_type, left(time, 16)
      order by updated_at desc nulls last, id
    ) as rn
  from public.wake_events
  where deleted_at is null
)
update public.wake_events t
set deleted_at = now(), updated_at = now()
from ranked
where t.id = ranked.id and ranked.rn > 1;

commit;

-- Should be 0
select 'breast_same_minute' as kind, count(*) as dup_groups from (
  select 1 from public.feeding_events
  where deleted_at is null and feed_type = 'breast'
  group by baby_id, left(start_time, 16) having count(*) > 1
) x
union all
select 'sleep_same_minute', count(*) from (
  select 1 from public.sleep_events
  where deleted_at is null
  group by baby_id, type, left(start_time, 16) having count(*) > 1
) y;
