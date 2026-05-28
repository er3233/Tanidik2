-- Courier dispatch production MVP patch (rerunnable).
-- Run after restaurant_ordering_courier_mvp.sql

-- ---------------------------------------------------------------------------
-- Status migration
-- ---------------------------------------------------------------------------

alter table public.orders drop constraint if exists orders_status_check;

update public.orders
set status = 'courier_assigned'
where status = 'out_for_delivery';

alter table public.orders
add constraint orders_status_check check (
  status in (
    'pending',
    'accepted',
    'rejected',
    'preparing',
    'ready_for_pickup',
    'courier_assigned',
    'picked_up',
    'on_the_way',
    'delivered',
    'cancelled'
  )
);

alter table public.deliveries drop constraint if exists deliveries_status_check;

update public.deliveries set status = 'open' where status = 'pending';
update public.deliveries set status = 'courier_assigned' where status = 'assigned';
update public.deliveries set status = 'on_the_way' where status = 'in_transit';

alter table public.deliveries
add constraint deliveries_status_check check (
  status in (
    'open',
    'courier_assigned',
    'picked_up',
    'on_the_way',
    'delivered',
    'cancelled'
  )
);

-- ---------------------------------------------------------------------------
-- RLS: open pool + own assigned only (no cross-courier assigned reads)
-- ---------------------------------------------------------------------------

drop policy if exists "Couriers read related orders" on public.orders;
drop policy if exists "Couriers read related order items" on public.order_items;
drop policy if exists "Couriers read open or assigned deliveries" on public.deliveries;

create policy "Couriers read related orders"
on public.orders for select
using (
  public.is_active_courier()
  and exists (
    select 1
    from public.deliveries d
    where d.order_id = orders.id
      and (
        (d.status = 'open' and d.courier_id is null)
        or d.courier_id = public.get_my_courier_id()
      )
  )
);

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
        (d.status = 'open' and d.courier_id is null)
        or d.courier_id = public.get_my_courier_id()
      )
  )
);

create policy "Couriers read open or assigned deliveries"
on public.deliveries for select
using (
  public.is_active_courier()
  and (
    (status = 'open' and courier_id is null)
    or courier_id = public.get_my_courier_id()
  )
);

-- Business: read-only on deliveries (no update grant; mutations via RPC only).
drop policy if exists "Business owners read venue deliveries" on public.deliveries;
create policy "Business owners read venue deliveries"
on public.deliveries for select
using (
  exists (
    select 1 from public.orders o
    where o.id = deliveries.order_id
      and (
        o.business_owner_id = auth.uid()
        or public.is_business_owner_for_venue(o.venue_id)
      )
  )
);

-- ---------------------------------------------------------------------------
-- create_restaurant_order: delivery row created at ready_for_pickup only
-- ---------------------------------------------------------------------------

create or replace function public.ensure_open_delivery_for_order(p_order_id uuid)
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

  select * into v_delivery from public.deliveries where order_id = p_order_id;
  if v_delivery.id is not null then
    if v_delivery.status in ('open', 'pending') and v_delivery.courier_id is null then
      update public.deliveries
      set status = 'open', updated_at = now()
      where id = v_delivery.id
      returning * into v_delivery;
    end if;
    return v_delivery;
  end if;

  insert into public.deliveries (order_id, status)
  values (p_order_id, 'open')
  returning * into v_delivery;

  return v_delivery;
end;
$$;

revoke all on function public.ensure_open_delivery_for_order(uuid) from public, authenticated;

drop function if exists public.create_restaurant_order(
  bigint, text, text, text, jsonb
);

