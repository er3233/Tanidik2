-- Courier delivery task architecture (additive, rerunnable)
-- Uses existing public.deliveries + public.orders (restaurant_orders)
-- Run after restaurant_ordering_courier_mvp.sql and restaurant_courier_dispatch_mvp.sql

-- ---------------------------------------------------------------------------
-- Denormalized columns on deliveries (courier task source)
-- ---------------------------------------------------------------------------
alter table public.deliveries
  add column if not exists venue_id bigint references public.venues(id) on delete set null;

alter table public.deliveries
  add column if not exists business_owner_id uuid references auth.users(id) on delete set null;

create unique index if not exists deliveries_order_id_uidx
  on public.deliveries (order_id);

-- Status vocabulary: available -> assigned -> picked_up -> on_the_way -> delivered
alter table public.deliveries drop constraint if exists deliveries_status_check;

update public.deliveries set status = 'available' where status in ('open', 'pending');
update public.deliveries set status = 'assigned' where status in ('courier_assigned', 'assigned');
update public.deliveries set status = 'on_the_way' where status = 'in_transit';

alter table public.deliveries
add constraint deliveries_status_check check (
  status in (
    'available',
    'assigned',
    'picked_up',
    'on_the_way',
    'delivered',
    'cancelled',
    'open',
    'courier_assigned'
  )
);

-- ---------------------------------------------------------------------------
-- Idempotent delivery task from restaurant order
-- ---------------------------------------------------------------------------
drop function if exists public.ensure_courier_delivery_for_order(uuid);

create or replace function public.ensure_courier_delivery_for_order(p_order_id uuid)
returns public.deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_delivery public.deliveries%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Order not found';
  end if;

  if v_order.order_type <> 'delivery' then
    return null;
  end if;

  select * into v_delivery from public.deliveries where order_id = p_order_id limit 1;

  if v_delivery.id is not null then
    update public.deliveries
    set
      venue_id = coalesce(venue_id, v_order.venue_id),
      business_owner_id = coalesce(business_owner_id, v_order.business_owner_id),
      status = case
        when status in ('open', 'pending') then 'available'
        else status
      end,
      updated_at = now()
    where id = v_delivery.id
    returning * into v_delivery;

    return v_delivery;
  end if;

  insert into public.deliveries (
    order_id,
    venue_id,
    business_owner_id,
    status,
    courier_id
  )
  values (
    p_order_id,
    v_order.venue_id,
    v_order.business_owner_id,
    'available',
    null
  )
  returning * into v_delivery;

  return v_delivery;
end;
$$;

revoke all on function public.ensure_courier_delivery_for_order(uuid) from public;
grant execute on function public.ensure_courier_delivery_for_order(uuid) to authenticated;

-- Backward-compatible alias
create or replace function public.ensure_open_delivery_for_order(p_order_id uuid)
returns public.deliveries
language sql
security definer
set search_path = public
as $$
  select public.ensure_courier_delivery_for_order(p_order_id);
$$;

-- ---------------------------------------------------------------------------
-- Business approve: create delivery task on accept / preparing
-- ---------------------------------------------------------------------------
drop function if exists public.update_restaurant_order_status(uuid, text, text);

