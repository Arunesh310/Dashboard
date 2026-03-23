-- Run this in Supabase → SQL Editor after creating a project.
-- Stores one shared CSV for the dashboard (id = 1 always).

create table if not exists public.dashboard_snapshot (
  id smallint primary key default 1 check (id = 1),
  csv_text text not null default '',
  file_name text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.dashboard_snapshot enable row level security;

-- Anonymous access with the anon key (suitable for internal tools; tighten for production)
create policy "dashboard_snapshot_select"
  on public.dashboard_snapshot for select
  to anon, authenticated
  using (true);

create policy "dashboard_snapshot_insert"
  on public.dashboard_snapshot for insert
  to anon, authenticated
  with check (true);

create policy "dashboard_snapshot_update"
  on public.dashboard_snapshot for update
  to anon, authenticated
  using (true);

insert into public.dashboard_snapshot (id, csv_text, file_name)
values (1, '', '')
on conflict (id) do nothing;
