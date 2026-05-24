-- Safe authenticated user lookup for direct messaging.
-- Uses public profile fields for partial name/username search and auth.users
-- only for exact email matches. It does not expose auth.users email values.

drop function if exists public.search_message_users(text);

create or replace function public.search_message_users(
  p_query text
)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  match_label text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_user_id uuid := auth.uid();
  v_query text := btrim(coalesce(p_query, ''));
  v_like_query text;
  v_has_profiles boolean := false;
  v_id_column text;
  v_name_expression text;
  v_username_expression text;
  v_avatar_expression text;
  v_sql text;
begin
  if v_current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if length(v_query) < 3 then
    return;
  end if;

  v_like_query := '%' || replace(replace(v_query, '\', '\\'), '%', '\%') || '%';
  v_like_query := replace(v_like_query, '_', '\_');

  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'profiles'
  )
  into v_has_profiles;

  if v_has_profiles then
    select case
      when exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'profiles'
          and column_name = 'user_id'
          and data_type = 'uuid'
      ) then 'user_id'
      when exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'profiles'
          and column_name = 'id'
          and data_type = 'uuid'
      ) then 'id'
      else null
    end
    into v_id_column;

    if v_id_column is not null then
      select concat_ws(
        ', ',
        case when exists (
          select 1 from information_schema.columns
          where table_schema = 'public'
            and table_name = 'profiles'
            and column_name = 'full_name'
        ) then 'nullif(p.full_name, '''')' end,
        case when exists (
          select 1 from information_schema.columns
          where table_schema = 'public'
            and table_name = 'profiles'
            and column_name = 'display_name'
        ) then 'nullif(p.display_name, '''')' end,
        case when exists (
          select 1 from information_schema.columns
          where table_schema = 'public'
            and table_name = 'profiles'
            and column_name = 'name'
        ) then 'nullif(p.name, '''')' end,
        case when exists (
          select 1 from information_schema.columns
          where table_schema = 'public'
            and table_name = 'profiles'
            and column_name = 'username'
        ) then 'nullif(p.username, '''')' end
      )
      into v_name_expression;

      select case when exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'profiles'
          and column_name = 'username'
      ) then 'p.username' else 'null::text' end
      into v_username_expression;

      select concat_ws(
        ', ',
        case when exists (
          select 1 from information_schema.columns
          where table_schema = 'public'
            and table_name = 'profiles'
            and column_name = 'avatar_url'
        ) then 'nullif(p.avatar_url, '''')' end,
        case when exists (
          select 1 from information_schema.columns
          where table_schema = 'public'
            and table_name = 'profiles'
            and column_name = 'avatar'
        ) then 'nullif(p.avatar, '''')' end,
        case when exists (
          select 1 from information_schema.columns
          where table_schema = 'public'
            and table_name = 'profiles'
            and column_name = 'image'
        ) then 'nullif(p.image, '''')' end,
        case when exists (
          select 1 from information_schema.columns
          where table_schema = 'public'
            and table_name = 'profiles'
            and column_name = 'photo_url'
        ) then 'nullif(p.photo_url, '''')' end
      )
      into v_avatar_expression;

      v_name_expression := coalesce(nullif(v_name_expression, ''), '''User''');
      v_avatar_expression := coalesce(nullif(v_avatar_expression, ''), 'null::text');

      v_sql := format(
        'select distinct on (p.%1$I::uuid)
          p.%1$I::uuid as user_id,
          coalesce(%2$s, ''User'')::text as display_name,
          coalesce(%3$s, null::text)::text as avatar_url,
          case
            when %4$s ilike $1 escape ''\'' then ''Username match''
            else ''Profile match''
          end::text as match_label
        from public.profiles p
        where p.%1$I is not null
          and p.%1$I::uuid <> $2
          and (
            coalesce(%2$s, '''') ilike $1 escape ''\''
            or coalesce(%4$s, '''') ilike $1 escape ''\''
          )
        order by p.%1$I::uuid, display_name
        limit 12',
        v_id_column,
        v_name_expression,
        v_avatar_expression,
        v_username_expression
      );

      return query execute v_sql using v_like_query, v_current_user_id;
    end if;
  end if;

  return query
  select
    u.id as user_id,
    coalesce(
      u.raw_user_meta_data ->> 'full_name',
      u.raw_user_meta_data ->> 'name',
      u.raw_user_meta_data ->> 'username',
      'User'
    )::text as display_name,
    coalesce(
      u.raw_user_meta_data ->> 'avatar_url',
      u.raw_user_meta_data ->> 'avatar',
      u.raw_user_meta_data ->> 'picture'
    )::text as avatar_url,
    'Email match'::text as match_label
  from auth.users u
  where u.id <> v_current_user_id
    and lower(u.email) = lower(v_query)
  limit 1;
end;
$$;

revoke all on function public.search_message_users(text)
from public;

grant execute on function public.search_message_users(text)
to authenticated;