create or replace function public.update_restaurant_order_status(
  p_order_id uuid,
  p_new_status text,
  p_note text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_allowed text[] := array[
    'accepted', 'rejected', 'preparing', 'ready_for_pickup', 'cancelled'
  ];
  v_delivery public.deliveries%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Login required' using errcode = '28000';
  end if;

  if not (p_new_status = any(v_allowed)) then
    raise exception 'Invalid status transition';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Order not found';
  end if;

  if not (
    public.is_admin_user()
    or v_order.business_owner_id = auth.uid()
    or public.is_business_owner_for_venue(v_order.venue_id)
  ) then
    raise exception 'Not authorized';
  end if;

  if p_new_status = 'accepted' and v_order.status <> 'pending' then
    raise exception 'Only pending orders can be accepted';
  end if;

  if p_new_status = 'rejected' and v_order.status <> 'pending' then
    raise exception 'Only pending orders can be rejected';
  end if;

  if p_new_status = 'preparing' and v_order.status not in ('pending', 'accepted') then
    raise exception 'Only pending or accepted orders can move to preparing';
  end if;

  if p_new_status = 'ready_for_pickup' and v_order.status <> 'preparing' then
    raise exception 'Only preparing orders can be marked ready';
  end if;

  update public.orders
  set status = p_new_status, updated_at = now()
  where id = p_order_id
  returning * into v_order;

  perform public.append_order_status_history(p_order_id, p_new_status, p_note);

  if p_new_status in ('accepted', 'preparing', 'ready_for_pickup')
     and v_order.order_type = 'delivery' then
    v_delivery := public.ensure_courier_delivery_for_order(p_order_id);
  end if;

  return v_order;
end;
$$;

grant execute on function public.update_restaurant_order_status(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Courier pool loader (bypasses RLS + embeds order payload)
-- ---------------------------------------------------------------------------
drop function if exists public.get_courier_delivery_pool();

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

revoke all on function public.get_courier_delivery_pool() from public;
grant execute on function public.get_courier_delivery_pool() to authenticated;

drop function if exists public.get_available_courier_deliveries();

create or replace function public.get_available_courier_deliveries()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(public.get_courier_delivery_pool()->'available', '[]'::jsonb);
$$;

grant execute on function public.get_available_courier_deliveries() to authenticated;

-- ---------------------------------------------------------------------------
-- Courier accept + status updates (available/assigned vocabulary)
-- ---------------------------------------------------------------------------
drop function if exists public.accept_courier_delivery(uuid);
drop function if exists public.accept_delivery(uuid);

create or replace function public.accept_courier_delivery(p_delivery_id uuid)
returns public.deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_courier_id uuid := public.get_my_courier_id();
  v_delivery public.deliveries%rowtype;
  v_order public.orders%rowtype;
begin
  if v_courier_id is null then
    raise exception 'Active courier account required';
  end if;

  select * into v_delivery
  from public.deliveries
  where id = p_delivery_id
  for update;

  if v_delivery.id is null then
    raise exception 'Delivery not found';
  end if;

  update public.deliveries
  set courier_id = v_courier_id,
      status = 'assigned',
      assigned_at = now(),
      updated_at = now()
  where id = p_delivery_id
    and status in ('available', 'open')
    and courier_id is null
  returning * into v_delivery;

  if v_delivery.id is null then
    raise exception 'Delivery already claimed or unavailable' using errcode = '40001';
  end if;

  select * into v_order from public.orders where id = v_delivery.order_id for update;

  update public.orders
  set status = case
      when status in ('pending', 'accepted', 'preparing', 'ready_for_pickup') then 'courier_assigned'
      else status
    end,
    updated_at = now()
  where id = v_order.id;

  perform public.append_order_status_history(
    v_order.id, 'courier_assigned', 'Courier accepted delivery'
  );

  return v_delivery;
end;
$$;

create or replace function public.accept_delivery(p_delivery_id uuid)
returns public.deliveries
language sql
security definer
set search_path = public
as $$
  select public.accept_courier_delivery(p_delivery_id);
$$;

grant execute on function public.accept_courier_delivery(uuid) to authenticated;
grant execute on function public.accept_delivery(uuid) to authenticated;

drop function if exists public.update_courier_delivery_status(uuid, text, text);
drop function if exists public.update_delivery_status(uuid, text, text);

create or replace function public.update_courier_delivery_status(
  p_delivery_id uuid,
  p_new_status text,
  p_note text default null
)
returns public.deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_courier_id uuid := public.get_my_courier_id();
  v_delivery public.deliveries%rowtype;
  v_order public.orders%rowtype;
  v_normalized text := lower(trim(p_new_status));
  v_next_order_status text;
begin
  if auth.uid() is null then
    raise exception 'Login required' using errcode = '28000';
  end if;

  if v_normalized = 'assigned' then
    v_normalized := 'assigned';
  end if;

  select * into v_delivery from public.deliveries where id = p_delivery_id for update;
  if v_delivery.id is null then
    raise exception 'Delivery not found';
  end if;

  if not public.is_admin_user() then
    if v_courier_id is null or v_delivery.courier_id is distinct from v_courier_id then
      raise exception 'Not authorized';
    end if;
  end if;

  if v_normalized = 'picked_up' and v_delivery.status not in ('assigned', 'courier_assigned') then
    raise exception 'Invalid transition to picked_up';
  end if;

  if v_normalized = 'on_the_way' and v_delivery.status <> 'picked_up' then
    raise exception 'Invalid transition to on_the_way';
  end if;

  if v_normalized = 'delivered' and v_delivery.status <> 'on_the_way' then
    raise exception 'Invalid transition to delivered';
  end if;

  if v_normalized not in ('picked_up', 'on_the_way', 'delivered', 'cancelled') then
    raise exception 'Invalid delivery status';
  end if;

  update public.deliveries
  set status = v_normalized,
      picked_up_at = case when v_normalized = 'picked_up' then now() else picked_up_at end,
      delivered_at = case when v_normalized = 'delivered' then now() else delivered_at end,
      notes = coalesce(p_note, notes),
      updated_at = now()
  where id = p_delivery_id
  returning * into v_delivery;

  select * into v_order from public.orders where id = v_delivery.order_id;

  v_next_order_status := case v_normalized
    when 'picked_up' then 'picked_up'
    when 'on_the_way' then 'on_the_way'
    when 'delivered' then 'delivered'
    else v_order.status
  end;

  if v_normalized in ('picked_up', 'on_the_way', 'delivered') then
    update public.orders
    set status = v_next_order_status, updated_at = now()
    where id = v_order.id;

    perform public.append_order_status_history(v_order.id, v_next_order_status, p_note);
  end if;

  return v_delivery;
end;
$$;

create or replace function public.update_delivery_status(
  p_delivery_id uuid,
  p_new_status text,
  p_note text default null
)
returns public.deliveries
language sql
security definer
set search_path = public
as $$
  select public.update_courier_delivery_status(p_delivery_id, p_new_status, p_note);
$$;

grant execute on function public.update_courier_delivery_status(uuid, text, text) to authenticated;
grant execute on function public.update_delivery_status(uuid, text, text) to authenticated;

-- RLS: courier reads available pool + own assignments
drop policy if exists "Couriers read open or assigned deliveries" on public.deliveries;

create policy "Couriers read open or assigned deliveries"
on public.deliveries for select
using (
  public.is_active_courier()
  and (
    (status in ('available', 'open') and courier_id is null)
    or courier_id = public.get_my_courier_id()
  )
);

drop policy if exists "Couriers read related orders" on public.orders;

create policy "Couriers read related orders"
on public.orders for select
using (
  public.is_active_courier()
  and exists (
    select 1
    from public.deliveries d
    where d.order_id = orders.id
      and (
        (d.status in ('available', 'open') and d.courier_id is null)
        or d.courier_id = public.get_my_courier_id()
      )
  )
);

-- Backfill delivery tasks for already-approved delivery orders (idempotent)
do $$
declare
  r record;
begin
  for r in
    select o.id
    from public.orders o
    where o.order_type = 'delivery'
      and o.status in (
        'accepted',
        'preparing',
        'ready_for_pickup',
        'courier_assigned',
        'picked_up',
        'on_the_way'
      )
      and not exists (
        select 1 from public.deliveries d where d.order_id = o.id
      )
  loop
    perform public.ensure_courier_delivery_for_order(r.id);
  end loop;
end $$;
