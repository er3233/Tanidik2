"-- Apply after restaurant_ordering_courier_mvp.sql (or re-run to fix stale grants).
-- Reservation-style: authenticated clients can only SELECT these tables.

revoke insert, update, delete on public.orders from anon, authenticated;
revoke insert, update, delete on public.order_items from anon, authenticated;
revoke insert, update, delete on public.deliveries from anon, authenticated;
revoke insert, update, delete on public.order_status_history from anon, authenticated;

revoke all on public.orders from anon, authenticated;
revoke all on public.order_items from anon, authenticated;
revoke all on public.deliveries from anon, authenticated;
revoke all on public.order_status_history from anon, authenticated;

grant select on public.orders to authenticated;
grant select on public.order_items to authenticated;
grant select on public.deliveries to authenticated;
grant select on public.order_status_history to authenticated;

-- Drop legacy permissive policies if an older migration was applied.
drop policy if exists "Customers create own orders" on public.orders;
drop policy if exists "Business owners update venue orders" on public.orders;
drop policy if exists "Admins manage all orders" on public.orders;
drop policy if exists "Customers create own order items" on public.order_items;
drop policy if exists "Couriers update assigned deliveries" on public.deliveries;
drop policy if exists "Admins manage all deliveries" on public.deliveries;
