-- Courier pool hotfix: pending deliveries visible + RLS recursion fix (rerunnable)
-- Run in Supabase SQL Editor when courier panel shows empty pool.

-- ---------------------------------------------------------------------------
-- 1) Normalize stuck delivery rows into pool status
-- ---------------------------------------------------------------------------
update public.deliveries
set status = 'available',
    updated_at = now()
where courier_id is null
  and status in ('pending', 'open');

-- Backfill: delivery orders accepted+ without delivery row
do $$
declare
  r record;
begin
  for r in
    select o.id
    from public.orders o
    where o.order_type = 'delivery'
      and o.status in ('accepted', 'preparing', 'ready_for_pickup', 'courier_assigned')
      and not exists (select 1 from public.deliveries d where d.order_id = o.id)
  loop
    perform public.ensure_courier_delivery_for_order(r.id);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Pool RPC: include pending + only delivery orders
-- ---------------------------------------------------------------------------
create or replace function public.get_courier_delivery_pool()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_courier_id uuid := public.get_my_courier_id();
  v_available jsonb := '[]'::jsonb;
  v_assigned jsonb := '[]'::jsonb;
begin
  if v_courier_id is null then
    raise exception 'Active courier account required';
  end if;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  into v_available
  from (
    select
      d.*,
      jsonb_build_object(
        'id', o.id,
        'user_id', o.user_id,
        'status', o.status,
        'total_amount', o.total_amount,
        'delivery_address', o.delivery_address,
        'customer_note', o.customer_note,
        'created_at', o.created_at,
        'venue_id', o.venue_id,
        'order_type', o.order_type,
        'venues', jsonb_build_object(
          'name', v.name,
          'city', v.city,
          'address', v.address,
          'latitude', v.latitude,
          'longitude', v.longitude
        ),
        'order_items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'item_name', oi.item_name,
            'quantity', oi.quantity,
            'total_price', oi.total_price
          ) order by oi.item_name)
          from public.order_items oi
          where oi.order_id = o.id
        ), '[]'::jsonb)
      ) as orders
    from public.deliveries d
    join public.orders o on o.id = d.order_id
    left join public.venues v on v.id = o.venue_id
    where o.order_type = 'delivery'
      and d.courier_id is null
      and d.status in ('available', 'open', 'pending')
    order by d.created_at asc
  ) t;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  into v_assigned
  from (
    select
      d.*,
      jsonb_build_object(
        'id', o.id,
        'user_id', o.user_id,
        'status', o.status,
        'total_amount', o.total_amount,
        'delivery_address', o.delivery_address,
        'customer_note', o.customer_note,
        'created_at', o.created_at,
        'venue_id', o.venue_id,
        'order_type', o.order_type,
        'venues', jsonb_build_object(
          'name', v.name,
          'city', v.city,
          'address', v.address,
          'latitude', v.latitude,
          'longitude', v.longitude
        ),
        'order_items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'item_name', oi.item_name,
            'quantity', oi.quantity,
            'total_price', oi.total_price
          ) order by oi.item_name)
          from public.order_items oi
          where oi.order_id = o.id
        ), '[]'::jsonb)
      ) as orders
    from public.deliveries d
    join public.orders o on o.id = d.order_id
    left join public.venues v on v.id = o.venue_id
    where o.order_type = 'delivery'
      and d.courier_id = v_courier_id
      and d.status in ('assigned', 'courier_assigned', 'picked_up', 'on_the_way')
    order by d.created_at desc
  ) t;

  return jsonb_build_object(
    'available', v_available,
    'assigned', v_assigned
  );
end;
$$;

grant execute on function public.get_courier_delivery_pool() to authenticated;

-- ---------------------------------------------------------------------------
-- 3) RLS: break deliveries <-> orders recursion (inline courier check)
-- ---------------------------------------------------------------------------
drop policy if exists "Couriers read open or assigned deliveries" on public.deliveries;

create policy "Couriers read open or assigned deliveries"
on public.deliveries for select
using (
  exists (
    select 1
    from public.couriers c
    where c.status = 'active'
      and (
        c.user_id = auth.uid()
        or (
          c.email is not null
          and lower(trim(c.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
        )
      )
  )
  and (
    (
      status in ('available', 'open', 'pending')
      and courier_id is null
    )
    or courier_id in (
      select c.id
      from public.couriers c
      where c.status = 'active'
        and c.user_id = auth.uid()
    )
  )
);

drop policy if exists "Couriers read related orders" on public.orders;

create policy "Couriers read related orders"
on public.orders for select
using (
  order_type = 'delivery'
  and exists (
    select 1
    from public.couriers c
    where c.status = 'active'
      and c.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.deliveries d
    where d.order_id = orders.id
      and (
        (d.status in ('available', 'open', 'pending') and d.courier_id is null)
        or d.courier_id in (
          select c2.id
          from public.couriers c2
          where c2.status = 'active'
            and c2.user_id = auth.uid()
        )
      )
  )
);
