create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  conversation_id uuid not null references public.message_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  file_url text not null,
  file_type text,
  file_name text,
  created_at timestamptz default now()
);

create index if not exists message_attachments_conversation_id_idx
  on public.message_attachments (conversation_id);

create index if not exists message_attachments_message_id_idx
  on public.message_attachments (message_id);

create index if not exists message_attachments_sender_id_idx
  on public.message_attachments (sender_id);

alter table public.message_attachments enable row level security;

drop policy if exists "Conversation participants can read attachments"
  on public.message_attachments;

drop policy if exists "Conversation participants can insert own attachments"
  on public.message_attachments;

create policy "Conversation participants can read attachments"
  on public.message_attachments
  for select
  using (
    exists (
      select 1
      from public.message_conversations c
      where c.id = message_attachments.conversation_id
        and (
          c.user_id = auth.uid()
          or c.business_owner_id = auth.uid()
        )
    )
  );

create policy "Conversation participants can insert own attachments"
  on public.message_attachments
  for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.message_conversations c
      where c.id = message_attachments.conversation_id
        and (
          c.user_id = auth.uid()
          or c.business_owner_id = auth.uid()
        )
    )
  );
