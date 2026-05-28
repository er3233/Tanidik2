-- Social / profile / media upgrade (rerunnable)
-- venue multi-image: public.venue_photos (also referred to as venue_images in app docs)

-- ── Profile identity columns ─────────────────────────────────────────────────
alter table public.profiles
add column if not exists username text;

alter table public.profiles
add column if not exists full_name text;

alter table public.profiles
add column if not exists avatar_url text;

alter table public.profiles
add column if not exists bio text;

update public.profiles
set username = lower(regexp_replace(coalesce(username, ''), '[^a-z0-9_]', '', 'g'))
where username is not null;

create unique index if not exists profiles_username_lower_unique_idx
on public.profiles (lower(username))
where username is not null and length(trim(username)) > 0;

alter table public.profiles enable row level security;

drop policy if exists "Public can read profiles" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Public can read profiles"
on public.profiles for select
using (true);

create policy "Users can insert own profile"
on public.profiles for insert
with check (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- ── Username availability (signup + profile edit) ───────────────────────────
drop function if exists public.check_username_available(text, uuid);

create or replace function public.check_username_available(
  p_username text,
  p_exclude_user_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text := lower(trim(coalesce(p_username, '')));
begin
  if v_username is null or v_username = '' then
    return false;
  end if;

  if v_username !~ '^[a-z0-9_]{3,20}$' then
    return false;
  end if;

  return not exists (
    select 1
    from public.profiles p
    where lower(p.username) = v_username
      and (p_exclude_user_id is null or p.id <> p_exclude_user_id)
  );
end;
$$;

revoke all on function public.check_username_available(text, uuid) from public;
grant execute on function public.check_username_available(text, uuid) to authenticated, anon;

-- ── venue_photos / venue_images (ensure table + RLS) ───────────────────────
create table if not exists public.venue_photos (
  id uuid primary key default gen_random_uuid(),
  venue_id bigint not null references public.venues(id) on delete cascade,
  image_url text not null,
  sort_order integer default 0,
  created_at timestamptz default now()
);

create index if not exists venue_photos_venue_id_idx on public.venue_photos (venue_id);

alter table public.venue_photos enable row level security;

drop policy if exists "Public can read venue photos" on public.venue_photos;
drop policy if exists "Business owners can insert own venue photos" on public.venue_photos;
drop policy if exists "Business owners can update own venue photos" on public.venue_photos;
drop policy if exists "Business owners can delete own venue photos" on public.venue_photos;

create policy "Public can read venue photos"
on public.venue_photos for select using (true);

create policy "Business owners can insert own venue photos"
on public.venue_photos for insert
with check (
  exists (
    select 1 from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_photos.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') in ('approved', 'active', 'verified')
  )
);

create policy "Business owners can update own venue photos"
on public.venue_photos for update
using (
  exists (
    select 1 from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_photos.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') in ('approved', 'active', 'verified')
  )
)
with check (
  exists (
    select 1 from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_photos.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') in ('approved', 'active', 'verified')
  )
);

create policy "Business owners can delete own venue photos"
on public.venue_photos for delete
using (
  exists (
    select 1 from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_photos.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') in ('approved', 'active', 'verified')
  )
);

comment on table public.venue_photos is 'Multi-image venue gallery (venue_images alias).';
