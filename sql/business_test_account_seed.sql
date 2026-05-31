-- =============================================================================
-- business@test.com restaurant ordering seed (idempotent)
-- =============================================================================
-- Purpose:
-- - Create a separate test business + venue owned by business@test.com.
-- - Seed the minimum restaurant menu data needed for end-to-end food order tests.
-- - Do not modify venue id 1 or delete production data.
--
-- Run manually in Supabase SQL Editor. Do not run from the app.
-- =============================================================================

do $$
declare
  v_expected_owner_id uuid := 'fc8d5f99-8d3f-4438-8f53-0e4caa3feeda';
  v_owner_id uuid;
  v_business_id public.businesses.id%type;
  v_venue_id public.venues.id%type;
  v_menu_id uuid;
  v_item_id uuid;

  v_business_name text := 'TANIDIK Test Restaurant Business';
  v_venue_name text := 'TANIDIK Test Restaurant';
  v_menu_name text := 'Test Ana Menu';
  v_item_name text := 'Test Lahmacun';

  v_cols text[];
  v_vals text[];
  v_sets text[];
begin
  select u.id
    into v_owner_id
  from auth.users u
  where u.id = v_expected_owner_id
    and lower(u.email) = 'business@test.com'
  limit 1;

  if v_owner_id is null then
    raise exception
      'business@test.com user not found with expected id %. Stop: no seed data was changed.',
      v_expected_owner_id;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'businesses'
      and column_name = 'owner_id'
  ) then
    raise exception 'public.businesses.owner_id column is required.';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'businesses'
      and column_name = 'name'
  ) then
    execute
      'select id from public.businesses where owner_id = $1 and name = $2 order by id limit 1'
      using v_owner_id, v_business_name
      into v_business_id;
  else
    execute
      'select id from public.businesses where owner_id = $1 order by id limit 1'
      using v_owner_id
      into v_business_id;
  end if;

  if v_business_id is null then
    v_cols := array['owner_id'];
    v_vals := array[quote_literal(v_owner_id)];

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'businesses' and column_name = 'name'
    ) then
      v_cols := array_append(v_cols, 'name');
      v_vals := array_append(v_vals, quote_literal(v_business_name));
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'businesses' and column_name = 'business_name'
    ) then
      v_cols := array_append(v_cols, 'business_name');
      v_vals := array_append(v_vals, quote_literal(v_business_name));
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'businesses' and column_name = 'status'
    ) then
      v_cols := array_append(v_cols, 'status');
      v_vals := array_append(v_vals, quote_literal('approved'));
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'businesses' and column_name = 'phone'
    ) then
      v_cols := array_append(v_cols, 'phone');
      v_vals := array_append(v_vals, quote_literal('+905555000001'));
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'businesses' and column_name = 'address'
    ) then
      v_cols := array_append(v_cols, 'address');
      v_vals := array_append(v_vals, quote_literal('TANIDIK test address'));
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'businesses' and column_name = 'description'
    ) then
      v_cols := array_append(v_cols, 'description');
      v_vals := array_append(v_vals, quote_literal('Test business for restaurant order E2E validation.'));
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'businesses' and column_name = 'rejection_reason'
    ) then
      v_cols := array_append(v_cols, 'rejection_reason');
      v_vals := array_append(v_vals, quote_literal(''));
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'businesses' and column_name = 'created_at'
    ) then
      v_cols := array_append(v_cols, 'created_at');
      v_vals := array_append(v_vals, 'now()');
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'businesses' and column_name = 'updated_at'
    ) then
      v_cols := array_append(v_cols, 'updated_at');
      v_vals := array_append(v_vals, 'now()');
    end if;

    execute format(
      'insert into public.businesses (%s) values (%s) returning id',
      array_to_string(v_cols, ', '),
      array_to_string(v_vals, ', ')
    )
    into v_business_id;
  else
    v_sets := array[]::text[];

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'businesses' and column_name = 'status'
    ) then
      v_sets := array_append(v_sets, format('%I = %L', 'status', 'approved'));
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'businesses' and column_name = 'business_name'
    ) then
      v_sets := array_append(v_sets, format('%I = %L', 'business_name', v_business_name));
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'businesses' and column_name = 'updated_at'
    ) then
      v_sets := array_append(v_sets, 'updated_at = now()');
    end if;

    if array_length(v_sets, 1) > 0 then
      execute format(
        'update public.businesses set %s where id = %L',
        array_to_string(v_sets, ', '),
        v_business_id
      );
    end if;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'venues'
      and column_name = 'business_id'
  ) then
    raise exception 'public.venues.business_id column is required.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'venues'
      and column_name = 'name'
  ) then
    raise exception 'public.venues.name column is required.';
  end if;

  execute
    'select id from public.venues where business_id = $1 and name = $2 order by id limit 1'
    using v_business_id, v_venue_name
    into v_venue_id;

  if v_venue_id is null then
    v_cols := array['business_id', 'name'];
    v_vals := array[quote_literal(v_business_id), quote_literal(v_venue_name)];

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'venues' and column_name = 'category'
    ) then
      v_cols := array_append(v_cols, 'category');
      v_vals := array_append(v_vals, quote_literal('restaurant'));
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'venues' and column_name = 'city'
    ) then
      v_cols := array_append(v_cols, 'city');
      v_vals := array_append(v_vals, quote_literal('Istanbul'));
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'venues' and column_name = 'address'
    ) then
      v_cols := array_append(v_cols, 'address');
      v_vals := array_append(v_vals, quote_literal('TANIDIK test venue address'));
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'venues' and column_name = 'description'
    ) then
      v_cols := array_append(v_cols, 'description');
      v_vals := array_append(v_vals, quote_literal('Separate test venue for business@test.com restaurant orders.'));
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'venues' and column_name = 'image'
    ) then
      v_cols := array_append(v_cols, 'image');
      v_vals := array_append(v_vals, quote_literal('https://placehold.co/600x400/111111/FFFFFF?text=TANIDIK+TEST'));
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'venues' and column_name = 'latitude'
    ) then
      v_cols := array_append(v_cols, 'latitude');
      v_vals := array_append(v_vals, 'null');
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'venues' and column_name = 'longitude'
    ) then
      v_cols := array_append(v_cols, 'longitude');
      v_vals := array_append(v_vals, 'null');
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'venues' and column_name = 'status'
    ) then
      v_cols := array_append(v_cols, 'status');
      v_vals := array_append(v_vals, quote_literal('approved'));
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'venues' and column_name = 'accepts_reservations'
    ) then
      v_cols := array_append(v_cols, 'accepts_reservations');
      v_vals := array_append(v_vals, 'false');
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'venues' and column_name = 'created_at'
    ) then
      v_cols := array_append(v_cols, 'created_at');
      v_vals := array_append(v_vals, 'now()');
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'venues' and column_name = 'updated_at'
    ) then
      v_cols := array_append(v_cols, 'updated_at');
      v_vals := array_append(v_vals, 'now()');
    end if;

    execute format(
      'insert into public.venues (%s) values (%s) returning id',
      array_to_string(v_cols, ', '),
      array_to_string(v_vals, ', ')
    )
    into v_venue_id;
  else
    if v_venue_id = 1 then
      raise exception 'Refusing to update venue id 1. Rename the existing venue or choose a different test venue name.';
    end if;

    v_sets := array[format('%I = %L', 'business_id', v_business_id)];

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'venues' and column_name = 'category'
    ) then
      v_sets := array_append(v_sets, format('%I = %L', 'category', 'restaurant'));
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'venues' and column_name = 'updated_at'
    ) then
      v_sets := array_append(v_sets, 'updated_at = now()');
    end if;

    execute format(
      'update public.venues set %s where id = %L and id <> 1',
      array_to_string(v_sets, ', '),
      v_venue_id
    );
  end if;

  select id
    into v_menu_id
  from public.restaurant_menus
  where venue_id = v_venue_id
  order by created_at
  limit 1;

  if v_menu_id is null then
    insert into public.restaurant_menus (
      venue_id,
      name,
      description,
      is_active,
      created_at,
      updated_at
    )
    values (
      v_venue_id,
      v_menu_name,
      'Minimum menu for business@test.com order tests.',
      true,
      now(),
      now()
    )
    returning id into v_menu_id;
  else
    update public.restaurant_menus
      set name = v_menu_name,
          description = 'Minimum menu for business@test.com order tests.',
          is_active = true,
          updated_at = now()
    where id = v_menu_id;
  end if;

  select id
    into v_item_id
  from public.menu_items
  where menu_id = v_menu_id
    and name = v_item_name
  order by created_at
  limit 1;

  if v_item_id is null then
    insert into public.menu_items (
      menu_id,
      name,
      description,
      category,
      price,
      image_url,
      is_available,
      sort_order,
      created_at,
      updated_at
    )
    values (
      v_menu_id,
      v_item_name,
      'Test menu item for restaurant order flow.',
      'Test',
      11.00,
      '',
      true,
      10,
      now(),
      now()
    )
    returning id into v_item_id;
  else
    update public.menu_items
      set description = 'Test menu item for restaurant order flow.',
          category = 'Test',
          price = 11.00,
          image_url = '',
          is_available = true,
          sort_order = 10,
          updated_at = now()
    where id = v_item_id;
  end if;

  raise notice
    'business@test.com seed ready. owner_id=%, business_id=%, venue_id=%, menu_id=%, menu_item_id=%',
    v_owner_id,
    v_business_id,
    v_venue_id,
    v_menu_id,
    v_item_id;
end $$;
