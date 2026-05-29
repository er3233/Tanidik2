-- Restaurant ordering + courier delivery MVP
-- Run manually in Supabase SQL Editor after venues/businesses/admin_users exist.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.restaurant_menus (
  id uuid primary key default gen_random_uuid(),
  venue_id bigint not null references public.venues(id) on delete cascade,
  name text not null default 'Ana Menü',
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id)
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.restaurant_menus(id) on delete cascade,
  name text not null,
  description text,
  category text,
  price numeric(10, 2) not null default 0 check (price >= 0),
  image_url text,
  is_available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  venue_id bigint not null references public.venues(id) on delete restrict,
  business_owner_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending',
  order_type text not null default 'pickup' check (order_type in ('pickup', 'delivery')),
  total_amount numeric(10, 2) not null default 0 check (total_amount >= 0),
  delivery_address text,
  customer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_status_check check (
    status in (
      'pending',
      'accepted',
      'rejected',
      'preparing',
      'ready_for_pickup',
      'out_for_delivery',
      'delivered',
      'cancelled'
    )
  )
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  item_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10, 2) not null default 0 check (unit_price >= 0),
  total_price numeric(10, 2) not null default 0 check (total_price >= 0)
);

create table if not exists public.couriers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  vehicle_type text,
  status text not null default 'active' check (status in ('active', 'inactive', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  courier_id uuid references public.couriers(id) on delete set null,
  status text not null default 'pending' check (
    status in ('pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled')
  ),
  assigned_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  changed_by uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists restaurant_menus_venue_id_idx on public.restaurant_menus (venue_id);
create index if not exists menu_items_menu_id_idx on public.menu_items (menu_id);
create index if not exists orders_user_id_idx on public.orders (user_id);
create index if not exists orders_venue_id_idx on public.orders (venue_id);
create index if not exists orders_business_owner_id_idx on public.orders (business_owner_id);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists couriers_user_id_idx on public.couriers (user_id);
create index if not exists couriers_status_idx on public.couriers (status);
create index if not exists deliveries_courier_id_idx on public.deliveries (courier_id);
create index if not exists deliveries_status_idx on public.deliveries (status);
create index if not exists order_status_history_order_id_idx on public.order_status_history (order_id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid()
  );
$$;

create or replace function public.is_business_owner_for_venue(p_venue_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = p_venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') in ('approved', 'active', 'verified')
  );
$$;

create or replace function public.get_business_owner_id_for_venue(p_venue_id bigint)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select b.owner_id
  from public.venues v
  join public.businesses b on b.id = v.business_id
  where v.id = p_venue_id
  limit 1;
$$;

create or replace function public.is_active_courier()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.couriers c
    where c.user_id = auth.uid()
      and c.status = 'active'
  );
$$;

create or replace function public.get_my_courier_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.couriers c
  where c.user_id = auth.uid()
    and c.status = 'active'
  limit 1;
$$;

create or replace function public.append_order_status_history(
  p_order_id uuid,
  p_status text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.order_status_history (order_id, status, changed_by, note)
  values (p_order_id, p_status, auth.uid(), p_note);
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.restaurant_menus enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.couriers enable row level security;
alter table public.deliveries enable row level security;
alter table public.order_status_history enable row level security;

-- restaurant_menus
drop policy if exists "Public can read active restaurant menus" on public.restaurant_menus;
drop policy if exists "Business owners manage own restaurant menus" on public.restaurant_menus;
drop policy if exists "Admins manage all restaurant menus" on public.restaurant_menus;

create policy "Public can read active restaurant menus"
on public.restaurant_menus for select
using (is_active = true or public.is_business_owner_for_venue(venue_id) or public.is_admin_user());

create policy "Business owners manage own restaurant menus"
on public.restaurant_menus for all
using (public.is_business_owner_for_venue(venue_id))
with check (public.is_business_owner_for_venue(venue_id));

create policy "Admins manage all restaurant menus"
on public.restaurant_menus for all
using (public.is_admin_user())
with check (public.is_admin_user());

-- menu_items
drop policy if exists "Public can read available menu items" on public.menu_items;
drop policy if exists "Business owners manage own menu items" on public.menu_items;
drop policy if exists "Admins manage all menu items" on public.menu_items;

create policy "Public can read available menu items"
on public.menu_items for select
using (
  exists (
    select 1
    from public.restaurant_menus m
    where m.id = menu_items.menu_id
      and (
        (m.is_active = true and menu_items.is_available = true)
        or public.is_business_owner_for_venue(m.venue_id)
        or public.is_admin_user()
      )
  )
);

create policy "Business owners manage own menu items"
on public.menu_items for all
using (
  exists (
    select 1
    from public.restaurant_menus m
    where m.id = menu_items.menu_id
      and public.is_business_owner_for_venue(m.venue_id)
  )
)
with check (
  exists (
    select 1
    from public.restaurant_menus m
    where m.id = menu_items.menu_id
      and public.is_business_owner_for_venue(m.venue_id)
  )
);

create policy "Admins manage all menu items"
on public.menu_items for all
using (public.is_admin_user())
with check (public.is_admin_user());

-- orders (mutations only via security definer RPCs)
drop policy if exists "Customers read own orders" on public.orders;
drop policy if exists "Customers create own orders" on public.orders;
drop policy if exists "Business owners read venue orders" on public.orders;
drop policy if exists "Business owners update venue orders" on public.orders;
drop policy if exists "Couriers read related orders" on public.orders;
drop policy if exists "Admins manage all orders" on public.orders;
drop policy if exists "Admins read all orders" on public.orders;

create policy "Customers read own orders"
on public.orders for select
using (user_id = auth.uid());

create policy "Business owners read venue orders"
on public.orders for select
using (
  business_owner_id = auth.uid()
  or public.is_business_owner_for_venue(venue_id)
);

create policy "Couriers read related orders"
on public.orders for select
using (
  public.is_active_courier()
  and exists (
    select 1
    from public.deliveries d
    where d.order_id = orders.id
      and (
        (d.status = 'pending' and d.courier_id is null)
        or d.courier_id = public.get_my_courier_id()
      )
  )
);

create policy "Admins read all orders"
on public.orders for select
using (public.is_admin_user());

-- order_items (insert only via create_restaurant_order RPC)
drop policy if exists "Customers read own order items" on public.order_items;
drop policy if exists "Customers create own order items" on public.order_items;
drop policy if exists "Business owners read venue order items" on public.order_items;
drop policy if exists "Couriers read related order items" on public.order_items;
drop policy if exists "Admins read all order items" on public.order_items;

create policy "Customers read own order items"
on public.order_items for select
using (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id and o.user_id = auth.uid()
  )
);

create policy "Business owners read venue order items"
on public.order_items for select
using (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and (
        o.business_owner_id = auth.uid()
        or public.is_business_owner_for_venue(o.venue_id)
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
        (d.status = 'pending' and d.courier_id is null)
        or d.courier_id = public.get_my_courier_id()
      )
  )
);

