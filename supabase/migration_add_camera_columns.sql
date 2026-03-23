-- Run once in Supabase → SQL Editor if your table was created before camera columns existed.

alter table public.dashboard_snapshot
  add column if not exists camera_csv_text text not null default '';

alter table public.dashboard_snapshot
  add column if not exists camera_file_name text not null default '';

alter table public.dashboard_snapshot
  add column if not exists camera_updated_at timestamptz;
