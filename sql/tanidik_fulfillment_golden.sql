-- =============================================================================
-- TANIDIK Fulfillment Golden Migration (idempotent)
-- =============================================================================
-- Single source of truth for restaurant ordering + courier delivery.
-- Safe to re-run on production and staging (Supabase SQL Editor).
--
-- Supersedes (do not run individually on fresh deploys):
--   restaurant_ordering_courier_mvp.sql
--   restaurant_courier_dispatch_mvp.sql
--   courier_deliveries_mvp.sql
--   courier_pool_hotfix.sql
--   courier_email_link_mvp.sql
--   courier_system_audit_fix.sql
--   admin_upsert_courier_fix.sql
--   orders_customer_read_rpc.sql
--   restaurant_ordering_security_grants.sql
--
-- Prerequisites: public.venues, public.businesses, public.admin_users, auth.users
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0) Migration ledger
-- ---------------------------------------------------------------------------
create table if not exists public.schema_migrations (
  id text primary key,
  applied_at timestamptz not null default now(),
  notes text
);

-- ---------------------------------------------------------------------------
-- 1) Core tables
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
  updated_at timestamptz not null default now()
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
  user_id uuid unique references auth.users(id) on delete cascade,
  email text,
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
  venue_id bigint references public.venues(id) on delete set null,
  business_owner_id uuid references auth.users(id) on delete set null,
  courier_id uuid references public.couriers(id) on delete set null,
  status text not null default 'available',
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

-- Courier invite-before-signup
alter table public.couriers alter column user_id drop not null;
alter table public.couriers add column if not exists email text;

alter table public.deliveries add column if not exists venue_id bigint references public.venues(id) on delete set null;
alter table public.deliveries add column if not exists business_owner_id uuid references auth.users(id) on delete set null;

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
create unique index if not exists deliveries_order_id_uidx on public.deliveries (order_id);

-- Replace table-level UNIQUE(user_id) with partial index (allows invite rows with user_id NULL)
alter table public.couriers drop constraint if exists couriers_user_id_key;
drop index if exists public.couriers_user_id_key;

create unique index if not exists couriers_user_id_uidx
  on public.couriers (user_id)
  where user_id is not null;

create unique index if not exists couriers_email_lower_uidx
  on public.couriers (lower(trim(email)))
  where email is not null and trim(email) <> '';

-- ---------------------------------------------------------------------------
-- 2) Status vocabulary normalization (data + constraints)
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

update public.deliveries set status = 'available' where status in ('open', 'pending');
update public.deliveries set status = 'assigned' where status in ('courier_assigned', 'assigned');
update public.deliveries set status = 'on_the_way' where status = 'in_transit';

update public.deliveries
set status = 'available',
    updated_at = now()
where courier_id is null
  and status in ('pending', 'open');

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
-- 3) Helper functions
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

-- Courier session (email invite + auto link)
drop function if exists public.resolve_my_active_courier();

create or replace function public.resolve_my_active_courier()
returns public.couriers
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_courier public.couriers%rowtype;
  v_uid uuid := auth.uid();
  v_session_email text;
begin
  if v_uid is null then
    raise exception 'Login required' using errcode = '28000';
  end if;

  select * into v_courier
  from public.couriers
  where user_id = v_uid
    and status = 'active'
  limit 1;

  if found then
    return v_courier;
  end if;

  select lower(trim(u.email)) into v_session_email
  from auth.users u
  where u.id = v_uid;

  if v_session_email is null or v_session_email = '' then
    return null;
  end if;

  select * into v_courier
  from public.couriers
  where lower(trim(email)) = v_session_email
    and status = 'active'
  order by created_at desc
  limit 1;

  if not found then
    return null;
  end if;

  if v_courier.user_id is null then
    update public.couriers
    set user_id = v_uid,
        email = coalesce(nullif(trim(email), ''), v_session_email),
        updated_at = now()
    where id = v_courier.id
    returning * into v_courier;

    return v_courier;
  end if;

  if v_courier.user_id <> v_uid then
    raise exception 'Courier email is linked to another account' using errcode = '42501';
  end if;

  return v_courier;
end;
$$;

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
revoke all on function public.resolve_my_active_courier() from public;
grant execute on function public.resolve_my_active_courier() to authenticated;

