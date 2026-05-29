-- Courier Operations Pack v1 (idempotent)
-- Run after tanidik_fulfillment_golden.sql

begin;

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
alter table public.couriers
  add column if not exists is_on_duty boolean not null default false;

alter table public.couriers
  add column if not exists duty_started_at timestamptz;

create table if not exists public.courier_shifts (
  id uuid primary key default gen_random_uuid(),
  courier_id uuid not null references public.couriers(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists courier_shifts_courier_started_idx
  on public.courier_shifts (courier_id, started_at desc);

alter table public.deliveries
  add column if not exists completion_note_category text;

alter table public.deliveries
  add column if not exists completion_note_detail text;

-- ---------------------------------------------------------------------------
-- Shift RPCs
-- ---------------------------------------------------------------------------
drop function if exists public.start_courier_shift();

create or replace function public.start_courier_shift()
returns public.couriers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_courier public.couriers%rowtype;
  v_shift public.courier_shifts%rowtype;
begin
  select * into v_courier from public.resolve_my_active_courier();
  if v_courier.id is null then
    raise exception 'Active courier account required';
  end if;

  if v_courier.is_on_duty then
    return v_courier;
  end if;

  update public.courier_shifts
  set ended_at = coalesce(ended_at, now())
  where courier_id = v_courier.id
    and ended_at is null;

  insert into public.courier_shifts (courier_id, started_at)
  values (v_courier.id, now())
  returning * into v_shift;

  update public.couriers
  set is_on_duty = true,
      duty_started_at = v_shift.started_at,
      updated_at = now()
  where id = v_courier.id
  returning * into v_courier;

  return v_courier;
end;
$$;

drop function if exists public.end_courier_shift();

create or replace function public.end_courier_shift()
returns public.couriers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_courier public.couriers%rowtype;
begin
  select * into v_courier from public.resolve_my_active_courier();
  if v_courier.id is null then
    raise exception 'Active courier account required';
  end if;

  update public.courier_shifts
  set ended_at = now()
  where courier_id = v_courier.id
    and ended_at is null;

  update public.couriers
  set is_on_duty = false,
      duty_started_at = null,
      updated_at = now()
  where id = v_courier.id
  returning * into v_courier;

  return v_courier;
end;
$$;

grant execute on function public.start_courier_shift() to authenticated;
grant execute on function public.end_courier_shift() to authenticated;

-- ---------------------------------------------------------------------------
-- Courier ops summary (shift + performance + earnings counts)
-- ---------------------------------------------------------------------------
drop function if exists public.get_my_courier_ops_summary();

create or replace function public.get_my_courier_ops_summary()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_courier public.couriers%rowtype;
  v_courier_id uuid;
  v_shift_started timestamptz;
  v_duration_minutes integer := 0;
  v_today_count integer := 0;
  v_week_count integer := 0;
  v_month_count integer := 0;
  v_total_count integer := 0;
  v_month_delivered integer := 0;
  v_avg_minutes numeric := 0;
  v_success_rate numeric := 0;
  v_active_delivery integer := 0;
  v_ops_status text := 'offline';
begin
  select * into v_courier from public.resolve_my_active_courier();
  if v_courier.id is null then
    raise exception 'Active courier account required';
  end if;

  v_courier_id := v_courier.id;
  v_shift_started := v_courier.duty_started_at;

  if v_courier.is_on_duty and v_shift_started is not null then
    v_duration_minutes := greatest(
      0,
      floor(extract(epoch from (now() - v_shift_started)) / 60)::integer
    );
  end if;

  select count(*) into v_today_count
  from public.deliveries d
  where d.courier_id = v_courier_id
    and d.status = 'delivered'
    and d.delivered_at >= date_trunc('day', now());

  select count(*) into v_week_count
  from public.deliveries d
  where d.courier_id = v_courier_id
    and d.status = 'delivered'
    and d.delivered_at >= date_trunc('week', now());

  select count(*) into v_month_count
  from public.deliveries d
  where d.courier_id = v_courier_id
    and d.status = 'delivered'
    and d.delivered_at >= date_trunc('month', now());

  select count(*) into v_total_count
  from public.deliveries d
  where d.courier_id = v_courier_id
    and d.status = 'delivered';

  v_month_delivered := v_month_count;

  select coalesce(
    round(avg(extract(epoch from (d.delivered_at - coalesce(d.assigned_at, d.picked_up_at, d.created_at))) / 60.0), 1),
    0
  )
  into v_avg_minutes
  from public.deliveries d
  where d.courier_id = v_courier_id
    and d.status = 'delivered'
    and d.delivered_at >= date_trunc('month', now())
    and d.delivered_at is not null;

  select case
    when count(*) = 0 then 0
    else round(
      100.0 * count(*) filter (where d.status = 'delivered')
      / nullif(count(*) filter (where d.status in ('delivered', 'cancelled')), 0),
      1
    )
  end
  into v_success_rate
  from public.deliveries d
  where d.courier_id = v_courier_id
    and d.delivered_at >= date_trunc('month', now());

  select count(*) into v_active_delivery
  from public.deliveries d
  where d.courier_id = v_courier_id
    and d.status in ('assigned', 'courier_assigned', 'picked_up', 'on_the_way');

  if not v_courier.is_on_duty then
    v_ops_status := 'offline';
  elsif v_active_delivery > 0 then
    v_ops_status := 'on_delivery';
  else
    v_ops_status := 'online';
  end if;

  return jsonb_build_object(
    'courier_id', v_courier_id,
    'is_on_duty', v_courier.is_on_duty,
    'ops_status', v_ops_status,
    'shift', jsonb_build_object(
      'started_at', v_shift_started,
      'duration_minutes', v_duration_minutes,
      'today_delivery_count', v_today_count
    ),
    'performance', jsonb_build_object(
      'total_deliveries', v_total_count,
      'month_deliveries', v_month_delivered,
      'avg_delivery_minutes', v_avg_minutes,
      'success_rate_percent', v_success_rate
    ),
    'earnings', jsonb_build_object(
      'today_deliveries', v_today_count,
      'week_deliveries', v_week_count,
      'month_deliveries', v_month_count,
      'currency', 'TRY',
      'payout_enabled', false
    )
  );
end;
$$;

grant execute on function public.get_my_courier_ops_summary() to authenticated;

-- ---------------------------------------------------------------------------
-- History by period
-- ---------------------------------------------------------------------------
drop function if exists public.get_courier_delivery_history_period(text);

create or replace function public.get_courier_delivery_history_period(p_period text default 'today')
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_courier_id uuid := public.get_my_courier_id();
  v_history jsonb := '[]'::jsonb;
  v_from timestamptz;
begin
  if v_courier_id is null then
    raise exception 'Active courier account required';
  end if;

  v_from := case lower(trim(coalesce(p_period, 'today')))
    when 'week' then date_trunc('week', now())
    when 'month' then date_trunc('month', now())
    else date_trunc('day', now())
  end;

  select coalesce(jsonb_agg(row_to_json(t) order by t.delivered_at desc), '[]'::jsonb)
  into v_history
  from (
    select
      d.id,
      d.status,
      d.delivered_at,
      d.assigned_at,
      d.picked_up_at,
      d.created_at,
      d.completion_note_category,
      d.completion_note_detail,
      d.notes,
      round(
        extract(epoch from (
          coalesce(d.delivered_at, d.updated_at)
          - coalesce(d.assigned_at, d.picked_up_at, d.created_at)
        )) / 60.0,
        1
      ) as delivery_duration_minutes,
      jsonb_build_object(
        'id', o.id,
        'status', o.status,
        'total_amount', o.total_amount,
        'delivery_address', o.delivery_address,
        'venues', jsonb_build_object(
          'name', v.name,
          'city', v.city,
          'address', v.address
        )
      ) as orders,
      o.user_id as customer_user_id
    from public.deliveries d
    join public.orders o on o.id = d.order_id
    left join public.venues v on v.id = o.venue_id
    where d.courier_id = v_courier_id
      and d.status in ('delivered', 'cancelled')
      and coalesce(d.delivered_at, d.updated_at) >= v_from
    order by coalesce(d.delivered_at, d.updated_at) desc
    limit 100
  ) t;

  return v_history;
end;
$$;

grant execute on function public.get_courier_delivery_history_period(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin ops board (badges + ranking + active shifts)
-- ---------------------------------------------------------------------------
drop function if exists public.get_admin_courier_ops_board();

create or replace function public.get_admin_courier_ops_board()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_couriers jsonb := '[]'::jsonb;
  v_shifts jsonb := '[]'::jsonb;
  v_ranking jsonb := '[]'::jsonb;
begin
  if not public.is_admin_user() then
    raise exception 'Admin access required';
  end if;

  select coalesce(jsonb_agg(row_to_json(t) order by t.ops_sort, t.full_name), '[]'::jsonb)
  into v_couriers
  from (
    select
      c.*,
      (
        select count(*)
        from public.deliveries d
        where d.courier_id = c.id
          and d.status = 'delivered'
          and d.delivered_at >= date_trunc('day', now())
      ) as today_deliveries,
      (
        select count(*)
        from public.deliveries d
        where d.courier_id = c.id
          and d.status = 'delivered'
          and d.delivered_at >= date_trunc('month', now())
      ) as month_deliveries,
      (
        select count(*)
        from public.deliveries d
        where d.courier_id = c.id
          and d.status in ('assigned', 'courier_assigned', 'picked_up', 'on_the_way')
      ) as active_deliveries,
      case
        when c.status <> 'active' then 'offline'
        when not coalesce(c.is_on_duty, false) then 'offline'
        when exists (
          select 1 from public.deliveries d
          where d.courier_id = c.id
            and d.status in ('assigned', 'courier_assigned', 'picked_up', 'on_the_way')
        ) then 'on_delivery'
        else 'online'
      end as ops_status,
      case
        when c.status <> 'active' then 3
        when not coalesce(c.is_on_duty, false) then 3
        when exists (
          select 1 from public.deliveries d
          where d.courier_id = c.id
            and d.status in ('assigned', 'courier_assigned', 'picked_up', 'on_the_way')
        ) then 1
        else 2
      end as ops_sort
    from public.couriers c
    where c.status = 'active'
  ) t;

  select coalesce(jsonb_agg(row_to_json(s) order by s.started_at desc), '[]'::jsonb)
  into v_shifts
  from (
    select
      cs.*,
      jsonb_build_object(
        'id', c.id,
        'full_name', c.full_name,
        'email', c.email,
        'ops_status', case
          when not coalesce(c.is_on_duty, false) then 'offline'
          when exists (
            select 1 from public.deliveries d
            where d.courier_id = c.id
              and d.status in ('assigned', 'courier_assigned', 'picked_up', 'on_the_way')
          ) then 'on_delivery'
          else 'online'
        end
      ) as courier
    from public.courier_shifts cs
    join public.couriers c on c.id = cs.courier_id
    where cs.ended_at is null
      and c.status = 'active'
  ) s;

  select coalesce(jsonb_agg(row_to_json(r) order by r.month_deliveries desc, r.avg_delivery_minutes asc), '[]'::jsonb)
  into v_ranking
  from (
    select
      c.id as courier_id,
      c.full_name,
      c.email,
      count(d.id) filter (where d.status = 'delivered' and d.delivered_at >= date_trunc('month', now())) as month_deliveries,
      coalesce(
        round(avg(extract(epoch from (d.delivered_at - coalesce(d.assigned_at, d.picked_up_at, d.created_at))) / 60.0)
          filter (where d.status = 'delivered' and d.delivered_at >= date_trunc('month', now())),
        1),
        0
      ) as avg_delivery_minutes
    from public.couriers c
    left join public.deliveries d on d.courier_id = c.id
    where c.status = 'active'
    group by c.id, c.full_name, c.email
  ) r;

  return jsonb_build_object(
    'couriers', v_couriers,
    'active_shifts', v_shifts,
    'performance_ranking', v_ranking
  );
end;
$$;

grant execute on function public.get_admin_courier_ops_board() to authenticated;

-- ---------------------------------------------------------------------------
-- Accept only when on duty
-- ---------------------------------------------------------------------------
create or replace function public.accept_courier_delivery(p_delivery_id uuid)
returns public.deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_courier_id uuid := public.get_my_courier_id();
  v_courier public.couriers%rowtype;
  v_delivery public.deliveries%rowtype;
  v_order public.orders%rowtype;
begin
  if v_courier_id is null then
    raise exception 'Active courier account required';
  end if;

  select * into v_courier from public.couriers where id = v_courier_id;
  if not coalesce(v_courier.is_on_duty, false) then
    raise exception 'Mesaiye başlamadan teslimat kabul edemezsiniz' using errcode = '42501';
  end if;

  select * into v_delivery
  from public.deliveries
  where id = p_delivery_id
  for update;

  if v_delivery.id is null then
    raise exception 'Delivery not found';
  end if;

  update public.deliveries
  set courier_id = v_courier_id,
      status = 'assigned',
      assigned_at = now(),
      updated_at = now()
  where id = p_delivery_id
    and status in ('available', 'open', 'pending')
    and courier_id is null
  returning * into v_delivery;

  if v_delivery.id is null then
    raise exception 'Delivery already claimed or unavailable' using errcode = '40001';
  end if;

  select * into v_order from public.orders where id = v_delivery.order_id for update;

  update public.orders
  set status = case
      when status in ('pending', 'accepted', 'preparing', 'ready_for_pickup') then 'courier_assigned'
      else status
    end,
    updated_at = now()
  where id = v_order.id;

  perform public.append_order_status_history(
    v_order.id, 'courier_assigned', 'Courier accepted delivery'
  );

  return v_delivery;
end;
$$;

-- ---------------------------------------------------------------------------
-- Status update with completion notes
-- ---------------------------------------------------------------------------
drop function if exists public.update_courier_delivery_status(uuid, text, text);

create or replace function public.update_courier_delivery_status(
  p_delivery_id uuid,
  p_new_status text,
  p_note text default null,
  p_completion_note_category text default null,
  p_completion_note_detail text default null
)
returns public.deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_courier_id uuid := public.get_my_courier_id();
  v_delivery public.deliveries%rowtype;
  v_order public.orders%rowtype;
  v_normalized text := lower(trim(p_new_status));
  v_next_order_status text;
begin
  if auth.uid() is null then
    raise exception 'Login required' using errcode = '28000';
  end if;

  select * into v_delivery from public.deliveries where id = p_delivery_id for update;
  if v_delivery.id is null then
    raise exception 'Delivery not found';
  end if;

  if not public.is_admin_user() then
    if v_courier_id is null or v_delivery.courier_id is distinct from v_courier_id then
      raise exception 'Not authorized';
    end if;
  end if;

  if v_normalized = 'picked_up' and v_delivery.status not in ('assigned', 'courier_assigned') then
    raise exception 'Invalid transition to picked_up';
  end if;

  if v_normalized = 'on_the_way' and v_delivery.status <> 'picked_up' then
    raise exception 'Invalid transition to on_the_way';
  end if;

  if v_normalized = 'delivered' and v_delivery.status <> 'on_the_way' then
    raise exception 'Invalid transition to delivered';
  end if;

  if v_normalized not in ('picked_up', 'on_the_way', 'delivered', 'cancelled') then
    raise exception 'Invalid delivery status';
  end if;

  update public.deliveries
  set status = v_normalized,
      picked_up_at = case when v_normalized = 'picked_up' then now() else picked_up_at end,
      delivered_at = case when v_normalized = 'delivered' then now() else delivered_at end,
      notes = coalesce(p_note, notes),
      completion_note_category = case
        when v_normalized = 'delivered' then nullif(trim(p_completion_note_category), '')
        else completion_note_category
      end,
      completion_note_detail = case
        when v_normalized = 'delivered' then nullif(trim(p_completion_note_detail), '')
        else completion_note_detail
      end,
      updated_at = now()
  where id = p_delivery_id
  returning * into v_delivery;

  select * into v_order from public.orders where id = v_delivery.order_id;

  v_next_order_status := case v_normalized
    when 'picked_up' then 'picked_up'
    when 'on_the_way' then 'on_the_way'
    when 'delivered' then 'delivered'
    else v_order.status
  end;

  if v_normalized in ('picked_up', 'on_the_way', 'delivered') then
    update public.orders
    set status = v_next_order_status, updated_at = now()
    where id = v_order.id;

    perform public.append_order_status_history(v_order.id, v_next_order_status, p_note);
  end if;

  return v_delivery;
end;
$$;

grant execute on function public.update_courier_delivery_status(uuid, text, text, text, text) to authenticated;

create or replace function public.update_delivery_status(
  p_delivery_id uuid,
  p_new_status text,
  p_note text default null
)
returns public.deliveries
language sql
security definer
set search_path = public
as $$
  select public.update_courier_delivery_status(
    p_delivery_id,
    p_new_status,
    p_note,
    null,
    null
  );
$$;

-- RLS courier_shifts
alter table public.courier_shifts enable row level security;

drop policy if exists "Couriers read own shifts" on public.courier_shifts;
drop policy if exists "Admins manage courier shifts" on public.courier_shifts;

create policy "Couriers read own shifts"
on public.courier_shifts for select
using (
  courier_id = public.get_my_courier_id()
  or public.is_admin_user()
);

create policy "Admins manage courier shifts"
on public.courier_shifts for all
using (public.is_admin_user())
with check (public.is_admin_user());

grant select on public.courier_shifts to authenticated;

insert into public.schema_migrations (id, notes)
values (
  'courier_operations_pack_v1',
  'Courier shift, ops summary, history periods, completion notes, on-duty accept gate'
)
on conflict (id) do update
set applied_at = now(),
    notes = excluded.notes;

commit;
