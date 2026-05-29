-- Customer order list for orders.html (bypasses broken/missing RLS SELECT on public.orders)
-- Run in Supabase SQL Editor after restaurant_ordering_courier_mvp.sql

-- ---------------------------------------------------------------------------
-- Policies + grants (idempotent)
-- ---------------------------------------------------------------------------
drop policy if exists "Customers read own orders" on public.orders;

create policy "Customers read own orders"
on public.orders
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Customers read own order items" on public.order_items;

create policy "Customers read own order items"
on public.order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and o.user_id = auth.uid()
  )
);

revoke insert, update, delete on public.orders from anon, authenticated;
revoke insert, update, delete on public.order_items from anon, authenticated;
revoke all on public.orders from anon, authenticated;
revoke all on public.order_items from anon, authenticated;
grant select on public.orders to authenticated;
grant select on public.order_items to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: list own orders (all statuses including pending)
-- ---------------------------------------------------------------------------
drop function if exists public.get_my_restaurant_orders();

create or replace function public.get_my_restaurant_orders()
returns setof public.orders
language sql
security definer
stable
set search_path = public
as $$
  select o.*
  from public.orders o
  where o.user_id = auth.uid()
  order by o.created_at desc;
$$;

revoke all on function public.get_my_restaurant_orders() from public;
grant execute on function public.get_my_restaurant_orders() to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: single own order (orders.html?id= highlight / order-detail)
-- ---------------------------------------------------------------------------
drop function if exists public.get_my_restaurant_order(uuid);

create or replace function public.get_my_restaurant_order(p_order_id uuid)
returns public.orders
language sql
security definer
stable
set search_path = public
as $$
  select o.*
  from public.orders o
  where o.id = p_order_id
    and o.user_id = auth.uid()
  limit 1;
$$;

revoke all on function public.get_my_restaurant_order(uuid) from public;
grant execute on function public.get_my_restaurant_order(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: business owner order list (restaurant-orders.html)
-- Matches by business_owner_id OR venue ownership (any business status)
-- ---------------------------------------------------------------------------
drop function if exists public.get_business_restaurant_orders(bigint[]);

create or replace function public.get_business_restaurant_orders(
  p_venue_ids bigint[] default '{}'
)
returns setof public.orders
language sql
security definer
stable
set search_path = public
as $$
  select o.*
  from public.orders o
  where (
    o.business_owner_id = auth.uid()
    or exists (
      select 1
      from public.venues v
      join public.businesses b on b.id = v.business_id
      where v.id = o.venue_id
        and b.owner_id = auth.uid()
    )
  )
  and (
    cardinality(p_venue_ids) = 0
    or o.venue_id = any (p_venue_ids)
  )
  order by o.created_at desc;
$$;

revoke all on function public.get_business_restaurant_orders(bigint[]) from public;
grant execute on function public.get_business_restaurant_orders(bigint[]) to authenticated;
