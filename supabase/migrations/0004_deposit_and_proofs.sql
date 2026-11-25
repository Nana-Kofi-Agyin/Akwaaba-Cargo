-- Add optional full landed price (for deposit-now + balance-on-pickup breakdown)
-- and optional proof image URL on status_updates (for tracking timeline proof photos).

alter table public.listings
  add column if not exists full_price_pesewas integer
  check (full_price_pesewas is null or full_price_pesewas >= price_pesewas);

alter table public.status_updates
  add column if not exists proof_image_url text;
