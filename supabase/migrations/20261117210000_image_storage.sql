-- IsfridVerse image storage (Phase 6b): Supabase Storage
--
-- One public bucket, "images", for covers now and chapter pages later.
-- Public = anyone can VIEW a file if they know its address (needed for a
-- reading site). Only admins can upload, replace, list or delete files.
-- The app converts every upload to WebP first, so only WebP is accepted.
--
-- Moving to Cloudflare R2 later: the app builds image addresses from one
-- setting (NEXT_PUBLIC_IMAGE_BASE_URL), so it is a storage swap, not a rewrite.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', true, 2097152, array['image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Admins list images"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'images' and (select public.is_admin()));

create policy "Admins upload images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'images' and (select public.is_admin()));

create policy "Admins replace images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'images' and (select public.is_admin()))
  with check (bucket_id = 'images' and (select public.is_admin()));

create policy "Admins delete images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'images' and (select public.is_admin()));
