-- Diagnostics + cleanup for duplicate sync rows.
-- Run in Supabase SQL Editor. Review SELECT results before running DELETEs.

-- ── How many babies per household? ──────────────────────────────────────────
select household_id, id, name, birth_date, deleted_at
from public.babies
where deleted_at is null
order by household_id, name, id;

-- ── Duplicate day tags (same baby/date/tag, different ids) ──────────────────
select household_id, baby_id, date_key, tag, count(*) as n, array_agg(id) as ids
from public.day_context_tags
where deleted_at is null
group by household_id, baby_id, date_key, tag
having count(*) > 1;

-- Soft-delete extras, keep the lexicographically smallest id
with dups as (
  select id,
    row_number() over (
      partition by household_id, baby_id, date_key, tag
      order by id
    ) as rn
  from public.day_context_tags
  where deleted_at is null
)
update public.day_context_tags t
set deleted_at = now(), updated_at = now()
from dups
where t.id = dups.id and dups.rn > 1;

-- ── Likely duplicate sleeps (same baby, type, start_time) ───────────────────
select household_id, baby_id, type, start_time, count(*) as n, array_agg(id) as ids
from public.sleep_events
where deleted_at is null
group by household_id, baby_id, type, start_time
having count(*) > 1;

-- Soft-delete extras (keep one). Review the SELECT above first!
-- with dups as (
--   select id,
--     row_number() over (
--       partition by household_id, baby_id, type, start_time
--       order by updated_at desc nulls last, id
--     ) as rn
--   from public.sleep_events
--   where deleted_at is null
-- )
-- update public.sleep_events t
-- set deleted_at = now(), updated_at = now()
-- from dups
-- where t.id = dups.id and dups.rn > 1;

-- After cleanup: both phones → Settings → Sync now
-- (or delete+reinstall one phone and join with invite code to pull clean cloud)
