-- Akwaaba Cargo: Initial Schema & Row Level Security
-- Currency is stored in pesewas (1 GHS = 100 pesewas) to avoid floating-point rounding issues.

-- ============================================================================
-- 1. Enums
-- ============================================================================

create type public.listing_status as enum (
  'open',
  'closed',
  'ordered',
  'shipped',
  'arrived',
  'ready'
);

create type public.payment_status as enum (
  'pending',
  'paid',
  'failed'
);

-- ============================================================================
-- 2. Tables
-- ============================================================================

create table public.importers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  phone text not null,
  created_at timestamptz not null default now()
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  importer_id uuid not null references public.importers(id) on delete cascade,
  slug text not null unique,
  title text not null,
  description text,
  image_url text,
  price_pesewas integer not null check (price_pesewas > 0),
  min_qty integer not null default 1 check (min_qty > 0),
  deadline timestamptz not null,
  status public.listing_status not null default 'open',
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_name text not null,
  buyer_phone text not null,
  qty integer not null check (qty > 0),
  amount_pesewas integer not null check (amount_pesewas > 0),
  payment_status public.payment_status not null default 'pending',
  paystack_reference text not null unique,
  created_at timestamptz not null default now()
);

create table public.status_updates (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  status public.listing_status not null,
  note text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 3. Indexes
-- ============================================================================

create index idx_listings_importer_id on public.listings (importer_id);
create index idx_listings_status on public.listings (status);
create index idx_orders_listing_id on public.orders (listing_id);
create index idx_orders_payment_status on public.orders (payment_status);
create index idx_status_updates_listing_id on public.status_updates (listing_id, created_at desc);

-- ============================================================================
-- 4. Row Level Security (RLS)
-- ============================================================================

alter table public.importers enable row level security;
alter table public.listings enable row level security;
alter table public.orders enable row level security;
alter table public.status_updates enable row level security;

-- ---- importers ----
-- Importers can only read and write their own profile row.

create policy "importers_select_own"
  on public.importers
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "importers_insert_own"
  on public.importers
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "importers_update_own"
  on public.importers
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---- listings ----
-- Public (anon + authenticated) can read open listings only.
-- Importers can read all of their own listings (any status) and write only their own.

create policy "listings_select_public_open"
  on public.listings
  for select
  to anon, authenticated
  using (status = 'open');

create policy "listings_select_own"
  on public.listings
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.importers i
      where i.id = listings.importer_id
        and i.user_id = auth.uid()
    )
  );

create policy "listings_insert_own"
  on public.listings
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.importers i
      where i.id = listings.importer_id
        and i.user_id = auth.uid()
    )
  );

create policy "listings_update_own"
  on public.listings
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.importers i
      where i.id = listings.importer_id
        and i.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.importers i
      where i.id = listings.importer_id
        and i.user_id = auth.uid()
    )
  );

create policy "listings_delete_own"
  on public.listings
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.importers i
      where i.id = listings.importer_id
        and i.user_id = auth.uid()
    )
  );

-- ---- orders ----
-- No public access: buyer orders are created and updated server-side via the
-- service_role client (checkout API + Paystack webhook) so buyers cannot read
-- other buyers' phone numbers or spoof payment_status.
-- Importers can read and write orders only for their own listings.

create policy "orders_select_own"
  on public.orders
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.listings l
      join public.importers i on i.id = l.importer_id
      where l.id = orders.listing_id
        and i.user_id = auth.uid()
    )
  );

create policy "orders_insert_own"
  on public.orders
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.listings l
      join public.importers i on i.id = l.importer_id
      where l.id = orders.listing_id
        and i.user_id = auth.uid()
    )
  );

create policy "orders_update_own"
  on public.orders
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.listings l
      join public.importers i on i.id = l.importer_id
      where l.id = orders.listing_id
        and i.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.listings l
      join public.importers i on i.id = l.importer_id
      where l.id = orders.listing_id
        and i.user_id = auth.uid()
    )
  );

create policy "orders_delete_own"
  on public.orders
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.listings l
      join public.importers i on i.id = l.importer_id
      where l.id = orders.listing_id
        and i.user_id = auth.uid()
    )
  );

-- ---- status_updates ----
-- Importers can read and write status updates only for their own listings.

create policy "status_updates_select_own"
  on public.status_updates
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.listings l
      join public.importers i on i.id = l.importer_id
      where l.id = status_updates.listing_id
        and i.user_id = auth.uid()
    )
  );

create policy "status_updates_insert_own"
  on public.status_updates
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.listings l
      join public.importers i on i.id = l.importer_id
      where l.id = status_updates.listing_id
        and i.user_id = auth.uid()
    )
  );

create policy "status_updates_update_own"
  on public.status_updates
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.listings l
      join public.importers i on i.id = l.importer_id
      where l.id = status_updates.listing_id
        and i.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.listings l
      join public.importers i on i.id = l.importer_id
      where l.id = status_updates.listing_id
        and i.user_id = auth.uid()
    )
  );

create policy "status_updates_delete_own"
  on public.status_updates
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.listings l
      join public.importers i on i.id = l.importer_id
      where l.id = status_updates.listing_id
        and i.user_id = auth.uid()
    )
  );
