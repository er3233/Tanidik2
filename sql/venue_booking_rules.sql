create table if not exists public.venue_operating_hours (
  id uuid primary key default gen_random_uuid(),
  venue_id bigint not null references public.venues(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  opens_at time,
  closes_at time,
  is_closed boolean default false,
  created_at timestamptz default now(),
  unique (venue_id, day_of_week)
);

create table if not exists public.venue_booking_rules (
  id uuid primary key default gen_random_uuid(),
  venue_id bigint not null references public.venues(id) on delete cascade,
  slot_minutes integer default 60,
  max_reservations_per_slot integer default 10,
  max_guests_per_slot integer,
  allow_multiple_reservations boolean default true,
  auto_approve boolean default false,
  min_notice_minutes integer default 60,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (venue_id),
  check (slot_minutes > 0),
  check (max_reservations_per_slot > 0),
  check (max_guests_per_slot is null or max_guests_per_slot > 0),
  check (min_notice_minutes >= 0)
);

create table if not exists public.venue_blackout_dates (
  id uuid primary key default gen_random_uuid(),
  venue_id bigint not null references public.venues(id) on delete cascade,
  blackout_date date not null,
  reason text,
  created_at timestamptz default now(),
  unique (venue_id, blackout_date)
);

create index if not exists venue_operating_hours_venue_id_idx
on public.venue_operating_hours (venue_id);

create index if not exists venue_booking_rules_venue_id_idx
on public.venue_booking_rules (venue_id);

create index if not exists venue_blackout_dates_venue_id_idx
on public.venue_blackout_dates (venue_id);

create index if not exists venue_blackout_dates_venue_date_idx
on public.venue_blackout_dates (venue_id, blackout_date);

alter table public.venue_operating_hours enable row level security;
alter table public.venue_booking_rules enable row level security;
alter table public.venue_blackout_dates enable row level security;

drop policy if exists "Public can read venue operating hours"
on public.venue_operating_hours;

drop policy if exists "Business owners can insert own venue operating hours"
on public.venue_operating_hours;

drop policy if exists "Business owners can update own venue operating hours"
on public.venue_operating_hours;

drop policy if exists "Business owners can delete own venue operating hours"
on public.venue_operating_hours;

drop policy if exists "Public can read venue booking rules"
on public.venue_booking_rules;

drop policy if exists "Business owners can insert own venue booking rules"
on public.venue_booking_rules;

drop policy if exists "Business owners can update own venue booking rules"
on public.venue_booking_rules;

drop policy if exists "Business owners can delete own venue booking rules"
on public.venue_booking_rules;

drop policy if exists "Public can read venue blackout dates"
on public.venue_blackout_dates;

drop policy if exists "Business owners can insert own venue blackout dates"
on public.venue_blackout_dates;

drop policy if exists "Business owners can update own venue blackout dates"
on public.venue_blackout_dates;

drop policy if exists "Business owners can delete own venue blackout dates"
on public.venue_blackout_dates;

create policy "Public can read venue operating hours"
on public.venue_operating_hours
for select
using (true);

create policy "Business owners can insert own venue operating hours"
on public.venue_operating_hours
for insert
with check (
  exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_operating_hours.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
);

create policy "Business owners can update own venue operating hours"
on public.venue_operating_hours
for update
using (
  exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_operating_hours.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
)
with check (
  exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_operating_hours.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
);

create policy "Business owners can delete own venue operating hours"
on public.venue_operating_hours
for delete
using (
  exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_operating_hours.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
);

create policy "Public can read venue booking rules"
on public.venue_booking_rules
for select
using (true);

create policy "Business owners can insert own venue booking rules"
on public.venue_booking_rules
for insert
with check (
  exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_booking_rules.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
);

create policy "Business owners can update own venue booking rules"
on public.venue_booking_rules
for update
using (
  exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_booking_rules.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
)
with check (
  exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_booking_rules.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
);

create policy "Business owners can delete own venue booking rules"
on public.venue_booking_rules
for delete
using (
  exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_booking_rules.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
);

create policy "Public can read venue blackout dates"
on public.venue_blackout_dates
for select
using (true);

create policy "Business owners can insert own venue blackout dates"
on public.venue_blackout_dates
for insert
with check (
  exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_blackout_dates.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
);

create policy "Business owners can update own venue blackout dates"
on public.venue_blackout_dates
for update
using (
  exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_blackout_dates.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
)
with check (
  exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_blackout_dates.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
);

create policy "Business owners can delete own venue blackout dates"
on public.venue_blackout_dates
for delete
using (
  exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = venue_blackout_dates.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') = 'approved'
  )
);

