-- Verify customer order list (orders.html) can read own rows via RLS + SELECT grant.
-- Run in Supabase SQL Editor if orders.html stays empty after app.js fix.

-- 1) Grants: re-run sql/restaurant_ordering_security_grants.sql if SELECT was revoked

-- 2) Sanity: policies must use user_id (not customer_id)
-- select polname, polcmd, pg_get_expr(polqual, polrelid) as using_expr
-- from pg_policy where polrelid = 'public.orders'::regclass;

-- 3) As authenticated user in SQL editor (set role) or test in app:
-- select id, user_id, venue_id, status, created_at
-- from public.orders
-- where user_id = auth.uid()
-- order by created_at desc;