create policy "Admins read all order items"
on public.order_items for select
using (public.is_admin_user());

-- couriers
drop policy if exists "Couriers read own profile" on public.couriers;
drop policy if exists "Admins manage couriers" on public.couriers;

create policy "Couriers read own profile"
on public.couriers for select
using (user_id = auth.uid());

create policy "Admins manage couriers"
on public.couriers for all
using (public.is_admin_user())
with check (public.is_admin_user());

-- deliveries
drop policy if exists "Customers read own deliveries" on public.deliveries;
drop policy if exists "Business owners read venue deliveries" on public.deliveries;
drop policy if exists "Couriers read open or assigned deliveries" on public.deliveries;
drop policy if exists "Couriers update assigned deliveries" on public.deliveries;
drop policy if exists "Admins manage all deliveries" on public.deliveries;
drop policy if exists "Admins read all deliveries" on public.deliveries;

create policy "Customers read own deliveries"
on public.deliveries for select
using (
  exists (
    select 1 from public.orders o
    where o.id = deliveries.order_id and o.user_id = auth.uid()
  )
);

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

create policy "Couriers read open or assigned deliveries"
on public.deliveries for select
using (
  public.is_active_courier()
  and (
    (status = 'pending' and courier_id is null)
    or courier_id = public.get_my_courier_id()
  )
);

