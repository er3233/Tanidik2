create or replace function public.create_notification(
  target_user_id uuid,
  type text,
  title text,
  message text default '',
  link_url text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Login required'
      using errcode = '28000';
  end if;

  if target_user_id is null then
    return;
  end if;

  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    link_url,
    is_read,
    created_at
  )
  values (
    target_user_id,
    coalesce(type, ''),
    coalesce(title, ''),
    coalesce(message, ''),
    coalesce(link_url, ''),
    false,
    now()
  );
end;
$$;

revoke all on function public.create_notification(
  uuid,
  text,
  text,
  text,
  text
) from public;

grant execute on function public.create_notification(
  uuid,
  text,
  text,
  text,
  text
) to authenticated;
