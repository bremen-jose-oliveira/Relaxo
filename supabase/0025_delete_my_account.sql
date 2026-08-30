-- Account self-deletion for App Store compliance.
-- Run in Supabase SQL Editor (or via migrate scripts).
--
-- Allows deleting auth.users even when this user still owns a shared household:
-- transfer created_by to another member, then ON DELETE SET NULL as safety net.

alter table public.households
  alter column created_by drop not null;

alter table public.households
  drop constraint if exists households_created_by_fkey;

alter table public.households
  add constraint households_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Hand shared households to another member before we leave.
  update public.households h
  set created_by = m.user_id
  from (
    select distinct on (hm.household_id)
      hm.household_id,
      hm.user_id
    from public.household_members hm
    where hm.user_id <> uid
      and exists (
        select 1
        from public.households hh
        where hh.id = hm.household_id
          and hh.created_by = uid
      )
    order by hm.household_id, hm.joined_at asc, hm.user_id asc
  ) m
  where h.id = m.household_id
    and h.created_by = uid;

  delete from public.household_members where user_id = uid;

  -- Solo households (now empty) that this user created.
  delete from public.households h
  where h.created_by = uid
    and not exists (
      select 1 from public.household_members m where m.household_id = h.id
    );

  -- Any leftover ownership (edge cases) — FK also SETs NULL on auth delete.
  update public.households
  set created_by = null
  where created_by = uid;

  delete from public.profiles where id = uid;

  -- Requires function owner privileges on auth schema (default on Supabase).
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

notify pgrst, 'reload schema';
