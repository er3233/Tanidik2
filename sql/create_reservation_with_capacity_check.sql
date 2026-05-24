drop function if exists public.create_reservation_with_capacity_check(
  bigint,
  date,
  time,
  integer,
  text
);

create function public.create_reservation_with_capacity_check(
  p_venue_id bigint,
  p_reservation_date date,
  p_reservation_time time,
  p_party_size integer,
  p_note text default null
)
returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_hours public.venue_operating_hours%rowtype;
  v_rules public.venue_booking_rules%rowtype;
  v_reservation public.reservations%rowtype;
  v_slot_minutes integer;
  v_max_reservations integer;
  v_max_guests integer;
  v_allow_multiple boolean;
  v_status text;
  v_start_at timestamp;
  v_end_at timestamp;
  v_requested_at timestamp;
  v_existing_reservations integer;
  v_existing_guests integer;
begin
  if v_user_id is null then
    raise exception 'Login required'
      using errcode = '28000';
  end if;

  if p_venue_id is null
    or p_reservation_date is null
    or p_reservation_time is null then
    raise exception 'Reservation date and time are required'
      using errcode = '22023';
  end if;

  if coalesce(p_party_size, 0) < 1 or p_party_size > 20 then
    raise exception 'Party size must be between 1 and 20'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.venues v
    where v.id = p_venue_id
  ) then
    raise exception 'Venue not found'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.venue_blackout_dates bd
    where bd.venue_id = p_venue_id
      and bd.blackout_date = p_reservation_date
  ) then
    raise exception 'This venue is unavailable on the selected date'
      using errcode = '22023';
  end if;

  select *
  into v_hours
  from public.venue_operating_hours oh
  where oh.venue_id = p_venue_id
    and oh.day_of_week = extract(dow from p_reservation_date)::integer
  limit 1;

  if not found
    or coalesce(v_hours.is_closed, false)
    or v_hours.opens_at is null
    or v_hours.closes_at is null then
    raise exception 'This venue is closed on the selected date'
      using errcode = '22023';
  end if;

  select *
  into v_rules
  from public.venue_booking_rules br
  where br.venue_id = p_venue_id
  limit 1;

  v_slot_minutes := greatest(coalesce(v_rules.slot_minutes, 60), 1);
  v_allow_multiple := coalesce(v_rules.allow_multiple_reservations, true);
  v_max_reservations :=
    case
      when v_allow_multiple then
        greatest(coalesce(v_rules.max_reservations_per_slot, 10), 1)
      else 1
    end;
  v_max_guests := v_rules.max_guests_per_slot;
  v_status :=
    case
      when coalesce(v_rules.auto_approve, false) then 'approved'
      else 'pending'
    end;

  v_start_at := p_reservation_date::timestamp + v_hours.opens_at;
  v_end_at := p_reservation_date::timestamp + v_hours.closes_at;
  v_requested_at := p_reservation_date::timestamp + p_reservation_time;

  if v_end_at <= v_start_at then
    v_end_at := v_end_at + interval '1 day';

    if p_reservation_time < v_hours.opens_at then
      v_requested_at := v_requested_at + interval '1 day';
    end if;
  end if;

  if v_requested_at < v_start_at
    or v_requested_at >= v_end_at then
    raise exception 'Reservation time is outside operating hours'
      using errcode = '22023';
  end if;

  if mod(
    floor(extract(epoch from (v_requested_at - v_start_at)) / 60)::integer,
    v_slot_minutes
  ) <> 0 then
    raise exception 'Reservation time is not an available slot'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      concat_ws(
        ':',
        'reservation_slot',
        p_venue_id::text,
        p_reservation_date::text,
        p_reservation_time::text
      ),
      0
    )
  );

  select
    count(*)::integer,
    coalesce(sum(coalesce(r.party_size, 0)), 0)::integer
  into v_existing_reservations, v_existing_guests
  from public.reservations r
  where r.venue_id = p_venue_id
    and r.reservation_date = p_reservation_date
    and r.reservation_time::time = p_reservation_time
    and coalesce(lower(r.status), '') not in (
      'cancelled',
      'canceled',
      'rejected'
    );

  if v_existing_reservations >= v_max_reservations then
    raise exception 'This reservation slot is full'
      using errcode = '23514';
  end if;

  if not v_allow_multiple and v_existing_reservations > 0 then
    raise exception 'This reservation slot is full'
      using errcode = '23514';
  end if;

  if v_max_guests is not null
    and v_existing_guests + p_party_size > v_max_guests then
    raise exception 'This reservation slot does not have enough guest capacity'
      using errcode = '23514';
  end if;

  insert into public.reservations (
    venue_id,
    user_id,
    reservation_date,
    reservation_time,
    party_size,
    note,
    status
  )
  values (
    p_venue_id,
    v_user_id,
    p_reservation_date,
    p_reservation_time,
    p_party_size,
    nullif(trim(coalesce(p_note, '')), ''),
    v_status
  )
  returning *
  into v_reservation;

  return v_reservation;
end;
$$;

revoke all on function public.create_reservation_with_capacity_check(
  bigint,
  date,
  time,
  integer,
  text
) from public;

grant execute on function public.create_reservation_with_capacity_check(
  bigint,
  date,
  time,
  integer,
  text
) to authenticated;