-- RLS-safe cross-table lookups (security definer bypasses policy recursion)
create or replace function public.delivery_order_user_id(p_order_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select o.user_id from public.orders o where o.id = p_order_id limit 1;
$$;

create or replace function public.delivery_order_business_owner_id(p_order_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select o.business_owner_id from public.orders o where o.id = p_order_id limit 1;
$$;

create or replace function public.delivery_order_venue_id(p_order_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select o.venue_id from public.orders o where o.id = p_order_id limit 1;
$$;

create or replace function public.courier_can_read_delivery(
  p_delivery_id uuid,
  p_status text,
  p_courier_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
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
    (p_status in ('available', 'open', 'pending') and p_courier_id is null)
    or p_courier_id in (
      select c2.id
      from public.couriers c2
      where c2.status = 'active'
        and c2.user_id = auth.uid()
    )
  );
$$;

create or replace function public.courier_can_read_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and o.order_type = 'delivery'
  )
  and exists (
    select 1
    from public.couriers c
    where c.status = 'active'
      and c.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.deliveries d
    where d.order_id = p_order_id
      and (
        (d.status in ('available', 'open', 'pending') and d.courier_id is null)
        or d.courier_id in (
          select c2.id
          from public.couriers c2
          where c2.status = 'active'
            and c2.user_id = auth.uid()
        )
      )
  );
$$;

revoke all on function public.delivery_order_user_id(uuid) from public;
revoke all on function public.delivery_order_business_owner_id(uuid) from public;
revoke all on function public.delivery_order_venue_id(uuid) from public;
revoke all on function public.courier_can_read_delivery(uuid, text, uuid) from public;
revoke all on function public.courier_can_read_order(uuid) from public;

-- ---------------------------------------------------------------------------
-- 4) Delivery task RPCs
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

create or replace function public.ensure_open_delivery_for_order(p_order_id uuid)
returns public.deliveries
language sql
security definer
set search_path = public
as $$
  select public.ensure_courier_delivery_for_order(p_order_id);
$$;

revoke all on function public.ensure_courier_delivery_for_order(uuid) from public;
grant execute on function public.ensure_courier_delivery_for_order(uuid) to authenticated;
grant execute on function public.ensure_open_delivery_for_order(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Order RPCs
-- ---------------------------------------------------------------------------
drop function if exists public.create_restaurant_order(bigint, text, text, text, jsonb);

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

grant execute on function public.create_restaurant_order(bigint, text, text, text, jsonb) to authenticated;

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

drop function if exists public.get_my_restaurant_orders();
drop function if exists public.get_my_restaurant_order(uuid);
drop function if exists public.get_business_restaurant_orders(bigint[]);

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

revoke all on function public.get_my_restaurant_orders() from public;
revoke all on function public.get_my_restaurant_order(uuid) from public;
revoke all on function public.get_business_restaurant_orders(bigint[]) from public;
grant execute on function public.get_my_restaurant_orders() to authenticated;
grant execute on function public.get_my_restaurant_order(uuid) to authenticated;
grant execute on function public.get_business_restaurant_orders(bigint[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 6) Courier pool + accept + status RPCs
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

grant execute on function public.get_courier_delivery_pool() to authenticated;
grant execute on function public.get_available_courier_deliveries() to authenticated;

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
    and status in ('available', 'open', 'pending')
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
-- 7) Admin RPCs
-- ---------------------------------------------------------------------------
drop function if exists public.admin_upsert_courier(uuid, text, text, text, text);
drop function if exists public.admin_upsert_courier(uuid, text, text, text, text, text);

create or replace function public.admin_upsert_courier(
  p_user_id uuid default null,
  p_full_name text default null,
  p_phone text default null,
  p_vehicle_type text default null,
  p_status text default 'active',
  p_email text default null
)
returns public.couriers
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_courier public.couriers%rowtype;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_auth_email text;
begin
  if not public.is_admin_user() then
    raise exception 'Admin access required';
  end if;

  if trim(coalesce(p_full_name, '')) = '' then
    raise exception 'Full name required';
  end if;

  if p_user_id is not null then
    select lower(trim(u.email)) into v_auth_email
    from auth.users u
    where u.id = p_user_id;

    if v_email = '' and v_auth_email is not null then
      v_email := v_auth_email;
    end if;
  end if;

  if v_email = '' then
    raise exception 'Email required';
  end if;

  select * into v_courier
  from public.couriers
  where user_id = p_user_id
  limit 1;

  if found then
    update public.couriers
    set full_name = trim(p_full_name),
        phone = nullif(trim(p_phone), ''),
        vehicle_type = nullif(trim(p_vehicle_type), ''),
        status = coalesce(p_status, 'active'),
        email = coalesce(v_email, email),
        updated_at = now()
    where id = v_courier.id
    returning * into v_courier;

    return v_courier;
  end if;

  select * into v_courier
  from public.couriers
  where lower(trim(email)) = v_email
  order by created_at desc
  limit 1;

  if found then
    update public.couriers
    set user_id = coalesce(p_user_id, user_id),
        full_name = trim(p_full_name),
        phone = nullif(trim(p_phone), ''),
        vehicle_type = nullif(trim(p_vehicle_type), ''),
        status = coalesce(p_status, 'active'),
        email = v_email,
        updated_at = now()
    where id = v_courier.id
    returning * into v_courier;

    return v_courier;
  end if;

  insert into public.couriers (
    user_id,
    full_name,
    phone,
    vehicle_type,
    status,
    email
  )
  values (
    p_user_id,
    trim(p_full_name),
    nullif(trim(p_phone), ''),
    nullif(trim(p_vehicle_type), ''),
    coalesce(p_status, 'active'),
    v_email
  )
  returning * into v_courier;

  return v_courier;
end;
$$;

grant execute on function public.admin_upsert_courier(uuid, text, text, text, text, text) to authenticated;

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

revoke all on function public.get_business_owner_id_for_venue(bigint) from public, authenticated;

-- ---------------------------------------------------------------------------
-- 8) RLS (final — no deliveries↔orders recursion)
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

-- orders
drop policy if exists "Customers read own orders" on public.orders;
drop policy if exists "Customers create own orders" on public.orders;
drop policy if exists "Business owners read venue orders" on public.orders;
drop policy if exists "Business owners update venue orders" on public.orders;
drop policy if exists "Couriers read related orders" on public.orders;
drop policy if exists "Admins manage all orders" on public.orders;
drop policy if exists "Admins read all orders" on public.orders;

create policy "Customers read own orders"
on public.orders for select
to authenticated
using (user_id = auth.uid());

create policy "Business owners read venue orders"
on public.orders for select
using (
  business_owner_id = auth.uid()
  or public.is_business_owner_for_venue(venue_id)
);

create policy "Couriers read related orders"
on public.orders for select
using (public.courier_can_read_order(id));

create policy "Admins read all orders"
on public.orders for select
using (public.is_admin_user());

-- order_items
drop policy if exists "Customers read own order items" on public.order_items;
drop policy if exists "Customers create own order items" on public.order_items;
drop policy if exists "Business owners read venue order items" on public.order_items;
drop policy if exists "Couriers read related order items" on public.order_items;
drop policy if exists "Admins read all order items" on public.order_items;

create policy "Customers read own order items"
on public.order_items for select
to authenticated
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
    where d.order_id = order_items.order_id
      and (
        (d.status in ('available', 'open', 'pending') and d.courier_id is null)
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
using (
  user_id = auth.uid()
  or (
    email is not null
    and lower(trim(email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  )
  or public.is_admin_user()
);

create policy "Admins manage couriers"
on public.couriers for all
using (public.is_admin_user())
with check (public.is_admin_user());

-- deliveries (inline courier check — avoids RLS recursion)
drop policy if exists "Customers read own deliveries" on public.deliveries;
drop policy if exists "Business owners read venue deliveries" on public.deliveries;
drop policy if exists "Couriers read open or assigned deliveries" on public.deliveries;
drop policy if exists "Couriers update assigned deliveries" on public.deliveries;
drop policy if exists "Admins manage all deliveries" on public.deliveries;
drop policy if exists "Admins read all deliveries" on public.deliveries;

create policy "Customers read own deliveries"
on public.deliveries for select
using (public.delivery_order_user_id(order_id) = auth.uid());

create policy "Business owners read venue deliveries"
on public.deliveries for select
using (
  public.delivery_order_business_owner_id(order_id) = auth.uid()
  or public.is_business_owner_for_venue(public.delivery_order_venue_id(order_id))
);

create policy "Couriers read open or assigned deliveries"
on public.deliveries for select
using (
  public.courier_can_read_delivery(id, status, courier_id)
);

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

-- ---------------------------------------------------------------------------
-- 9) Grants (RPC-only writes)
-- ---------------------------------------------------------------------------
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
-- 10) Backfill delivery tasks (idempotent)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 11) Record golden migration
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (id, notes)
values (
  'tanidik_fulfillment_golden_v1',
  'Unified restaurant ordering + courier fulfillment schema'
)
on conflict (id) do update
set applied_at = now(),
    notes = excluded.notes;

commit;

-- =============================================================================
-- Post-deploy verification (run separately in SQL Editor if needed):
--   select id, applied_at from public.schema_migrations
--     where id = 'tanidik_fulfillment_golden_v1';
--   node scripts/verify-courier-migrations.mjs
-- =============================================================================
