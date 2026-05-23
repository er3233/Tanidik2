alter table public.message_conversations
add column if not exists conversation_type text not null default 'reservation';

alter table public.message_conversations
alter column reservation_id drop not null;

alter table public.message_conversations
alter column venue_id drop not null;

update public.message_conversations
set conversation_type = 'reservation'
where conversation_type is null;

create unique index if not exists message_conversations_direct_pair_idx
on public.message_conversations (
  least(user_id, business_owner_id),
  greatest(user_id, business_owner_id)
)
where conversation_type = 'direct'
  and user_id is not null
  and business_owner_id is not null;

alter table public.message_conversations enable row level security;

drop policy if exists "Conversation participants can read conversations"
on public.message_conversations;

drop policy if exists "Conversation participants can insert direct conversations"
on public.message_conversations;

drop policy if exists "Conversation participants can update conversations"
on public.message_conversations;

create policy "Conversation participants can read conversations"
on public.message_conversations
for select
using (
  user_id = auth.uid()
  or business_owner_id = auth.uid()
);

create policy "Conversation participants can insert direct conversations"
on public.message_conversations
for insert
with check (
  conversation_type = 'direct'
  and user_id = auth.uid()
  and business_owner_id is not null
  and business_owner_id <> auth.uid()
  and reservation_id is null
  and venue_id is null
);

alter table public.messages enable row level security;

drop policy if exists "Conversation participants can read messages"
on public.messages;

drop policy if exists "Conversation participants can insert own messages"
on public.messages;

create policy "Conversation participants can read messages"
on public.messages
for select
using (
  exists (
    select 1
    from public.message_conversations c
    where c.id = messages.conversation_id
      and (
        c.user_id = auth.uid()
        or c.business_owner_id = auth.uid()
      )
  )
);

create policy "Conversation participants can insert own messages"
on public.messages
for insert
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.message_conversations c
    where c.id = messages.conversation_id
      and (
        c.user_id = auth.uid()
        or c.business_owner_id = auth.uid()
      )
  )
);

drop function if exists public.get_or_create_direct_conversation(uuid);

create function public.get_or_create_direct_conversation(
  p_target_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_user_id uuid := auth.uid();
  v_conversation_id uuid;
begin
  if v_current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_target_user_id is null then
    raise exception 'Target user is required';
  end if;

  if p_target_user_id = v_current_user_id then
    raise exception 'Cannot start a conversation with yourself';
  end if;

  select id
  into v_conversation_id
  from public.message_conversations
  where conversation_type = 'direct'
    and least(user_id, business_owner_id) =
      least(v_current_user_id, p_target_user_id)
    and greatest(user_id, business_owner_id) =
      greatest(v_current_user_id, p_target_user_id)
  limit 1;

  if v_conversation_id is not null then
    return v_conversation_id;
  end if;

  insert into public.message_conversations (
    conversation_type,
    user_id,
    business_owner_id,
    reservation_id,
    venue_id,
    created_at,
    updated_at
  )
  values (
    'direct',
    v_current_user_id,
    p_target_user_id,
    null,
    null,
    now(),
    now()
  )
  returning id into v_conversation_id;

  return v_conversation_id;
end;
$$;

grant execute on function public.get_or_create_direct_conversation(uuid)
to authenticated;
