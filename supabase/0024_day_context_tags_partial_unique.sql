-- Fix day_context_tags unique constraint so soft-deleted rows don't block re-toggles.
-- Error seen in app:
--   duplicate key value violates unique constraint
--   "day_context_tags_household_id_baby_id_date_key_tag_key"
--
-- Run in Supabase SQL Editor.

-- Soft-delete live duplicates (keep smallest id).
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

alter table public.day_context_tags
  drop constraint if exists day_context_tags_household_id_baby_id_date_key_tag_key;

-- Only one live row per household/baby/date/tag.
create unique index if not exists day_context_tags_live_uniq
  on public.day_context_tags (household_id, baby_id, date_key, tag)
  where deleted_at is null;