create or replace function public.set_venue_booking_rules_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_venue_booking_rules_updated_at
on public.venue_booking_rules;

create trigger set_venue_booking_rules_updated_at
before update on public.venue_booking_rules
for each row
execute function public.set_venue_booking_rules_updated_at();

drop function if exists public.get_venue_available_slots(bigint, date);

create function public.get_venue_available_slots(
  p_venue_id bigint,
  p_date date
)
returns table (
  slot_time time,
  reservation_count integer,
  guest_count integer,
  max_reservations integer,
  max_guests integer,
  is_available boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hours public.venue_operating_hours%rowtype;
  v_rules public.venue_booking_rules%rowtype;
  v_slot_minutes integer;
  v_max_reservations integer;
  v_max_guests integer;
  v_min_notice_minutes integer;
  v_allow_multiple boolean;
  v_start_at timestamp;
  v_end_at timestamp;
  v_interval interval;
begin
  if p_venue_id is null or p_date is null then
    return;
  end if;

  if exists (
    select 1
    from public.venue_blackout_dates bd
    where bd.venue_id = p_venue_id
      and bd.blackout_date = p_date
  ) then
    return;
  end if;

  select *
  into v_hours
  from public.venue_operating_hours oh
  where oh.venue_id = p_venue_id
    and oh.day_of_week = extract(dow from p_date)::integer
  limit 1;

  if not found
    or coalesce(v_hours.is_closed, false)
    or v_hours.opens_at is null
    or v_hours.closes_at is null then
    return;
  end if;

  select *
  into v_rules
  from public.venue_booking_rules br
  where br.venue_id = p_venue_id
  limit 1;

  v_slot_minutes := greatest(coalesce(v_rules.slot_minutes, 60), 1);
  v_max_reservations :=
    case
      when coalesce(v_rules.allow_multiple_reservations, true) then
        greatest(coalesce(v_rules.max_reservations_per_slot, 10), 1)
      else 1
    end;
  v_max_guests := v_rules.max_guests_per_slot;
  v_min_notice_minutes :=
    greatest(coalesce(v_rules.min_notice_minutes, 0), 0);
  v_allow_multiple := coalesce(v_rules.allow_multiple_reservations, true);
  v_interval := make_interval(mins => v_slot_minutes);
  v_start_at := p_date::timestamp + v_hours.opens_at;
  v_end_at := p_date::timestamp + v_hours.closes_at;

  if v_end_at <= v_start_at then
    v_end_at := v_end_at + interval '1 day';
  end if;

  return query
  with slots as (
    select generate_series(
      v_start_at,
      v_end_at - v_interval,
      v_interval
    ) as slot_at
  ),
  reservation_counts as (
    select
      r.reservation_time::time as booked_time,
      count(*)::integer as booked_reservations,
      coalesce(sum(coalesce(r.party_size, 0)), 0)::integer as booked_guests
    from public.reservations r
    where r.venue_id = p_venue_id
      and r.reservation_date = p_date
      and coalesce(lower(r.status), '') not in (
        'cancelled',
        'canceled',
        'rejected'
      )
    group by r.reservation_time::time
  )
  select
    s.slot_at::time as slot_time,
    coalesce(rc.booked_reservations, 0)::integer as reservation_count,
    coalesce(rc.booked_guests, 0)::integer as guest_count,
    v_max_reservations::integer as max_reservations,
    v_max_guests::integer as max_guests,
    (
      coalesce(rc.booked_reservations, 0) < v_max_reservations
      and (
        v_max_guests is null
        or coalesce(rc.booked_guests, 0) < v_max_guests
      )
      and (
        v_allow_multiple
        or coalesce(rc.booked_reservations, 0) = 0
      )
    )::boolean as is_available
  from slots s
  left join reservation_counts rc
    on rc.booked_time = s.slot_at::time
  where s.slot_at >= localtimestamp + make_interval(mins => v_min_notice_minutes)
  order by s.slot_at;
end;
$$;

grant execute on function public.get_venue_available_slots(bigint, date)
to anon, authenticated;
