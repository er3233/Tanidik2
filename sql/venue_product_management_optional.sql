create table if not exists public.venue_product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.venue_products(id) on delete cascade,
  image_url text not null,
  sort_order integer default 0,
  created_at timestamptz default now()
);

create index if not exists venue_product_images_product_id_idx
on public.venue_product_images (product_id);

alter table public.venue_product_images enable row level security;

drop policy if exists "Public can read active product images"
on public.venue_product_images;

drop policy if exists "Business owners can read own product images"
on public.venue_product_images;

drop policy if exists "Business owners can insert own product images"
on public.venue_product_images;

drop policy if exists "Business owners can update own product images"
on public.venue_product_images;

drop policy if exists "Business owners can delete own product images"
on public.venue_product_images;

create policy "Public can read active product images"
on public.venue_product_images
for select
using (
  exists (
    select 1
    from public.venue_products p
    where p.id = venue_product_images.product_id
      and coalesce(p.is_active, true) = true
  )
);

create policy "Business owners can read own product images"
on public.venue_product_images
for select
using (
  exists (
    select 1
    from public.venue_products p
    join public.venues v on v.id = p.venue_id
    join public.businesses b on b.id = v.business_id
    where p.id = venue_product_images.product_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
);

create policy "Business owners can insert own product images"
on public.venue_product_images
for insert
with check (
  exists (
    select 1
    from public.venue_products p
    join public.venues v on v.id = p.venue_id
    join public.businesses b on b.id = v.business_id
    where p.id = venue_product_images.product_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
);

create policy "Business owners can update own product images"
on public.venue_product_images
for update
using (
  exists (
    select 1
    from public.venue_products p
    join public.venues v on v.id = p.venue_id
    join public.businesses b on b.id = v.business_id
    where p.id = venue_product_images.product_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
)
with check (
  exists (
    select 1
    from public.venue_products p
    join public.venues v on v.id = p.venue_id
    join public.businesses b on b.id = v.business_id
    where p.id = venue_product_images.product_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
);

create policy "Business owners can delete own product images"
on public.venue_product_images
for delete
using (
  exists (
    select 1
    from public.venue_products p
    join public.venues v on v.id = p.venue_id
    join public.businesses b on b.id = v.business_id
    where p.id = venue_product_images.product_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
);
