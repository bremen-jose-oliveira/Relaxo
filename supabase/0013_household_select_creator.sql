-- Allow household creators to read their row (needed for create / invite code flows).
drop policy if exists "households_select_member" on public.households;
create policy "households_select_member" on public.households
  for select using (
    created_by = auth.uid()
    or id in (select public.user_household_ids())
  );
