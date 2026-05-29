-- Courier system audit fix (rerunnable)
-- Run after: restaurant_ordering_courier_mvp.sql, restaurant_courier_dispatch_mvp.sql,
--            courier_deliveries_mvp.sql, courier_email_link_mvp.sql

-- ---------------------------------------------------------------------------
-- Align session courier id with email invite flow (RPCs + RLS)
-- ---------------------------------------------------------------------------
create or replace function public.get_my_courier_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.resolve_my_active_courier() c;
$$;

create or replace function public.is_active_courier()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.get_my_courier_id() is not null;
$$;

grant execute on function public.get_my_courier_id() to authenticated;
grant execute on function public.is_active_courier() to authenticated;

-- Couriers: read own row by user_id OR email (for pre-link invite rows)
drop policy if exists "Couriers read own profile" on public.couriers;

create policy "Couriers read own profile"
on public.couriers for select
using (
  user_id = auth.uid()
  or (
    email is not null
    and exists (
      select 1
      from auth.users u
      where u.id = auth.uid()
        and lower(trim(couriers.email)) = lower(trim(u.email))
    )
  )
  or public.is_admin_user()
);

-- Courier order_items RLS: match delivery pool statuses
drop policy if exists "Couriers read related order items" on public.order_items;

create policy "Couriers read related order items"
on public.order_items for select
using (
  public.is_active_courier()
  and exists (
    select 1
    from public.deliveries d
    join public.orders o on o.id = d.order_id
    where o.id = order_items.order_id
      and (
        (d.status in ('available', 'open') and d.courier_id is null)
        or d.courier_id = public.get_my_courier_id()
      )
  )
);

-- ---------------------------------------------------------------------------
-- Courier delivery history (delivered / cancelled)
-- ---------------------------------------------------------------------------
drop function if exists public.get_courier_delivery_history(integer);

create or replace function public.get_courier_delivery_history(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_courier_id uuid := public.get_my_courier_id();
  v_history jsonb := '[]'::jsonb;
begin
  if v_courier_id is null then
    raise exception 'Active courier account required';
  end if;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  into v_history
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
          'address', v.address
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
    where d.courier_id = v_courier_id
      and d.status in ('delivered', 'cancelled')
    order by coalesce(d.delivered_at, d.updated_at) desc
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  ) t;

  return v_history;
end;
$$;

grant execute on function public.get_courier_delivery_history(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: assign courier to open delivery
-- ---------------------------------------------------------------------------
drop function if exists public.admin_assign_courier_delivery(uuid, uuid, text);

create or replace function public.admin_assign_courier_delivery(
  p_delivery_id uuid,
  p_courier_id uuid,
  p_note text default null
)
returns public.deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery public.deliveries%rowtype;
  v_order public.orders%rowtype;
  v_courier public.couriers%rowtype;
begin
  if not public.is_admin_user() then
    raise exception 'Admin access required';
  end if;

  select * into v_courier
  from public.couriers
  where id = p_courier_id and status = 'active';

  if v_courier.id is null then
    raise exception 'Active courier not found';
  end if;

  select * into v_delivery
  from public.deliveries
  where id = p_delivery_id
  for update;

  if v_delivery.id is null then
    raise exception 'Delivery not found';
  end if;

  if v_delivery.status not in ('available', 'open', 'pending')
     or v_delivery.courier_id is not null then
    raise exception 'Delivery is not available for assignment';
  end if;

  update public.deliveries
  set courier_id = p_courier_id,
      status = 'assigned',
      assigned_at = now(),
      notes = coalesce(p_note, notes),
      updated_at = now()
  where id = p_delivery_id
  returning * into v_delivery;

  select * into v_order from public.orders where id = v_delivery.order_id for update;

  update public.orders
  set status = case
      when status in ('pending', 'accepted', 'preparing', 'ready_for_pickup') then 'courier_assigned'
      else status
    end,
    updated_at = now()
  where id = v_order.id;

  perform public.append_order_status_history(
    v_order.id,
    'courier_assigned',
    coalesce(p_note, 'Admin assigned courier')
  );

  return v_delivery;
end;
$$;

grant execute on function public.admin_assign_courier_delivery(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: delivery dispatch board
-- ---------------------------------------------------------------------------
drop function if exists public.get_admin_delivery_dispatch_board();

create or replace function public.get_admin_delivery_dispatch_board()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_pool jsonb := '[]'::jsonb;
  v_active jsonb := '[]'::jsonb;
  v_completed jsonb := '[]'::jsonb;
begin
  if not public.is_admin_user() then
    raise exception 'Admin access required';
  end if;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  into v_pool
  from (
    select
      d.*,
      jsonb_build_object(
        'id', o.id,
        'status', o.status,
        'total_amount', o.total_amount,
        'delivery_address', o.delivery_address,
        'created_at', o.created_at,
        'venue_id', o.venue_id,
        'venues', jsonb_build_object('name', v.name, 'city', v.city)
      ) as orders,
      null::jsonb as couriers
    from public.deliveries d
    join public.orders o on o.id = d.order_id
    left join public.venues v on v.id = o.venue_id
    where o.order_type = 'delivery'
      and d.courier_id is null
      and d.status in ('available', 'open', 'pending')
    order by d.created_at asc
  ) t;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  into v_active
  from (
    select
      d.*,
      jsonb_build_object(
        'id', o.id,
        'status', o.status,
        'total_amount', o.total_amount,
        'delivery_address', o.delivery_address,
        'created_at', o.created_at,
        'venue_id', o.venue_id,
        'venues', jsonb_build_object('name', v.name, 'city', v.city)
      ) as orders,
      jsonb_build_object(
        'id', c.id,
        'full_name', c.full_name,
        'email', c.email,
        'status', c.status
      ) as couriers
    from public.deliveries d
    join public.orders o on o.id = d.order_id
    left join public.venues v on v.id = o.venue_id
    left join public.couriers c on c.id = d.courier_id
    where o.order_type = 'delivery'
      and d.courier_id is not null
      and d.status in ('assigned', 'courier_assigned', 'picked_up', 'on_the_way')
    order by d.updated_at desc
  ) t;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  into v_completed
  from (
    select
      d.*,
      jsonb_build_object(
        'id', o.id,
        'status', o.status,
        'total_amount', o.total_amount,
        'delivery_address', o.delivery_address,
        'created_at', o.created_at,
        'venue_id', o.venue_id,
        'venues', jsonb_build_object('name', v.name, 'city', v.city)
      ) as orders,
      jsonb_build_object(
        'id', c.id,
        'full_name', c.full_name,
        'email', c.email
      ) as couriers
    from public.deliveries d
    join public.orders o on o.id = d.order_id
    left join public.venues v on v.id = o.venue_id
    left join public.couriers c on c.id = d.courier_id
    where o.order_type = 'delivery'
      and d.status in ('delivered', 'cancelled')
    order by coalesce(d.delivered_at, d.updated_at) desc
    limit 100
  ) t;

  return jsonb_build_object(
    'pool', v_pool,
    'active', v_active,
    'completed', v_completed
  );
end;
$$;

grant execute on function public.get_admin_delivery_dispatch_board() to authenticated;
