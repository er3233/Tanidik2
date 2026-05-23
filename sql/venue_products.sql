create table if not exists public.venue_product_categories (
  id uuid primary key default gen_random_uuid(),
  venue_id bigint not null references public.venues(id) on delete cascade,
  name text not null,
  sort_order integer default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.venue_products (
  id uuid primary key default gen_random_uuid(),
  venue_id bigint not null references public.venues(id) on delete cascade,
  category_id uuid references public.venue_product_categories(id) on delete set null,
  name text not null,
  description text,
  price numeric(10,2),
  currency text default 'TRY',
  image_url text,
  stock_quantity integer,
  is_active boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now()
);

create index if not exists venue_product_categories_venue_id_idx
on public.venue_product_categories (venue_id);

create index if not exists venue_products_venue_id_idx
on public.venue_products (venue_id);

create index if not exists venue_products_category_id_idx
on public.venue_products (category_id);

alter table public.venue_product_categories enable row level security;
alter table public.venue_products enable row level security;

drop policy if exists "Public can read active product categories"
on public.venue_product_categories;

drop policy if exists "Business owners can read own product categories"
on public.venue_product_categories;

drop policy if exists "Business owners can insert own product categories"
on public.venue_product_categories;

drop policy if exists "Business owners can update own product categories"
on public.venue_product_categories;

drop policy if exists "Business owners can delete own product categories"
on public.venue_product_categories;

drop policy if exists "Public can read active products"
on public.venue_products;

drop policy if exists "Business owners can read own products"
on public.venue_products;

drop policy if exists "Business owners can insert own products"
on public.venue_products;

drop policy if exists "Business owners can update own products"
on public.venue_products;

drop policy if exists "Business owners can delete own products"
on public.venue_products;

create policy "Public can read active product categories"
on public.venue_product_categories
for select
using (is_active = true);

create policy "Business owners can read own product categories"
on public.venue_product_categories
for select
using (
  exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_product_categories.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
);

create policy "Business owners can insert own product categories"
on public.venue_product_categories
for insert
with check (
  exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_product_categories.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
);

create policy "Business owners can update own product categories"
on public.venue_product_categories
for update
using (
  exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_product_categories.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
)
with check (
  exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_product_categories.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
);

create policy "Business owners can delete own product categories"
on public.venue_product_categories
for delete
using (
  exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_product_categories.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
);

create policy "Public can read active products"
on public.venue_products
for select
using (
  is_active = true
  and (
    category_id is null
    or exists (
      select 1
      from public.venue_product_categories c
      where c.id = venue_products.category_id
        and c.is_active = true
    )
  )
);

create policy "Business owners can read own products"
on public.venue_products
for select
using (
  exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_products.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
);

create policy "Business owners can insert own products"
on public.venue_products
for insert
with check (
  exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_products.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
  and (
    category_id is null
    or exists (
      select 1
      from public.venue_product_categories c
      where c.id = venue_products.category_id
        and c.venue_id = venue_products.venue_id
    )
  )
);

create policy "Business owners can update own products"
on public.venue_products
for update
using (
  exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_products.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
)
with check (
  exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_products.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
  and (
    category_id is null
    or exists (
      select 1
      from public.venue_product_categories c
      where c.id = venue_products.category_id
        and c.venue_id = venue_products.venue_id
    )
  )
);

create policy "Business owners can delete own products"
on public.venue_products
for delete
using (
  exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_products.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
);