create or replace function public.create_restaurant_order(
  p_venue_id bigint,
  p_order_type text,
  p_delivery_address text default null,
  p_customer_note text default null,
  p_items jsonb default '[]'::jsonb
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_owner_id uuid;
  v_menu_id uuid;
  v_order public.orders%rowtype;
  v_item jsonb;
  v_menu_item public.menu_items%rowtype;
  v_qty integer;
  v_line_total numeric(10, 2);
  v_total numeric(10, 2) := 0;
begin
  if v_user_id is null then
    raise exception 'Login required' using errcode = '28000';
  end if;

  if p_order_type not in ('pickup', 'delivery') then
    raise exception 'Invalid order type';
  end if;

  if p_order_type = 'delivery' and coalesce(trim(p_delivery_address), '') = '' then
    raise exception 'Delivery address required';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Order must include at least one item';
  end if;

  v_owner_id := public.get_business_owner_id_for_venue(p_venue_id);
  if v_owner_id is null then
    raise exception 'Venue not found';
  end if;

  select m.id into v_menu_id
  from public.restaurant_menus m
  where m.venue_id = p_venue_id and m.is_active = true
  limit 1;

  if v_menu_id is null then
    raise exception 'No active menu for this venue';
  end if;

  insert into public.orders (
    user_id, venue_id, business_owner_id, status, order_type,
    total_amount, delivery_address, customer_note
  )
  values (
    v_user_id, p_venue_id, v_owner_id, 'pending', p_order_type,
    0, nullif(trim(p_delivery_address), ''), nullif(trim(p_customer_note), '')
  )
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_menu_item
    from public.menu_items mi
    where mi.id = (v_item->>'menu_item_id')::uuid
      and mi.menu_id = v_menu_id
      and mi.is_available = true;

    if v_menu_item.id is null then
      raise exception 'Invalid menu item';
    end if;

    v_qty := greatest(1, coalesce((v_item->>'quantity')::integer, 1));
    v_line_total := round(v_menu_item.price * v_qty, 2);
    v_total := v_total + v_line_total;

    insert into public.order_items (
      order_id, menu_item_id, item_name, quantity, unit_price, total_price
    )
    values (
      v_order.id, v_menu_item.id, v_menu_item.name, v_qty, v_menu_item.price, v_line_total
    );
  end loop;

  update public.orders
  set total_amount = v_total, updated_at = now()
  where id = v_order.id
  returning * into v_order;

  perform public.append_order_status_history(v_order.id, 'pending', 'Order created');

  return v_order;
end;
$$;

grant execute on function public.create_restaurant_order(
  bigint, text, text, text, jsonb
) to authenticated;

-- ---------------------------------------------------------------------------
-- update_restaurant_order_status: open delivery on ready_for_pickup
-- ---------------------------------------------------------------------------

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

  if p_new_status = 'preparing' and v_order.status <> 'accepted' then
    raise exception 'Only accepted orders can move to preparing';
  end if;

  if p_new_status = 'ready_for_pickup' and v_order.status <> 'preparing' then
    raise exception 'Only preparing orders can be marked ready';
  end if;

  update public.orders
  set status = p_new_status, updated_at = now()
  where id = p_order_id
  returning * into v_order;

  perform public.append_order_status_history(p_order_id, p_new_status, p_note);

  if p_new_status = 'ready_for_pickup' and v_order.order_type = 'delivery' then
    perform public.ensure_open_delivery_for_order(p_order_id);
  end if;

  return v_order;
end;
$$;

grant execute on function public.update_restaurant_order_status(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- accept_delivery: atomic claim (one courier only)
-- ---------------------------------------------------------------------------

create or replace function public.accept_delivery(p_delivery_id uuid)
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
      status = 'courier_assigned',
      assigned_at = now(),
      updated_at = now()
  where id = p_delivery_id
    and status = 'open'
    and courier_id is null
  returning * into v_delivery;

  if v_delivery.id is null then
    raise exception 'Delivery already claimed or unavailable'
      using errcode = '40001';
  end if;

  select * into v_order from public.orders where id = v_delivery.order_id for update;

  update public.orders
  set status = 'courier_assigned', updated_at = now()
  where id = v_order.id
    and status = 'ready_for_pickup';

  perform public.append_order_status_history(
    v_order.id, 'courier_assigned', 'Courier accepted delivery'
  );

  return v_delivery;
end;
$$;

grant execute on function public.accept_delivery(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- update_delivery_status: courier-owned transitions only
-- ---------------------------------------------------------------------------

create or replace function public.update_delivery_status(
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
  v_next_order_status text;
begin
  if auth.uid() is null then
    raise exception 'Login required' using errcode = '28000';
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

  if p_new_status = 'picked_up' and v_delivery.status <> 'courier_assigned' then
    raise exception 'Invalid transition to picked_up';
  end if;

  if p_new_status = 'on_the_way' and v_delivery.status <> 'picked_up' then
    raise exception 'Invalid transition to on_the_way';
  end if;

  if p_new_status = 'delivered' and v_delivery.status <> 'on_the_way' then
    raise exception 'Invalid transition to delivered';
  end if;

  if p_new_status not in ('picked_up', 'on_the_way', 'delivered', 'cancelled') then
    raise exception 'Invalid delivery status';
  end if;

  update public.deliveries
  set status = p_new_status,
      picked_up_at = case when p_new_status = 'picked_up' then now() else picked_up_at end,
      delivered_at = case when p_new_status = 'delivered' then now() else delivered_at end,
      notes = coalesce(p_note, notes),
      updated_at = now()
  where id = p_delivery_id
  returning * into v_delivery;

  select * into v_order from public.orders where id = v_delivery.order_id;

  v_next_order_status := case p_new_status
    when 'picked_up' then 'picked_up'
    when 'on_the_way' then 'on_the_way'
    when 'delivered' then 'delivered'
    else v_order.status
  end;

  if v_next_order_status is not null and p_new_status in ('picked_up', 'on_the_way', 'delivered') then
    update public.orders
    set status = v_next_order_status, updated_at = now()
    where id = v_order.id;

    perform public.append_order_status_history(v_order.id, v_next_order_status, p_note);
  end if;

  return v_delivery;
end;
$$;

grant execute on function public.update_delivery_status(uuid, text, text) to authenticated;
