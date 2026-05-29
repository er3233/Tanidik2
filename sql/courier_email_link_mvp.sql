-- Courier email matching + auto user_id link (run in Supabase SQL Editor)
-- Enables: admin adds courier by email before/after signup; courier panel auto-links on login

alter table public.couriers
  add column if not exists email text;

-- Allow pre-signup courier rows (linked on first courier login)
alter table public.couriers
  alter column user_id drop not null;

create unique index if not exists couriers_email_lower_uidx
  on public.couriers (lower(trim(email)))
  where email is not null and trim(email) <> '';

-- ---------------------------------------------------------------------------
-- Courier session: match by user_id, then email, auto-link user_id
-- ---------------------------------------------------------------------------
drop function if exists public.resolve_my_active_courier();

create or replace function public.resolve_my_active_courier()
returns public.couriers
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_courier public.couriers%rowtype;
  v_uid uuid := auth.uid();
  v_session_email text;
begin
  if v_uid is null then
    raise exception 'Login required' using errcode = '28000';
  end if;

  -- A) user_id + active
  select * into v_courier
  from public.couriers
  where user_id = v_uid
    and status = 'active'
  limit 1;

  if found then
    return v_courier;
  end if;

  select lower(trim(u.email)) into v_session_email
  from auth.users u
  where u.id = v_uid;

  if v_session_email is null or v_session_email = '' then
    return null;
  end if;

  -- B) email + active
  select * into v_courier
  from public.couriers
  where lower(trim(email)) = v_session_email
    and status = 'active'
  order by created_at desc
  limit 1;

  if not found then
    return null;
  end if;

  if v_courier.user_id is null then
    update public.couriers
    set user_id = v_uid,
        email = coalesce(nullif(trim(email), ''), v_session_email),
        updated_at = now()
    where id = v_courier.id
    returning * into v_courier;

    return v_courier;
  end if;

  if v_courier.user_id <> v_uid then
    raise exception 'Courier email is linked to another account' using errcode = '42501';
  end if;

  return v_courier;
end;
$$;

revoke all on function public.resolve_my_active_courier() from public;
grant execute on function public.resolve_my_active_courier() to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: upsert courier (with email; user_id optional for invite-before-signup)
-- ---------------------------------------------------------------------------
drop function if exists public.admin_upsert_courier(uuid, text, text, text, text);
drop function if exists public.admin_upsert_courier(uuid, text, text, text, text, text);

create or replace function public.admin_upsert_courier(
  p_user_id uuid default null,
  p_full_name text default null,
  p_phone text default null,
  p_vehicle_type text default null,
  p_status text default 'active',
  p_email text default null
)
returns public.couriers
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_courier public.couriers%rowtype;
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if not public.is_admin_user() then
    raise exception 'Admin access required';
  end if;

  if p_user_id is not null then
    insert into public.couriers (user_id, full_name, phone, vehicle_type, status, email)
    values (
      p_user_id,
      trim(p_full_name),
      nullif(trim(p_phone), ''),
      nullif(trim(p_vehicle_type), ''),
      coalesce(p_status, 'active'),
      nullif(v_email, '')
    )
    on conflict (user_id) do update
    set full_name = excluded.full_name,
        phone = excluded.phone,
        vehicle_type = excluded.vehicle_type,
        status = excluded.status,
        email = coalesce(excluded.email, public.couriers.email),
        updated_at = now()
    returning * into v_courier;

    return v_courier;
  end if;

  if v_email = '' then
    raise exception 'Email required when user_id is not set';
  end if;

  select * into v_courier
  from public.couriers
  where lower(trim(email)) = v_email
  limit 1;

  if found then
    update public.couriers
    set full_name = trim(p_full_name),
        phone = nullif(trim(p_phone), ''),
        vehicle_type = nullif(trim(p_vehicle_type), ''),
        status = coalesce(p_status, 'active'),
        updated_at = now()
    where id = v_courier.id
    returning * into v_courier;
  else
    insert into public.couriers (user_id, full_name, phone, vehicle_type, status, email)
    values (
      null,
      trim(p_full_name),
      nullif(trim(p_phone), ''),
      nullif(trim(p_vehicle_type), ''),
      coalesce(p_status, 'active'),
      v_email
    )
    returning * into v_courier;
  end if;

  return v_courier;
end;
$$;

grant execute on function public.admin_upsert_courier(uuid, text, text, text, text, text) to authenticated;
