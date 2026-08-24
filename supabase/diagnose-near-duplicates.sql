-- Near-duplicate check (times truncated to the minute).
-- Exact-dup queries can miss rows that LOOK the same in the app
-- but differ by seconds/ms, or left vs right at the same minute.
--
-- Run each SELECT separately in Supabase SQL Editor.

-- Breastfeeds that share the same minute (any side)
select
  baby_id,
  left(start_time, 16) as start_minute,
  count(*) as n,
  array_agg(side order by side) as sides,
  array_agg(id order by id) as ids,
  array_agg(start_time order by start_time) as raw_starts
from public.feeding_events
where deleted_at is null
  and feed_type = 'breast'
group by baby_id, left(start_time, 16)
having count(*) > 1
order by start_minute desc
limit 50;

-- Sleeps/naps that share the same minute
select
  baby_id,
  type,
  left(start_time, 16) as start_minute,
  count(*) as n,
  array_agg(id order by id) as ids,
  array_agg(start_time order by start_time) as raw_starts
from public.sleep_events
where deleted_at is null
group by baby_id, type, left(start_time, 16)
having count(*) > 1
order by start_minute desc
limit 50;

-- Totals still live on cloud
select 'babies' as t, count(*) from public.babies where deleted_at is null
union all select 'sleeps', count(*) from public.sleep_events where deleted_at is null
union all select 'feedings', count(*) from public.feeding_events where deleted_at is null
union all select 'diapers', count(*) from public.diaper_events where deleted_at is null;
