-- Repair public.message_conversations CHECK constraints so reservation and
-- direct user-to-user conversations are both valid.
--
-- Run this in Supabase SQL Editor. The first SELECT shows the exact live
-- constraint names and old logic before the repair.

select
  con.conname as constraint_name,
  pg_get_constraintdef(con.oid) as constraint_definition
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace nsp on nsp.oid = rel.relnamespace
where nsp.nspname = 'public'
  and rel.relname = 'message_conversations'
  and con.contype = 'c'
order by con.conname;

alter table public.message_conversations
drop constraint if exists message_conversations_context_check;

do $$
declare
  v_constraint record;
  v_definition text;
begin
  for v_constraint in
    select
      con.conname,
      pg_get_constraintdef(con.oid) as definition
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'message_conversations'
      and con.contype = 'c'
  loop
    v_definition := lower(v_constraint.definition);

    -- Drop legacy reservation-only checks that block direct conversations:
    --   reservation_id is not null
    --   venue_id is not null
    --   conversation_type limited to reservation-only values
    --
    -- Keep unrelated checks intact.
    if (
      v_definition like '%conversation_type%'
      and v_definition not like '%direct%'
    ) or (
      v_definition like '%reservation_id%'
      and v_definition like '%is not null%'
      and v_definition not like '%conversation_type%'
    ) or (
      v_definition like '%venue_id%'
      and v_definition like '%is not null%'
      and v_definition not like '%conversation_type%'
    ) then
      raise notice
        'Dropping direct-message-incompatible CHECK constraint %. Old logic: %',
        v_constraint.conname,
        v_constraint.definition;

      execute format(
        'alter table public.message_conversations drop constraint if exists %I',
        v_constraint.conname
      );
    end if;
  end loop;
end;
$$;

-- New context rule:
-- - reservation conversations keep requiring reservation and venue context
-- - direct conversations intentionally have no reservation/venue context
-- - direct conversations require the existing participant columns used by app.js
alter table public.message_conversations
add constraint message_conversations_context_check
check (
  (
    conversation_type = 'reservation'
    and reservation_id is not null
    and venue_id is not null
  )
  or
  (
    conversation_type = 'direct'
    and reservation_id is null
    and venue_id is null
    and user_id is not null
    and business_owner_id is not null
    and participant_one_id is not null
    and participant_two_id is not null
    and user_id <> business_owner_id
    and participant_one_id <> participant_two_id
    and participant_one_id = least(user_id, business_owner_id)
    and participant_two_id = greatest(user_id, business_owner_id)
  )
) not valid;

do $$
begin
  begin
    alter table public.message_conversations
    validate constraint message_conversations_context_check;
  exception
    when check_violation then
      raise warning
        'message_conversations_context_check was added NOT VALID but existing rows need cleanup before validation.';
  end;
end;
$$;

select
  con.conname as constraint_name,
  pg_get_constraintdef(con.oid) as constraint_definition
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace nsp on nsp.oid = rel.relnamespace
where nsp.nspname = 'public'
  and rel.relname = 'message_conversations'
  and con.contype = 'c'
order by con.conname;
