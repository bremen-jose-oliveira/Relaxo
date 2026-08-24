-- ============================================================================
-- Relaxo — find & soft-delete exact duplicate events (Supabase)
-- File: supabase/dedupe-cloud-duplicates.sql
-- ============================================================================
-- Exact duplicate = same baby + same kind + same timestamp (+ same side/type/notes).
-- Soft-deletes extras; keeps 1 row (newest updated_at).
--
-- Steps:
--   1. Run SECTION A (SELECT) — one query at a time — review results
--   2. Run SECTION B (UPDATE) — only if Section A looked correct
--   3. Phones: Settings → Sync now
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- SECTION A — DIAGNOSTICS (safe)
-- ────────────────────────────────────────────────────────────────────────────

-- A1) Sleeps / naps
select household_id, baby_id, type, start_time, end_time,
       count(*) as n, array_agg(id order by id) as ids
from public.sleep_events
where deleted_at is null
group by household_id, baby_id, type, start_time, end_time
having count(*) > 1;

-- A2) Feedings (breast / bottle / solid)
select household_id, baby_id, feed_type, start_time, end_time, side, amount, unit, notes,
       count(*) as n, array_agg(id order by id) as ids
from public.feeding_events
where deleted_at is null
group by household_id, baby_id, feed_type, start_time, end_time, side, amount, unit, notes
having count(*) > 1;

-- A3) Diapers
select household_id, baby_id, diaper_type, time, notes,
       count(*) as n, array_agg(id order by id) as ids
from public.diaper_events
where deleted_at is null
group by household_id, baby_id, diaper_type, time, notes
having count(*) > 1;

-- A4) Baths
select household_id, baby_id, time, notes,
       count(*) as n, array_agg(id order by id) as ids
from public.bath_events
where deleted_at is null
group by household_id, baby_id, time, notes
having count(*) > 1;

-- A5) Wakes
select household_id, baby_id, wake_type, time, end_time, notes,
       count(*) as n, array_agg(id order by id) as ids
from public.wake_events
where deleted_at is null
group by household_id, baby_id, wake_type, time, end_time, notes
having count(*) > 1;

-- A6) Day tags
select household_id, baby_id, date_key, tag,
       count(*) as n, array_agg(id order by id) as ids
from public.day_context_tags
where deleted_at is null
group by household_id, baby_id, date_key, tag
having count(*) > 1;


-- ────────────────────────────────────────────────────────────────────────────
-- SECTION B — CLEANUP (soft-delete extras)
-- Run only after Section A looks good. You can run all B blocks together.
-- ────────────────────────────────────────────────────────────────────────────

-- B1) Sleeps
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

-- B1b) Soft-delete pauses for deleted sleeps
update public.sleep_pauses p
set deleted_at = now(), updated_at = now()
where p.deleted_at is null
  and p.sleep_event_id in (
    select id from public.sleep_events where deleted_at is not null
  );

-- B2) Feedings
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

-- B3) Diapers
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

-- B4) Baths
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

-- B5) Wakes
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

-- B6) Day tags
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


-- ────────────────────────────────────────────────────────────────────────────
-- SECTION C — OPTIONAL: left+right breastfeeds at the SAME start_time → keep 1
-- Uncomment only if you want those pairs collapsed.
-- ────────────────────────────────────────────────────────────────────────────

-- select household_id, baby_id, start_time, count(*) as n,
--        array_agg(side order by side) as sides,
--        array_agg(id order by id) as ids
-- from public.feeding_events
-- where deleted_at is null and feed_type = 'breast'
-- group by household_id, baby_id, start_time
-- having count(*) > 1;

-- with ranked as (
--   select id,
--     row_number() over (
--       partition by household_id, baby_id, start_time
--       order by
--         case when side is null then 1 else 0 end,
--         updated_at desc nulls last,
--         id
--     ) as rn
--   from public.feeding_events
--   where deleted_at is null and feed_type = 'breast'
-- )
-- update public.feeding_events t
-- set deleted_at = now(), updated_at = now()
-- from ranked
-- where t.id = ranked.id and ranked.rn > 1;
