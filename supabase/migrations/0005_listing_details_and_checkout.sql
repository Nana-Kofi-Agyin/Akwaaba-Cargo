-- Add batch logistics, delivery option, max qty per order, and photo gallery to listings;
-- add separate MoMo phone, delivery selection, and terms acceptance to orders.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'shipping_method') then
    create type public.shipping_method as enum ('air', 'sea');
  end if;
  if not exists (select 1 from pg_type where typname = 'delivery_method') then
    create type public.delivery_method as enum ('pickup', 'delivery');
  end if;
end $$;

alter table public.listings
  add column if not exists shipping_method public.shipping_method,
  add column if not exists estimated_arrival text,
  add column if not exists pickup_location text,
  add column if not exists delivery_fee_pesewas integer check (delivery_fee_pesewas is null or delivery_fee_pesewas >= 0),
  add column if not exists max_qty_per_order integer check (max_qty_per_order is null or max_qty_per_order >= 1),
  add column if not exists gallery_urls text[] not null default '{}';

alter table public.orders
  add column if not exists momo_phone text,
  add column if not exists delivery_method public.delivery_method not null default 'pickup',
  add column if not exists delivery_fee_pesewas integer not null default 0 check (delivery_fee_pesewas >= 0),
  add column if not exists terms_accepted boolean not null default false;

notify pgrst, 'reload schema';
