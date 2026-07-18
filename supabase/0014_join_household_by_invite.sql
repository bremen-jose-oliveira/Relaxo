-- Partner join by invite code + ensure core event tables exist.
-- Run in Supabase SQL Editor on existing projects (after schema.sql).
--
-- Why: RLS only lets members/creators SELECT households, so
--   .from('households').eq('invite_code', …) always looks empty to a new partner.
-- Fix: SECURITY DEFINER RPC that resolves the code and inserts membership.

create or replace function public.join_household_by_invite(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  hh public.households%rowtype;
  normalized text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  normalized := upper(trim(both from p_code));
  if length(normalized) < 6 then
    raise exception 'Invalid invite code';
  end if;

  select * into hh
  from public.households
  where upper(invite_code) = normalized
  limit 1;

  if not found then
    return null;
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (hh.id, auth.uid(), 'member')
  on conflict (household_id, user_id) do nothing;

  return json_build_object(
    'id', hh.id,
    'invite_code', hh.invite_code,
    'name', hh.name
  );
end;
$$;

revoke all on function public.join_household_by_invite(text) from public;
grant execute on function public.join_household_by_invite(text) to authenticated;

-- Ensure sleep_events (and related) exist if an older/partial schema was applied.
create table if not exists public.sleep_events (
  id text primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  baby_id text not null,
  type text not null check (type in ('nap', 'night')),
  start_time text not null,
  end_time text,
  extension text check (
    extension is null
    or extension in ('independent', 'feeding', 'rocking', 'contact', 'not_extended')
  ),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_sleep_events_household on public.sleep_events (household_id);
create index if not exists idx_sleep_events_baby on public.sleep_events (baby_id);

alter table public.sleep_events enable row level security;

drop policy if exists "sleep_events_all" on public.sleep_events;
create policy "sleep_events_all" on public.sleep_events
  for all using (household_id in (select public.user_household_ids()))
  with check (household_id in (select public.user_household_ids()));

-- Notify PostgREST to reload the schema cache (table / RPC visibility).
notify pgrst, 'reload schema';
