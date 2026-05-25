-- venue_id uses bigint to match the existing TANIDIK venues/venue_products schema.
create table if not exists public.store_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  venue_id bigint references public.venues(id) on delete set null,
  business_owner_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending',
  total_amount numeric(10,2) not null default 0,
  customer_note text,
  created_at timestamptz not null default now()
);

create table if not exists public.store_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_orders(id) on delete cascade,
  product_id uuid references public.venue_products(id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null default 0,
  total_price numeric(10,2) not null default 0,
  image_url text
);

create index if not exists store_orders_user_id_idx
on public.store_orders (user_id);

create index if not exists store_orders_business_owner_id_idx
on public.store_orders (business_owner_id);

create index if not exists store_orders_venue_id_idx
on public.store_orders (venue_id);

create index if not exists store_order_items_order_id_idx
on public.store_order_items (order_id);

alter table public.store_orders enable row level security;
alter table public.store_order_items enable row level security;

drop policy if exists "Customers can create own store orders"
on public.store_orders;
drop policy if exists "Customers can read own store orders"
on public.store_orders;
drop policy if exists "Business owners can read own store orders"
on public.store_orders;
drop policy if exists "Business owners can update own store order status"
on public.store_orders;
drop policy if exists "Admins can read all store orders"
on public.store_orders;
drop policy if exists "Admins can update all store orders"
on public.store_orders;

drop policy if exists "Customers can create own store order items"
on public.store_order_items;
drop policy if exists "Customers can read own store order items"
on public.store_order_items;
drop policy if exists "Business owners can read own store order items"
on public.store_order_items;
drop policy if exists "Admins can read all store order items"
on public.store_order_items;

create policy "Customers can create own store orders"
on public.store_orders
for insert
with check (user_id = auth.uid());

create policy "Customers can read own store orders"
on public.store_orders
for select
using (user_id = auth.uid());

create policy "Business owners can read own store orders"
on public.store_orders
for select
using (
  business_owner_id = auth.uid()
  or exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = store_orders.venue_id
      and b.owner_id = auth.uid()
  )
);

create policy "Business owners can update own store order status"
on public.store_orders
for update
using (
  business_owner_id = auth.uid()
  or exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = store_orders.venue_id
      and b.owner_id = auth.uid()
  )
)
with check (
  business_owner_id = auth.uid()
  or exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = store_orders.venue_id
      and b.owner_id = auth.uid()
  )
);

create policy "Admins can read all store orders"
on public.store_orders
for select
using (
  exists (
    select 1
    from public.admin_users a
    where a.user_id = auth.uid()
  )
);

create policy "Admins can update all store orders"
on public.store_orders
for update
using (
  exists (
    select 1
    from public.admin_users a
    where a.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.admin_users a
    where a.user_id = auth.uid()
  )
);

create policy "Customers can create own store order items"
on public.store_order_items
for insert
with check (
  exists (
    select 1
    from public.store_orders o
    where o.id = store_order_items.order_id
      and o.user_id = auth.uid()
  )
);

create policy "Customers can read own store order items"
on public.store_order_items
for select
using (
  exists (
    select 1
    from public.store_orders o
    where o.id = store_order_items.order_id
      and o.user_id = auth.uid()
  )
);

create policy "Business owners can read own store order items"
on public.store_order_items
for select
using (
  exists (
    select 1
    from public.store_orders o
    left join public.venues v on v.id = o.venue_id
    left join public.businesses b on b.id = v.business_id
    where o.id = store_order_items.order_id
      and (
        o.business_owner_id = auth.uid()
        or b.owner_id = auth.uid()
      )
  )
);

create policy "Admins can read all store order items"
on public.store_order_items
for select
using (
  exists (
    select 1
    from public.admin_users a
    where a.user_id = auth.uid()
  )
);
