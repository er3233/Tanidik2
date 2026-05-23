create table if not exists public.message_conversation_reads (
  conversation_id uuid not null references public.message_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (conversation_id, user_id)
);

create index if not exists message_conversation_reads_user_id_idx
on public.message_conversation_reads (user_id);

create index if not exists message_conversation_reads_conversation_id_idx
on public.message_conversation_reads (conversation_id);

alter table public.message_conversation_reads enable row level security;

drop policy if exists "Conversation participants can read own read state"
on public.message_conversation_reads;

drop policy if exists "Conversation participants can insert own read state"
on public.message_conversation_reads;

drop policy if exists "Conversation participants can update own read state"
on public.message_conversation_reads;

drop policy if exists "Conversation participants can delete own read state"
on public.message_conversation_reads;

create policy "Conversation participants can read own read state"
on public.message_conversation_reads
for select
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.message_conversations c
    where c.id = message_conversation_reads.conversation_id
      and (
        c.user_id = auth.uid()
        or c.business_owner_id = auth.uid()
      )
  )
);

create policy "Conversation participants can insert own read state"
on public.message_conversation_reads
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.message_conversations c
    where c.id = message_conversation_reads.conversation_id
      and (
        c.user_id = auth.uid()
        or c.business_owner_id = auth.uid()
      )
  )
);

create policy "Conversation participants can update own read state"
on public.message_conversation_reads
for update
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.message_conversations c
    where c.id = message_conversation_reads.conversation_id
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
    where c.id = message_conversation_reads.conversation_id
      and (
        c.user_id = auth.uid()
        or c.business_owner_id = auth.uid()
      )
  )
);

create policy "Conversation participants can delete own read state"
on public.message_conversation_reads
for delete
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.message_conversations c
    where c.id = message_conversation_reads.conversation_id
      and (
        c.user_id = auth.uid()
        or c.business_owner_id = auth.uid()
      )
  )
);
