-- Harden Row Level Security for dashboard_snapshot (run in Supabase → SQL Editor).
-- After this migration, ONLY signed-in users (Supabase Auth) can read or write the snapshot.
-- The anon key alone will NO longer access this table — set VITE_SUPABASE_REQUIRE_AUTH=true in .env
-- and sign in from the dashboard, or use the Supabase Dashboard → Authentication to create users.

-- Remove permissive policies (name may vary if you edited them — drop all on table)
drop policy if exists "dashboard_snapshot_select" on public.dashboard_snapshot;
drop policy if exists "dashboard_snapshot_insert" on public.dashboard_snapshot;
drop policy if exists "dashboard_snapshot_update" on public.dashboard_snapshot;
drop policy if exists "dashboard_snapshot_select_auth" on public.dashboard_snapshot;
drop policy if exists "dashboard_snapshot_insert_auth" on public.dashboard_snapshot;
drop policy if exists "dashboard_snapshot_update_auth" on public.dashboard_snapshot;

-- Authenticated (logged-in) users only; single-row table id must stay 1
create policy "dashboard_snapshot_select_authenticated"
  on public.dashboard_snapshot
  for select
  to authenticated
  using (id = 1);

create policy "dashboard_snapshot_insert_authenticated"
  on public.dashboard_snapshot
  for insert
  to authenticated
  with check (id = 1);

create policy "dashboard_snapshot_update_authenticated"
  on public.dashboard_snapshot
  for update
  to authenticated
  using (id = 1)
  with check (id = 1);

-- No delete policy → DELETE denied by default (safe).
