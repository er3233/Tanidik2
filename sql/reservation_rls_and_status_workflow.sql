-- Production reservation access control and status workflow.
-- Run after the base reservations, venues, and businesses tables exist.

alter table public.reservations enable row level security;

create index if not exists reservations_user_id_idx
on public.reservations (user_id);

create index if not exists reservations_venue_date_time_idx
on public.reservations (venue_id, reservation_date, reservation_time);

create index if not exists reservations_status_idx
on public.reservations (status);

drop policy if exists "Users can read own reservations"
on public.reservations;

drop policy if exists "Business owners can read venue reservations"
on public.reservations;

drop policy if exists "Users can insert own reservations"
on public.reservations;

drop policy if exists "Users can cancel own pending reservations"
on public.reservations;

drop policy if exists "Business owners can update pending reservation status"
on public.reservations;

create policy "Users can read own reservations"
on public.reservations
for select
using (user_id = auth.uid());

create policy "Business owners can read venue reservations"
on public.reservations
for select
using (
  exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = reservations.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') in ('approved', 'active', 'verified')
  )
);

create policy "Users can insert own reservations"
on public.reservations
for insert
with check (
  user_id = auth.uid()
  and coalesce(lower(status), 'pending') in ('pending', 'approved')
);

create policy "Users can cancel own pending reservations"
on public.reservations
for update
using (
  user_id = auth.uid()
  and coalesce(lower(status), '') = 'pending'
)
with check (
  user_id = auth.uid()
  and coalesce(lower(status), '') in ('cancelled', 'canceled')
);

create policy "Business owners can update pending reservation status"
on public.reservations
for update
using (
  coalesce(lower(status), '') = 'pending'
  and exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = reservations.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') in ('approved', 'active', 'verified')
  )
)
with check (
  coalesce(lower(status), '') in ('approved', 'rejected')
  and exists (
    select 1
    from public.venues v
    join public.businesses b on b.id = v.business_id
    where v.id = reservations.venue_id
      and b.owner_id = auth.uid()
      and coalesce(b.status, '') in ('approved', 'active', 'verified')
  )
);

revoke update on public.reservations from anon, authenticated;
grant select, insert on public.reservations to authenticated;
grant update (status) on public.reservations to authenticated;

drop function if exists public.cancel_pending_reservation(bigint);

create function public.cancel_pending_reservation(
  reservation_id bigint
)
returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.reservations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Login required'
      using errcode = '28000';
  end if;

  update public.reservations r
  set status = 'cancelled'
  where r.id = cancel_pending_reservation.reservation_id
    and r.user_id = auth.uid()
    and coalesce(lower(r.status), '') = 'pending'
  returning *
  into v_reservation;

  if not found then
    raise exception 'Reservation not found or not pending'
      using errcode = '42501';
  end if;

  return v_reservation;
end;
$$;

revoke all on function public.cancel_pending_reservation(bigint)
from public;

grant execute on function public.cancel_pending_reservation(bigint)
to authenticated;

drop function if exists public.update_business_reservation_status(bigint, text);

create function public.update_business_reservation_status(
  reservation_id bigint,
  new_status text
)
returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text := lower(trim(coalesce(new_status, '')));
  v_reservation public.reservations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Login required'
      using errcode = '28000';
  end if;

  if v_status not in ('approved', 'rejected') then
    raise exception 'Invalid reservation status'
      using errcode = '22023';
  end if;

  update public.reservations r
  set status = v_status
  where r.id = update_business_reservation_status.reservation_id
    and coalesce(lower(r.status), '') = 'pending'
    and exists (
      select 1
      from public.venues v
      join public.businesses b on b.id = v.business_id
      where v.id = r.venue_id
        and b.owner_id = auth.uid()
        and coalesce(b.status, '') in ('approved', 'active', 'verified')
    )
  returning *
  into v_reservation;

  if not found then
    raise exception 'Reservation not found, not pending, or not owned by this business'
      using errcode = '42501';
  end if;

  return v_reservation;
end;
$$;

revoke all on function public.update_business_reservation_status(bigint, text)
from public;

grant execute on function public.update_business_reservation_status(bigint, text)
to authenticated;
