-- Premium chat state support for message read receipts and typing indicators.
-- Rerunnable and additive: keeps existing message_conversation_reads rows.

drop policy if exists "Conversation participants can read own read state"
on public.message_conversation_reads;

drop policy if exists "Conversation participants can read read states"
on public.message_conversation_reads;

create policy "Conversation participants can read read states"
on public.message_conversation_reads
for select
using (
  exists (
    select 1
    from public.message_conversations c
    where c.id = message_conversation_reads.conversation_id
      and (
        c.user_id = auth.uid()
        or c.business_owner_id = auth.uid()
      )
  )
);

drop function if exists public.mark_conversation_read(uuid);

create or replace function public.mark_conversation_read(
  p_conversation_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.message_conversations c
    where c.id = p_conversation_id
      and (
        c.user_id = v_user_id
        or c.business_owner_id = v_user_id
      )
  ) then
    raise exception 'Conversation unavailable';
  end if;

  insert into public.message_conversation_reads (
    conversation_id,
    user_id,
    last_read_at,
    updated_at
  )
  values (
    p_conversation_id,
    v_user_id,
    now(),
    now()
  )
  on conflict (conversation_id, user_id)
  do update set
    last_read_at = excluded.last_read_at,
    updated_at = excluded.updated_at;
end;
$$;

grant execute on function public.mark_conversation_read(uuid)
to authenticated;

drop function if exists public.get_conversation_read_state(uuid);

create or replace function public.get_conversation_read_state(
  p_conversation_id uuid
)
returns table (
  user_id uuid,
  last_read_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.message_conversations c
    where c.id = p_conversation_id
      and (
        c.user_id = v_user_id
        or c.business_owner_id = v_user_id
      )
  ) then
    raise exception 'Conversation unavailable';
  end if;

  return query
  select r.user_id, r.last_read_at
  from public.message_conversation_reads r
  where r.conversation_id = p_conversation_id;
end;
$$;

grant execute on function public.get_conversation_read_state(uuid)
to authenticated;

create table if not exists public.conversation_typing_states (
  conversation_id uuid not null references public.message_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  is_typing boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists conversation_typing_states_conversation_idx
on public.conversation_typing_states (conversation_id, updated_at);

alter table public.conversation_typing_states enable row level security;

drop policy if exists "Conversation participants can read typing states"
on public.conversation_typing_states;

drop policy if exists "Conversation participants can insert own typing state"
on public.conversation_typing_states;

drop policy if exists "Conversation participants can update own typing state"
on public.conversation_typing_states;

drop policy if exists "Conversation participants can delete own typing state"
on public.conversation_typing_states;

create policy "Conversation participants can read typing states"
on public.conversation_typing_states
for select
using (
  exists (
    select 1
    from public.message_conversations c
    where c.id = conversation_typing_states.conversation_id
      and (
        c.user_id = auth.uid()
        or c.business_owner_id = auth.uid()
      )
  )
);

create policy "Conversation participants can insert own typing state"
on public.conversation_typing_states
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.message_conversations c
    where c.id = conversation_typing_states.conversation_id
      and (
        c.user_id = auth.uid()
        or c.business_owner_id = auth.uid()
      )
  )
);

create policy "Conversation participants can update own typing state"
on public.conversation_typing_states
for update
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.message_conversations c
    where c.id = conversation_typing_states.conversation_id
      and (
        c.user_id = auth.uid()
        or c.business_owner_id = auth.uid()
      )
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.message_conversations c
    where c.id = conversation_typing_states.conversation_id
      and (
        c.user_id = auth.uid()
        or c.business_owner_id = auth.uid()
      )
  )
);

create policy "Conversation participants can delete own typing state"
on public.conversation_typing_states
for delete
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.message_conversations c
    where c.id = conversation_typing_states.conversation_id
      and (
        c.user_id = auth.uid()
        or c.business_owner_id = auth.uid()
      )
  )
);
