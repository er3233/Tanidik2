-- TANIDIK: profile avatar, venue gallery (venue_photos), product gallery (venue_product_images)
-- Run once in Supabase SQL Editor after reviewing existing schema.

-- ── Profile avatar ────────────────────────────────────────────────────────────
alter table public.profiles
add column if not exists avatar_url text;

alter table public.profiles enable row level security;

drop policy if exists "Public can read profiles" on public.profiles;
create policy "Public can read profiles"
on public.profiles
for select
using (true);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- ── Venue gallery (venue_photos = multi-image store; venues.image stays primary) ─
create table if not exists public.venue_photos (
  id uuid primary key default gen_random_uuid(),
  venue_id bigint not null references public.venues(id) on delete cascade,
  image_url text not null,
  sort_order integer default 0,
  created_at timestamptz default now()
);

create index if not exists venue_photos_venue_id_idx
on public.venue_photos (venue_id);

alter table public.venue_photos enable row level security;

drop policy if exists "Public can read venue photos" on public.venue_photos;
drop policy if exists "Business owners can insert own venue photos" on public.venue_photos;
drop policy if exists "Business owners can update own venue photos" on public.venue_photos;
drop policy if exists "Business owners can delete own venue photos" on public.venue_photos;
drop policy if exists "Admins can insert venue photos" on public.venue_photos;
drop policy if exists "Admins can update venue photos" on public.venue_photos;
drop policy if exists "Admins can delete venue photos" on public.venue_photos;

create policy "Public can read venue photos"
on public.venue_photos
for select
using (true);

create policy "Business owners can insert own venue photos"
on public.venue_photos
for insert
with check (
  exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_photos.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
);

create policy "Business owners can update own venue photos"
on public.venue_photos
for update
using (
  exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_photos.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
)
with check (
  exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_photos.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
);

create policy "Business owners can delete own venue photos"
on public.venue_photos
for delete
using (
  exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_photos.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
);

create policy "Admins can insert venue photos"
on public.venue_photos
for insert
with check (
  exists (
    select 1
    from public.admin_users a
    where a.user_id = auth.uid()
  )
);

create policy "Admins can update venue photos"
on public.venue_photos
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

create policy "Admins can delete venue photos"
on public.venue_photos
for delete
using (
  exists (
    select 1
    from public.admin_users a
    where a.user_id = auth.uid()
  )
);

-- ── Product gallery (venue_product_images) ───────────────────────────────────
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

drop policy if exists "Public can read active product images" on public.venue_product_images;
drop policy if exists "Business owners can read own product images" on public.venue_product_images;
drop policy if exists "Business owners can insert own product images" on public.venue_product_images;
drop policy if exists "Business owners can update own product images" on public.venue_product_images;
drop policy if exists "Business owners can delete own product images" on public.venue_product_images;
drop policy if exists "Admins can insert product images" on public.venue_product_images;
drop policy if exists "Admins can update product images" on public.venue_product_images;
drop policy if exists "Admins can delete product images" on public.venue_product_images;

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

create policy "Admins can insert product images"
on public.venue_product_images
for insert
with check (
  exists (
    select 1
    from public.admin_users a
    where a.user_id = auth.uid()
  )
);

create policy "Admins can update product images"
on public.venue_product_images
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

create policy "Admins can delete product images"
on public.venue_product_images
for delete
using (
  exists (
    select 1
    from public.admin_users a
    where a.user_id = auth.uid()
  )
);

-- ── Storage (bucket: tanidik-images) ─────────────────────────────────────────
-- Create bucket in Dashboard: public, allowed mime: image/jpeg, image/png, image/webp
-- Policies below assume bucket id = tanidik-images

drop policy if exists "Public read tanidik images" on storage.objects;
create policy "Public read tanidik images"
on storage.objects
for select
using (bucket_id = 'tanidik-images');

drop policy if exists "Users upload own avatars" on storage.objects;
create policy "Users upload own avatars"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'tanidik-images'
  and (storage.foldername(name))[1] = 'avatars'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "Users update own avatars" on storage.objects;
create policy "Users update own avatars"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'tanidik-images'
  and (storage.foldername(name))[1] = 'avatars'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "Users delete own avatars" on storage.objects;
create policy "Users delete own avatars"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'tanidik-images'
  and (storage.foldername(name))[1] = 'avatars'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "Authenticated upload tanidik images" on storage.objects;
create policy "Authenticated upload tanidik images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'tanidik-images'
  and (
    (storage.foldername(name))[1] in ('venues', 'products', 'events', 'messages')
    or (
      (storage.foldername(name))[1] = 'avatars'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
  )
);

drop policy if exists "Authenticated update tanidik images" on storage.objects;
create policy "Authenticated update tanidik images"
on storage.objects
for update
to authenticated
using (bucket_id = 'tanidik-images');

drop policy if exists "Authenticated delete tanidik images" on storage.objects;
create policy "Authenticated delete tanidik images"
on storage.objects
for delete
to authenticated
using (bucket_id = 'tanidik-images');