drop policy if exists "Couriers update assigned deliveries" on public.deliveries;

create policy "Admins read all deliveries"
on public.deliveries for select
using (public.is_admin_user());

-- order_status_history
drop policy if exists "Participants read order status history" on public.order_status_history;
drop policy if exists "Admins read all order status history" on public.order_status_history;

create policy "Participants read order status history"
on public.order_status_history for select
using (
  exists (
    select 1 from public.orders o
    where o.id = order_status_history.order_id
      and (
        o.user_id = auth.uid()
        or o.business_owner_id = auth.uid()
        or public.is_business_owner_for_venue(o.venue_id)
        or public.is_admin_user()
      )
  )
  or (
    public.is_active_courier()
    and exists (
      select 1
      from public.deliveries d
      join public.couriers c on c.id = d.courier_id
      where d.order_id = order_status_history.order_id
        and c.user_id = auth.uid()
    )
  )
);

create policy "Admins read all order status history"
on public.order_status_history for select
using (public.is_admin_user());

-- Table privileges (reservation-style): authenticated = SELECT only.
-- All writes: create_restaurant_order, update_restaurant_order_status,
-- accept_delivery, update_delivery_status (security definer).
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

grant select on public.restaurant_menus, public.menu_items to anon, authenticated;
grant insert, update, delete on public.restaurant_menus, public.menu_items to authenticated;
grant select on public.couriers to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: create_restaurant_order
-- ---------------------------------------------------------------------------

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

  if p_order_type = 'delivery' then
    insert into public.deliveries (order_id, status)
    values (v_order.id, 'pending');
  end if;

  return v_order;
end;
$$;

grant execute on function public.create_restaurant_order(
  bigint, text, text, text, jsonb
) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: update_restaurant_order_status (business)
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
begin
  if auth.uid() is null then
    raise exception 'Login required' using errcode = '28000';
  end if;

  if p_new_status = any(v_allowed) is false then
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

  update public.orders
  set status = p_new_status, updated_at = now()
  where id = p_order_id
  returning * into v_order;

  perform public.append_order_status_history(p_order_id, p_new_status, p_note);

  if p_new_status = 'ready_for_pickup' and v_order.order_type = 'delivery' then
    update public.deliveries
    set status = case when courier_id is null then 'pending' else 'assigned' end,
        updated_at = now()
    where order_id = p_order_id;
  end if;

  return v_order;
end;
$$;

