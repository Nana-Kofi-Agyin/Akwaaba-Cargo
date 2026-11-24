-- Delivery logs for Arkesel SMS notifications sent on listing status updates

create type public.sms_delivery_status as enum ('sent', 'failed');

create table public.sms_logs (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  status_update_id uuid not null references public.status_updates(id) on delete cascade,
  recipient_phone text not null,
  message text not null,
  delivery_status public.sms_delivery_status not null,
  provider_response text,
  error_message text,
  created_at timestamptz not null default now()
);

create index idx_sms_logs_status_update_id on public.sms_logs (status_update_id);
create index idx_sms_logs_listing_id on public.sms_logs (listing_id, created_at desc);

alter table public.sms_logs enable row level security;

create policy "sms_logs_select_own"
  on public.sms_logs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.listings l
      join public.importers i on i.id = l.importer_id
      where l.id = sms_logs.listing_id
        and i.user_id = auth.uid()
    )
  );

create policy "sms_logs_insert_own"
  on public.sms_logs
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.listings l
      join public.importers i on i.id = l.importer_id
      where l.id = sms_logs.listing_id
        and i.user_id = auth.uid()
    )
  );
