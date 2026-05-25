alter table if exists public.notifications
add column if not exists metadata jsonb not null default '{}'::jsonb;

create or replace function public.create_store_order_notification(
  target_user_id uuid,
  notification_type text,
  notification_title text,
  notification_message text default '',
  notification_link_url text default '',
  notification_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_table boolean;
  v_has_id boolean;
  v_type_column text;
  v_has_title boolean;
  v_has_message boolean;
  v_has_link_url boolean;
  v_has_metadata boolean;
  v_columns text[] := array['user_id'];
  v_values text[] := array['$1'];
  v_id uuid;
begin
  if target_user_id is null then
    return null;
  end if;

  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'notifications'
  ) into v_has_table;

  if not v_has_table then
    return null;
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notifications'
      and column_name = 'id'
  ) into v_has_id;

  select column_name into v_type_column
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'notifications'
    and column_name in ('notification_type', 'type')
  order by case column_name
    when 'notification_type' then 1
    when 'type' then 2
    else 3
  end
  limit 1;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notifications'
      and column_name = 'title'
  ) into v_has_title;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notifications'
      and column_name = 'message'
  ) into v_has_message;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notifications'
      and column_name = 'link_url'
  ) into v_has_link_url;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notifications'
      and column_name = 'metadata'
  ) into v_has_metadata;

  if v_type_column is not null then
    v_columns := array_append(v_columns, format('%I', v_type_column));
    v_values := array_append(v_values, '$2');
  end if;

  if v_has_title then
    v_columns := array_append(v_columns, 'title');
    v_values := array_append(v_values, '$3');
  end if;

  if v_has_message then
    v_columns := array_append(v_columns, 'message');
    v_values := array_append(v_values, '$4');
  end if;

  if v_has_link_url then
    v_columns := array_append(v_columns, 'link_url');
    v_values := array_append(v_values, '$5');
  end if;

  if v_has_metadata then
    v_columns := array_append(v_columns, 'metadata');
    v_values := array_append(v_values, '$6');
  end if;

  if v_has_id then
    execute format(
      'insert into public.notifications (%s) values (%s) returning id',
      array_to_string(v_columns, ', '),
      array_to_string(v_values, ', ')
    )
    using
      target_user_id,
      notification_type,
      notification_title,
      notification_message,
      notification_link_url,
      coalesce(notification_metadata, '{}'::jsonb)
    into v_id;

    return v_id;
  end if;

  execute format(
    'insert into public.notifications (%s) values (%s)',
    array_to_string(v_columns, ', '),
    array_to_string(v_values, ', ')
  )
  using
    target_user_id,
    notification_type,
    notification_title,
    notification_message,
    notification_link_url,
    coalesce(notification_metadata, '{}'::jsonb);

  return null;
end;
$$;

grant execute on function public.create_store_order_notification(
  uuid,
  text,
  text,
  text,
  text,
  jsonb
) to authenticated;

create or replace function public.decrement_store_product_stock(
  p_product_id uuid,
  p_quantity integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock_field text;
  v_quantity integer := greatest(coalesce(p_quantity, 0), 0);
begin
  if p_product_id is null or v_quantity <= 0 then
    return;
  end if;

  select column_name into v_stock_field
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'venue_products'
    and column_name in ('stock_quantity', 'stock', 'inventory', 'quantity')
  order by case column_name
    when 'stock_quantity' then 1
    when 'stock' then 2
    when 'inventory' then 3
    when 'quantity' then 4
    else 5
  end
  limit 1;

  if v_stock_field is null then
    return;
  end if;

  execute format(
    'update public.venue_products
     set %I = greatest(coalesce(%I, 0) - $1, 0)
     where id = $2
       and %I is not null',
    v_stock_field,
    v_stock_field,
    v_stock_field
  )
  using v_quantity, p_product_id;
end;
$$;

grant execute on function public.decrement_store_product_stock(
  uuid,
  integer
) to authenticated;
