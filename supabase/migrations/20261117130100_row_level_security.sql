-- IsfridVerse Row Level Security (Phase 3)
--
-- Roles Supabase uses for requests:
--   anon          = visitor, not logged in
--   authenticated = logged-in user (auth.uid() is their id)
-- The secret key bypasses all of this; it is only used on the server.
--
-- Summary
--   content (comics, genres, chapters, images): everyone reads what is public;
--     admins read everything and write.
--   profiles: everyone reads; you edit only your own (and only some columns).
--   bookmarks, reading_history: only your own rows.
--   admin_permissions: you see your own row; owners manage admins.
--
-- `(select auth.uid())` instead of `auth.uid()` lets Postgres evaluate it once
-- per query instead of once per row.

-- ---------------------------------------------------------------------------
-- Turn RLS on for every table
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.admin_permissions enable row level security;
alter table public.genres enable row level security;
alter table public.comics enable row level security;
alter table public.comic_genres enable row level security;
alter table public.chapters enable row level security;
alter table public.chapter_images enable row level security;
alter table public.bookmarks enable row level security;
alter table public.reading_history enable row level security;

-- ---------------------------------------------------------------------------
-- Table privileges (what each role may attempt; RLS then filters the rows)
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.admin_permissions, public.genres, public.comics,
  public.comic_genres, public.chapters, public.chapter_images, public.bookmarks,
  public.reading_history from anon, authenticated;

grant select on public.profiles, public.genres, public.comics, public.comic_genres,
  public.chapters, public.chapter_images to anon, authenticated;

-- Users may change only these profile columns (not id or timestamps).
grant update (username, display_name, avatar_url) on public.profiles to authenticated;

grant select, insert, update, delete on public.admin_permissions, public.genres, public.comics,
  public.comic_genres, public.chapters, public.chapter_images, public.bookmarks,
  public.reading_history to authenticated;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy "Profiles are public"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "Users update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- admin_permissions
-- Owners can grant/revoke the admin role for other people. Owner rows are only
-- ever created in the SQL editor, so nobody can lock the owner out or promote
-- themselves through the app.
-- ---------------------------------------------------------------------------
create policy "See own admin row; admins see all"
  on public.admin_permissions for select
  to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Owners grant admin to others"
  on public.admin_permissions for insert
  to authenticated
  with check ((select public.is_owner()) and user_id <> (select auth.uid()) and role = 'admin');

create policy "Owners change other admins"
  on public.admin_permissions for update
  to authenticated
  using ((select public.is_owner()) and user_id <> (select auth.uid()) and role = 'admin')
  with check ((select public.is_owner()) and user_id <> (select auth.uid()) and role = 'admin');

create policy "Owners revoke other admins"
  on public.admin_permissions for delete
  to authenticated
  using ((select public.is_owner()) and user_id <> (select auth.uid()) and role = 'admin');

-- ---------------------------------------------------------------------------
-- genres
-- ---------------------------------------------------------------------------
create policy "Genres are public"
  on public.genres for select
  to anon, authenticated
  using (true);

create policy "Admins manage genres"
  on public.genres for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- comics: visible when published and not in the trash
-- ---------------------------------------------------------------------------
create policy "Published comics are public; admins see all"
  on public.comics for select
  to anon, authenticated
  using ((is_published and deleted_at is null) or (select public.is_admin()));

create policy "Admins insert comics"
  on public.comics for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Admins update comics"
  on public.comics for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins delete comics"
  on public.comics for delete
  to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- comic_genres: visible when the comic is visible (the sub-select is itself
-- filtered by the comics policy above)
-- ---------------------------------------------------------------------------
create policy "Comic genres follow comic visibility"
  on public.comic_genres for select
  to anon, authenticated
  using (exists (select 1 from public.comics c where c.id = comic_genres.comic_id));

create policy "Admins manage comic genres"
  on public.comic_genres for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- chapters: visible when published, release time reached, not in the trash,
-- and the comic itself is visible. This is what makes scheduling work.
-- ---------------------------------------------------------------------------
create policy "Released chapters are public; admins see all"
  on public.chapters for select
  to anon, authenticated
  using (
    (
      status = 'published'
      and published_at <= now()
      and deleted_at is null
      and exists (select 1 from public.comics c where c.id = chapters.comic_id)
    )
    or (select public.is_admin())
  );

create policy "Admins insert chapters"
  on public.chapters for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Admins update chapters"
  on public.chapters for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins delete chapters"
  on public.chapters for delete
  to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- chapter_images: visible when the chapter is visible
-- ---------------------------------------------------------------------------
create policy "Images follow chapter visibility"
  on public.chapter_images for select
  to anon, authenticated
  using (exists (select 1 from public.chapters ch where ch.id = chapter_images.chapter_id));

create policy "Admins manage chapter images"
  on public.chapter_images for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- bookmarks: your own rows only, and only for comics you can see
-- ---------------------------------------------------------------------------
create policy "Users read own bookmarks"
  on public.bookmarks for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users add own bookmarks"
  on public.bookmarks for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.comics c where c.id = bookmarks.comic_id)
  );

create policy "Users update own bookmarks"
  on public.bookmarks for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users delete own bookmarks"
  on public.bookmarks for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- reading_history: your own rows only, and only for chapters you can see
-- ---------------------------------------------------------------------------
create policy "Users read own history"
  on public.reading_history for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users add own history"
  on public.reading_history for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.chapters ch where ch.id = reading_history.chapter_id)
  );

create policy "Users update own history"
  on public.reading_history for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.chapters ch where ch.id = reading_history.chapter_id)
  );

create policy "Users delete own history"
  on public.reading_history for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Functions: only the helpers the policies need are callable over the API
-- ---------------------------------------------------------------------------
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.reading_history_set_comic() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_owner() to anon, authenticated;
