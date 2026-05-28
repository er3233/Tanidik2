-- TANIDIK reservation messaging MVP.
-- Rerunnable: creates the base messaging tables when missing, repairs the
-- reservation conversation RPC, and locks conversations/messages to participants.

create extension if not exists pgcrypto;

create table if not exists public.message_conversations (
  id uuid primary key default gen_random_uuid(),
  conversation_type text not null default 'reservation',
  reservation_id bigint references public.reservations(id) on delete cascade,
  venue_id bigint references public.venues(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  business_owner_id uuid references auth.users(id) on delete cascade,
  participant_one_id uuid references auth.users(id) on delete cascade,
  participant_two_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.message_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.message_conversations
add column if not exists conversation_type text not null default 'reservation';

alter table public.message_conversations
add column if not exists reservation_id bigint references public.reservations(id) on delete cascade;

alter table public.message_conversations
add column if not exists venue_id bigint references public.venues(id) on delete cascade;

alter table public.message_conversations
add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.message_conversations
add column if not exists business_owner_id uuid references auth.users(id) on delete cascade;

alter table public.message_conversations
add column if not exists participant_one_id uuid references auth.users(id) on delete cascade;

alter table public.message_conversations
add column if not exists participant_two_id uuid references auth.users(id) on delete cascade;

alter table public.message_conversations
add column if not exists created_at timestamptz not null default now();

alter table public.message_conversations
add column if not exists updated_at timestamptz not null default now();

alter table public.messages
add column if not exists conversation_id uuid references public.message_conversations(id) on delete cascade;

alter table public.messages
add column if not exists sender_id uuid references auth.users(id) on delete cascade;

alter table public.messages
add column if not exists body text;

alter table public.messages
add column if not exists created_at timestamptz not null default now();

alter table public.message_conversations
alter column reservation_id drop not null;

alter table public.message_conversations
alter column venue_id drop not null;

update public.message_conversations
set conversation_type = 'reservation'
where conversation_type is null;

update public.message_conversations
set
  participant_one_id = least(user_id, business_owner_id),
  participant_two_id = greatest(user_id, business_owner_id)
where user_id is not null
  and business_owner_id is not null
  and (
    participant_one_id is null
    or participant_two_id is null
  );

create index if not exists message_conversations_user_id_idx
on public.message_conversations (user_id);

create index if not exists message_conversations_business_owner_id_idx
on public.message_conversations (business_owner_id);

create index if not exists message_conversations_reservation_id_idx
on public.message_conversations (reservation_id);

create index if not exists messages_conversation_id_created_at_idx
on public.messages (conversation_id, created_at);

create index if not exists messages_sender_id_idx
on public.messages (sender_id);

drop index if exists public.message_conversations_reservation_unique_idx;

create unique index message_conversations_reservation_unique_idx
on public.message_conversations (reservation_id)
where conversation_type = 'reservation'
  and reservation_id is not null;

alter table public.message_conversations
drop constraint if exists message_conversations_context_check;

alter table public.message_conversations
add constraint message_conversations_context_check
check (
  (
    conversation_type = 'reservation'
    and reservation_id is not null
    and venue_id is not null
    and user_id is not null
    and business_owner_id is not null
  )
  or
  (
    conversation_type = 'direct'
    and reservation_id is null
    and venue_id is null
    and user_id is not null
    and business_owner_id is not null
    and user_id <> business_owner_id
    and participant_one_id = least(user_id, business_owner_id)
    and participant_two_id = greatest(user_id, business_owner_id)
  )
) not valid;

alter table public.message_conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Conversation participants can read conversations"
on public.message_conversations;

drop policy if exists "Conversation participants can insert direct conversations"
on public.message_conversations;

drop policy if exists "Conversation participants can update conversations"
on public.message_conversations;

drop policy if exists "Conversation participants can read messages"
on public.messages;

drop policy if exists "Conversation participants can insert own messages"
on public.messages;

create policy "Conversation participants can read conversations"
on public.message_conversations
for select
using (
  auth.uid() in (
    user_id,
    business_owner_id,
    participant_one_id,
    participant_two_id
  )
);

create policy "Conversation participants can insert direct conversations"
on public.message_conversations
for insert
with check (
  conversation_type = 'direct'
  and auth.uid() in (user_id, business_owner_id)
  and business_owner_id is not null
  and user_id is not null
  and user_id <> business_owner_id
  and participant_one_id = least(user_id, business_owner_id)
  and participant_two_id = greatest(user_id, business_owner_id)
  and reservation_id is null
  and venue_id is null
);

create policy "Conversation participants can read messages"
on public.messages
for select
using (
  exists (
    select 1
    from public.message_conversations c
    where c.id = messages.conversation_id
      and auth.uid() in (
        c.user_id,
        c.business_owner_id,
        c.participant_one_id,
        c.participant_two_id
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
      and auth.uid() in (
        c.user_id,
        c.business_owner_id,
        c.participant_one_id,
        c.participant_two_id
      )
  )
);

grant select, insert on public.message_conversations to authenticated;
grant select, insert on public.messages to authenticated;

create or replace function public.touch_message_conversation_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.message_conversations
  set updated_at = greatest(now(), coalesce(updated_at, now()))
  where id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists touch_message_conversation_updated_at
on public.messages;

create trigger touch_message_conversation_updated_at
after insert on public.messages
for each row
execute function public.touch_message_conversation_updated_at();

drop function if exists public.get_or_create_reservation_conversation(bigint);

create function public.get_or_create_reservation_conversation(
  p_reservation_id bigint
)
returns table (
  conversation_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_user_id uuid := auth.uid();
  v_reservation public.reservations%rowtype;
  v_business_owner_id uuid;
  v_conversation_id uuid;
begin
  if v_current_user_id is null then
    raise exception 'Login required'
      using errcode = '28000';
  end if;

  if p_reservation_id is null then
    raise exception 'Reservation is required'
      using errcode = '22023';
  end if;

  select r.*
  into v_reservation
  from public.reservations r
  where r.id = p_reservation_id;

  if not found then
    raise exception 'Reservation not found'
      using errcode = '42501';
  end if;

  select b.owner_id
  into v_business_owner_id
  from public.venues v
  join public.businesses b on b.id = v.business_id
  where v.id = v_reservation.venue_id
  limit 1;

  if v_business_owner_id is null then
    raise exception 'Business owner not found'
      using errcode = '42501';
  end if;

  if v_current_user_id <> v_reservation.user_id
    and v_current_user_id <> v_business_owner_id then
    raise exception 'Conversation access denied'
      using errcode = '42501';
  end if;

  select id
  into v_conversation_id
  from public.message_conversations
  where conversation_type = 'reservation'
    and reservation_id = p_reservation_id
  limit 1;

  if v_conversation_id is null then
    begin
      insert into public.message_conversations (
        conversation_type,
        reservation_id,
        venue_id,
        user_id,
        business_owner_id,
        participant_one_id,
        participant_two_id,
        created_at,
        updated_at
      )
      values (
        'reservation',
        v_reservation.id,
        v_reservation.venue_id,
        v_reservation.user_id,
        v_business_owner_id,
        least(v_reservation.user_id, v_business_owner_id),
        greatest(v_reservation.user_id, v_business_owner_id),
        now(),
        now()
      )
      returning id into v_conversation_id;
    exception
      when unique_violation then
        select id
        into v_conversation_id
        from public.message_conversations
        where conversation_type = 'reservation'
          and reservation_id = p_reservation_id
        limit 1;
    end;
  end if;

  if v_conversation_id is null then
    raise exception 'Reservation conversation could not be created';
  end if;

  conversation_id := v_conversation_id;
  return next;
end;
$$;

revoke all on function public.get_or_create_reservation_conversation(bigint)
from public;

grant execute on function public.get_or_create_reservation_conversation(bigint)
to authenticated;
