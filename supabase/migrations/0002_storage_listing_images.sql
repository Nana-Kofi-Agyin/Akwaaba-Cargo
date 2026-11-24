-- Storage bucket for listing product photos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-images',
  'listing-images',
  true,
  5242880, -- 5 MB max per image
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Anyone can view product photos for shared pre-order listings
create policy "listing_images_public_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'listing-images');

-- Authenticated importers can upload only into their own user_id folder
create policy "listing_images_auth_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated importers can update/delete only their own uploaded images
create policy "listing_images_auth_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "listing_images_auth_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
