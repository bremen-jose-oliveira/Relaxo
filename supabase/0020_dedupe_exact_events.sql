-- Soft-delete exact duplicate care events in Supabase.
-- "Exact" = same baby + same kind + same time (+ same side/type/end where relevant).
-- Keeps ONE row per group (newest updated_at, then smallest id).
--
-- HOW TO RUN (SQL Editor):
--   1) Run each SELECT under "DIAGNOSTICS" separately and review counts.
--   2) If the numbers look right, run the matching UPDATE block.
--   3) Both phones → Settings → Sync now
--      (or reinstall the messy phone and join with invite code).
--
-- NOTE: Left+right breastfeeds at the same minute are NOT exact duplicates
-- (different side). See OPTIONAL section at the bottom if you want those collapsed.

-- ═══════════════════════════════════════════════════════════════════════════
-- DIAGNOSTICS (safe — run these first)
-- ═══════════════════════════════════════════════════════════════════════════

-- Sleeps: same baby, type, start, end
select household_id, baby_id, type, start_time, end_time, count(*) as n, array_agg(id order by id) as ids
from public.sleep_events
where deleted_at is null
group by household_id, baby_id, type, start_time, end_time
having count(*) > 1;

-- Feedings: same baby, feed_type, start, end, side, amount, unit, notes
select household_id, baby_id, feed_type, start_time, end_time, side, amount, unit, notes,
       count(*) as n, array_agg(id order by id) as ids
from public.feeding_events
where deleted_at is null
group by household_id, baby_id, feed_type, start_time, end_time, side, amount, unit, notes
having count(*) > 1;

-- Diapers
select household_id, baby_id, diaper_type, time, notes, count(*) as n, array_agg(id order by id) as ids
from public.diaper_events
where deleted_at is null
group by household_id, baby_id, diaper_type, time, notes
having count(*) > 1;

-- Baths
select household_id, baby_id, time, notes, count(*) as n, array_agg(id order by id) as ids
from public.bath_events
where deleted_at is null
group by household_id, baby_id, time, notes
having count(*) > 1;

-- Wakes
select household_id, baby_id, wake_type, time, end_time, notes, count(*) as n, array_agg(id order by id) as ids
from public.wake_events
where deleted_at is null
group by household_id, baby_id, wake_type, time, end_time, notes
having count(*) > 1;

-- Day tags (same as 0019)
select household_id, baby_id, date_key, tag, count(*) as n, array_agg(id order by id) as ids
from public.day_context_tags
where deleted_at is null
group by household_id, baby_id, date_key, tag
having count(*) > 1;


-- ═══════════════════════════════════════════════════════════════════════════
-- CLEANUP — exact duplicates only (run after reviewing SELECTs)
-- ═══════════════════════════════════════════════════════════════════════════

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

-- Soft-delete pauses that belonged only to removed sleep rows
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


-- ═══════════════════════════════════════════════════════════════════════════
-- OPTIONAL — collapse left+right breastfeeds that share the same start_time
-- (same minute session logged twice). Keeps the row with a side preferred,
-- then newest. ONLY run if you want those pairs reduced to one feed.
-- Review the SELECT first!
-- ═══════════════════════════════════════════════════════════════════════════

-- select household_id, baby_id, start_time, count(*) as n,
--        array_agg(side order by side) as sides,
--        array_agg(id order by id) as ids
-- from public.feeding_events
-- where deleted_at is null
--   and feed_type = 'breast'
-- group by household_id, baby_id, start_time
-- having count(*) > 1;

-- with ranked as (
--   select id,
--     row_number() over (
--       partition by household_id, baby_id, start_time
--       order by
--         case when side is null then 1 else 0 end,  -- prefer sided
--         updated_at desc nulls last,
--         id
--     ) as rn
--   from public.feeding_events
--   where deleted_at is null
--     and feed_type = 'breast'
-- )
-- update public.feeding_events t
-- set deleted_at = now(), updated_at = now()
-- from ranked
-- where t.id = ranked.id and ranked.rn > 1;
