-- Realtime for the signed-in user's bag (Task 3). Paste into the Supabase SQL Editor.
-- Safe to run twice. RLS stays on; the backend keeps doing all writes.

-- 1. Let Realtime publish changes to bag_items.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bag_items'
  ) then
    alter publication supabase_realtime add table public.bag_items;
  end if;
end $$;

-- 2. Tables are not auto-exposed in this project; Realtime reads as the signed-in role.
grant select on public.bag_items to authenticated;

-- 3. A signed-in user can select only their own rows (user_id is varchar, so cast the uid).
drop policy if exists "bag_items_select_own" on public.bag_items;
create policy "bag_items_select_own" on public.bag_items
  for select to authenticated
  using (auth.uid()::text = user_id);

-- Check afterwards: expect rls = true, one policy, bag_items in realtime, authenticated = true, anon = false.
-- select
--   (select relrowsecurity from pg_class where oid = 'public.bag_items'::regclass) as rls,
--   (select count(*) from pg_policies where tablename = 'bag_items' and policyname = 'bag_items_select_own') as policies,
--   exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'bag_items') as in_realtime,
--   has_table_privilege('authenticated', 'public.bag_items', 'select') as authenticated_select,
--   has_table_privilege('anon', 'public.bag_items', 'select') as anon_select;