grant execute on function public.update_restaurant_order_status(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: accept_delivery (courier)
-- ---------------------------------------------------------------------------

drop function if exists public.accept_delivery(uuid);

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

  if v_delivery.status <> 'pending' or v_delivery.courier_id is not null then
    raise exception 'Delivery is not available';
  end if;

  update public.deliveries
  set courier_id = v_courier_id,
      status = 'assigned',
      assigned_at = now(),
      updated_at = now()
  where id = p_delivery_id
  returning * into v_delivery;

  select * into v_order from public.orders where id = v_delivery.order_id;

  update public.orders
  set status = 'out_for_delivery', updated_at = now()
  where id = v_order.id and status in ('ready_for_pickup', 'accepted', 'preparing');

  perform public.append_order_status_history(
    v_order.id, 'out_for_delivery', 'Courier accepted delivery'
  );

  return v_delivery;
end;
$$;

grant execute on function public.accept_delivery(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: update_delivery_status (courier / admin)
-- ---------------------------------------------------------------------------

drop function if exists public.update_delivery_status(uuid, text, text);

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
  v_allowed text[] := array['picked_up', 'in_transit', 'delivered', 'cancelled'];
begin
  if auth.uid() is null then
    raise exception 'Login required' using errcode = '28000';
  end if;

  if p_new_status = any(v_allowed) is false then
    raise exception 'Invalid delivery status';
  end if;

  select * into v_delivery from public.deliveries where id = p_delivery_id for update;
  if v_delivery.id is null then
    raise exception 'Delivery not found';
  end if;

  if not public.is_admin_user() then
    if v_courier_id is null or v_delivery.courier_id <> v_courier_id then
      raise exception 'Not authorized';
    end if;
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

  if p_new_status = 'delivered' then
    update public.orders set status = 'delivered', updated_at = now() where id = v_order.id;
    perform public.append_order_status_history(v_order.id, 'delivered', p_note);
  elsif p_new_status = 'picked_up' then
    update public.orders set status = 'out_for_delivery', updated_at = now()
    where id = v_order.id and status <> 'delivered';
    perform public.append_order_status_history(v_order.id, 'out_for_delivery', p_note);
  end if;

  return v_delivery;
end;
$$;

grant execute on function public.update_delivery_status(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: admin upsert courier
-- ---------------------------------------------------------------------------

drop function if exists public.admin_upsert_courier(uuid, text, text, text, text);

create or replace function public.admin_upsert_courier(
  p_user_id uuid,
  p_full_name text,
  p_phone text default null,
  p_vehicle_type text default null,
  p_status text default 'active'
)
returns public.couriers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_courier public.couriers%rowtype;
begin
  if not public.is_admin_user() then
    raise exception 'Admin access required';
  end if;

  insert into public.couriers (user_id, full_name, phone, vehicle_type, status)
  values (p_user_id, trim(p_full_name), nullif(trim(p_phone), ''), nullif(trim(p_vehicle_type), ''), coalesce(p_status, 'active'))
  on conflict (user_id) do update
  set full_name = excluded.full_name,
      phone = excluded.phone,
      vehicle_type = excluded.vehicle_type,
      status = excluded.status,
      updated_at = now()
  returning * into v_courier;

  return v_courier;
end;
$$;

grant execute on function public.admin_upsert_courier(uuid, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: admin find user by email
-- ---------------------------------------------------------------------------

drop function if exists public.admin_find_user_id_by_email(text);

create or replace function public.admin_find_user_id_by_email(p_email text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
begin
  if not public.is_admin_user() then
    raise exception 'Admin access required';
  end if;

  select u.id into v_user_id
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;

  return v_user_id;
end;
$$;

grant execute on function public.admin_find_user_id_by_email(text) to authenticated;

revoke all on function public.get_business_owner_id_for_venue(bigint) from public, authenticated;

-- ---------------------------------------------------------------------------
-- Security hardening pass (safe to re-run after initial deploy)
-- ---------------------------------------------------------------------------

drop policy if exists "Customers create own orders" on public.orders;
drop policy if exists "Business owners update venue orders" on public.orders;
drop policy if exists "Admins manage all orders" on public.orders;
drop policy if exists "Admins read all orders" on public.orders;
drop policy if exists "Customers create own order items" on public.order_items;
drop policy if exists "Couriers update assigned deliveries" on public.deliveries;
drop policy if exists "Admins manage all deliveries" on public.deliveries;
drop policy if exists "Admins read all deliveries" on public.deliveries;

revoke insert, update, delete on public.orders from anon, authenticated;
revoke insert, update, delete on public.order_items from anon, authenticated;
revoke insert, update, delete on public.deliveries from anon, authenticated;
revoke insert, update, delete on public.order_status_history from anon, authenticated;

grant select on public.orders to authenticated;
grant select on public.order_items to authenticated;
grant select on public.deliveries to authenticated;
grant select on public.order_status_history to authenticated;
