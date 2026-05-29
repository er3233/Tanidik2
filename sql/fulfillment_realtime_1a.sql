-- Phase 1A: Supabase Realtime for orders + deliveries (idempotent)
-- Run after tanidik_fulfillment_golden.sql on staging and production.

do $$
begin
  alter publication supabase_realtime add table public.orders;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.deliveries;
exception
  when duplicate_object then null;
end $$;

alter table public.orders replica identity full;
alter table public.deliveries replica identity full;

insert into public.schema_migrations (id, notes)
values (
  'fulfillment_realtime_1a',
  'Realtime publication for orders and deliveries'
)
on conflict (id) do update
set applied_at = now(),
    notes = excluded.notes;
