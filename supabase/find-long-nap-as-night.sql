-- Find naps that look like night sleep (very long duration).
-- 605 minutes ≈ 10h 5m — almost certainly a night sleep logged as nap.
--
-- Step 1: FIND (run first, review rows)
-- Step 2: FIX  (uncomment UPDATE for the id you want, or use the bulk rule)

-- ── 1) Naps longer than 4 hours (240 min), closest to 605 highlighted ────────
select
  id,
  baby_id,
  type,
  start_time,
  end_time,
  round(
    extract(
      epoch from (end_time::timestamptz - start_time::timestamptz)
    ) / 60.0
  )::int as duration_min
from public.sleep_events
where deleted_at is null
  and type = 'nap'
  and end_time is not null
  and end_time::timestamptz > start_time::timestamptz
  and extract(epoch from (end_time::timestamptz - start_time::timestamptz)) / 60.0 >= 240
order by
  abs(
    extract(epoch from (end_time::timestamptz - start_time::timestamptz)) / 60.0
    - 605
  ),
  start_time desc;

-- ── 2a) Fix ONE row by id (paste id from step 1) ────────────────────────────
-- update public.sleep_events
-- set type = 'night',
--     updated_at = now()
-- where id = 'PASTE_ID_HERE'
--   and deleted_at is null;

-- ── 2b) OR fix all naps ~605 min (580–630) in one go ────────────────────────
-- update public.sleep_events
-- set type = 'night',
--     updated_at = now()
-- where deleted_at is null
--   and type = 'nap'
--   and end_time is not null
--   and extract(epoch from (end_time::timestamptz - start_time::timestamptz)) / 60.0
--       between 580 and 630;

-- After UPDATE: both phones → Settings → Sync now
-- (or reinstall the phone that still shows the old type)
