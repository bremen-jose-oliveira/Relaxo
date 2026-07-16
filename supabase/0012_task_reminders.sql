-- Task reminder time (minutes from local midnight). Null = no reminder.
alter table public.daily_chores
  add column if not exists reminder_minutes integer;

update public.daily_chores
set reminder_minutes = 1080
where recurrence = 'daily'
  and reminder_minutes is null
  and deleted_at is null;
