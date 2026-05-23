create table if not exists public.venue_menu_categories (
  id uuid primary key default gen_random_uuid(),
  venue_id bigint not null references public.venues(id) on delete cascade,
  name text not null,
  sort_order integer default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.venue_menu_items (
  id uuid primary key default gen_random_uuid(),
  venue_id bigint not null references public.venues(id) on delete cascade,
  category_id uuid references public.venue_menu_categories(id) on delete set null,
  name text not null,
  description text,
  price numeric(10,2),
  currency text default 'TRY',
  image_url text,
  is_available boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now()
);

create index if not exists venue_menu_categories_venue_id_idx
on public.venue_menu_categories (venue_id);

create index if not exists venue_menu_items_venue_id_idx
on public.venue_menu_items (venue_id);

create index if not exists venue_menu_items_category_id_idx
on public.venue_menu_items (category_id);

alter table public.venue_menu_categories enable row level security;
alter table public.venue_menu_items enable row level security;

drop policy if exists "Public can read active menu categories"
on public.venue_menu_categories;

drop policy if exists "Business owners can insert own menu categories"
on public.venue_menu_categories;

drop policy if exists "Business owners can read own menu categories"
on public.venue_menu_categories;

drop policy if exists "Business owners can update own menu categories"
on public.venue_menu_categories;

drop policy if exists "Business owners can delete own menu categories"
on public.venue_menu_categories;

drop policy if exists "Public can read active menu items"
on public.venue_menu_items;

drop policy if exists "Business owners can insert own menu items"
on public.venue_menu_items;

drop policy if exists "Business owners can read own menu items"
on public.venue_menu_items;

drop policy if exists "Business owners can update own menu items"
on public.venue_menu_items;

drop policy if exists "Business owners can delete own menu items"
on public.venue_menu_items;

create policy "Public can read active menu categories"
on public.venue_menu_categories
for select
using (is_active = true);

create policy "Business owners can read own menu categories"
on public.venue_menu_categories
for select
using (
  exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_menu_categories.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
);

create policy "Business owners can insert own menu categories"
on public.venue_menu_categories
for insert
with check (
  exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_menu_categories.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
);

create policy "Business owners can update own menu categories"
on public.venue_menu_categories
for update
using (
  exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_menu_categories.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
)
with check (
  exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_menu_categories.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
);

create policy "Business owners can delete own menu categories"
on public.venue_menu_categories
for delete
using (
  exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_menu_categories.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
);

create policy "Public can read active menu items"
on public.venue_menu_items
for select
using (
  is_available = true
  and (
    category_id is null
    or exists (
      select 1
      from public.venue_menu_categories c
      where c.id = venue_menu_items.category_id
        and c.is_active = true
    )
  )
);

create policy "Business owners can read own menu items"
on public.venue_menu_items
for select
using (
  exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_menu_items.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
);

create policy "Business owners can insert own menu items"
on public.venue_menu_items
for insert
with check (
  exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_menu_items.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
  and (
    category_id is null
    or exists (
      select 1
      from public.venue_menu_categories c
      where c.id = venue_menu_items.category_id
        and c.venue_id = venue_menu_items.venue_id
    )
  )
);

create policy "Business owners can update own menu items"
on public.venue_menu_items
for update
using (
  exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_menu_items.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
)
with check (
  exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_menu_items.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
  and (
    category_id is null
    or exists (
      select 1
      from public.venue_menu_categories c
      where c.id = venue_menu_items.category_id
        and c.venue_id = venue_menu_items.venue_id
    )
  )
);

create policy "Business owners can delete own menu items"
on public.venue_menu_items
for delete
using (
  exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_menu_items.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
);
