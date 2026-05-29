-- Admin kurye kaydı düzeltmesi (rerunnable)
-- Sorun: eski 5-param admin_upsert_courier + email davet satırı çakışması

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
  v_auth_email text;
begin
  if not public.is_admin_user() then
    raise exception 'Admin access required';
  end if;

  if trim(coalesce(p_full_name, '')) = '' then
    raise exception 'Full name required';
  end if;

  if p_user_id is not null then
    select lower(trim(u.email)) into v_auth_email
    from auth.users u
    where u.id = p_user_id;

    if v_email = '' and v_auth_email is not null then
      v_email := v_auth_email;
    end if;
  end if;

  if v_email = '' then
    raise exception 'Email required';
  end if;

  -- Existing row by user_id
  select * into v_courier
  from public.couriers
  where user_id = p_user_id
  limit 1;

  if found then
    update public.couriers
    set full_name = trim(p_full_name),
        phone = nullif(trim(p_phone), ''),
        vehicle_type = nullif(trim(p_vehicle_type), ''),
        status = coalesce(p_status, 'active'),
        email = coalesce(v_email, email),
        updated_at = now()
    where id = v_courier.id
    returning * into v_courier;

    return v_courier;
  end if;

  -- Merge invite row (same email, user_id null)
  select * into v_courier
  from public.couriers
  where lower(trim(email)) = v_email
  order by created_at desc
  limit 1;

  if found then
    update public.couriers
    set user_id = coalesce(p_user_id, user_id),
        full_name = trim(p_full_name),
        phone = nullif(trim(p_phone), ''),
        vehicle_type = nullif(trim(p_vehicle_type), ''),
        status = coalesce(p_status, 'active'),
        email = v_email,
        updated_at = now()
    where id = v_courier.id
    returning * into v_courier;

    return v_courier;
  end if;

  insert into public.couriers (
    user_id,
    full_name,
    phone,
    vehicle_type,
    status,
    email
  )
  values (
    p_user_id,
    trim(p_full_name),
    nullif(trim(p_phone), ''),
    nullif(trim(p_vehicle_type), ''),
    coalesce(p_status, 'active'),
    v_email
  )
  returning * into v_courier;

  return v_courier;
end;
$$;

grant execute on function public.admin_upsert_courier(uuid, text, text, text, text, text) to authenticated;

-- Admin listesi: auth.users joinu olmadan (RLS 401 önleme)
drop policy if exists "Couriers read own profile" on public.couriers;

create policy "Couriers read own profile"
on public.couriers for select
using (
  user_id = auth.uid()
  or (
    email is not null
    and lower(trim(email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  )
  or public.is_admin_user()
);
