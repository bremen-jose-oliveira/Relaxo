-- Additive migration for existing Supabase projects that already ran schema.sql
-- Run in Supabase SQL editor if sleep_events.extension / day_context_tags are missing.

alter table public.sleep_events
  add column if not exists extension text
  check (
    extension is null
    or extension in ('independent', 'feeding', 'rocking', 'contact', 'not_extended')
  );

create table if not exists public.day_context_tags (
  id text primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  baby_id text not null,
  date_key text not null,
  tag text not null check (
    tag in (
      'outing', 'visitors', 'cafe', 'transit', 'car', 'vaccination', 'sick',
      'teething', 'baby_class', 'shopping', 'park', 'quiet_home', 'travel'
    )
  ),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (household_id, baby_id, date_key, tag)
);

create index if not exists idx_day_context_tags_household on public.day_context_tags (household_id);
create index if not exists idx_day_context_tags_baby_date on public.day_context_tags (baby_id, date_key);

alter table public.day_context_tags enable row level security;

drop policy if exists "day_context_tags_all" on public.day_context_tags;
create policy "day_context_tags_all" on public.day_context_tags
  for all using (household_id in (select public.user_household_ids()))
  with check (household_id in (select public.user_household_ids()));
