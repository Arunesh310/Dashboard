-- Emergency rollback: restore anon + authenticated read/write (WEAK — only for local testing).
-- Run in SQL Editor only if you need the old behavior after migration_harden_rls.sql.

drop policy if exists "dashboard_snapshot_select_authenticated" on public.dashboard_snapshot;
drop policy if exists "dashboard_snapshot_insert_authenticated" on public.dashboard_snapshot;
drop policy if exists "dashboard_snapshot_update_authenticated" on public.dashboard_snapshot;

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
