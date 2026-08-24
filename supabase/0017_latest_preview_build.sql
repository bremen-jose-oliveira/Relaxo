-- Public pointer to the latest EAS preview build (install button).
-- Safe to re-run. Readable by anyone with the anon/publishable key.

create table if not exists public.latest_preview_build (
  id text primary key default 'preview',
  ios_build_id text,
  ios_artifact_url text,
  android_build_id text,
  android_artifact_url text,
  synced_at timestamptz not null default now()
);

alter table public.latest_preview_build enable row level security;

drop policy if exists "latest_preview_build_select" on public.latest_preview_build;
create policy "latest_preview_build_select" on public.latest_preview_build
  for select using (true);

-- Writes go through the sync script with DB URL / service role, not from the app.
drop policy if exists "latest_preview_build_no_client_write" on public.latest_preview_build;

insert into public.latest_preview_build (id)
values ('preview')
on conflict (id) do nothing;

notify pgrst, 'reload schema';
