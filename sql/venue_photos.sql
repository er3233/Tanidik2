create table if not exists public.venue_photos (
  id uuid primary key default gen_random_uuid(),
  venue_id bigint not null references public.venues(id) on delete cascade,
  image_url text not null,
  sort_order integer default 0,
  created_at timestamptz default now()
);

alter table public.venue_photos enable row level security;

drop policy if exists "Public can read venue photos"
on public.venue_photos;

drop policy if exists "Business owners can insert own venue photos"
on public.venue_photos;

drop policy if exists "Business owners can update own venue photos"
on public.venue_photos;

drop policy if exists "Business owners can delete own venue photos"
on public.venue_photos;

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
