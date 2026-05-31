-- Venue store product options / attributes (run in Supabase SQL Editor)
-- Adds JSON columns for category-based product customization.

alter table public.venue_products
  add column if not exists attributes jsonb not null default '{}'::jsonb,
  add column if not exists options jsonb not null default '[]'::jsonb;

comment on column public.venue_products.attributes is
  'Business-defined template id + default/custom values: {"template":"pizza","values":{...}}';

comment on column public.venue_products.options is
  'Customer-facing option schema snapshot: [{key,label,type,choices,required}, ...]';

alter table public.store_order_items
  add column if not exists selected_options jsonb not null default '{}'::jsonb;

comment on column public.store_order_items.selected_options is
  'Customer selections at checkout: {"size":"Orta",...}';
