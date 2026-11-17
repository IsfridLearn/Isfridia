-- IsfridVerse core schema (Phase 3)
-- Tables for accounts, comics, chapters, images and per-user reading data.
-- Security rules (Row Level Security) are in the next migration.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.comic_status as enum ('ongoing', 'completed', 'hiatus', 'cancelled');
create type public.comic_type as enum ('manhwa', 'manga', 'manhua', 'webcomic');
create type public.chapter_status as enum ('draft', 'published');
-- owner: everything, including granting/revoking admins. admin: manage content and users.
create type public.admin_role as enum ('owner', 'admin');

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at current
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: public info for each account (one row per auth user)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique
    check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text
    check (char_length(display_name) between 1 and 50),
  avatar_url text
    check (avatar_url ~ '^https://'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'Public profile for each user. Holds no private data; roles live in admin_permissions.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile automatically when someone signs up.
-- Uses the username they chose (passed as sign-up metadata) if it is valid and
-- free; otherwise falls back to reader_<10 hex chars>.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted text := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));
  chosen text;
begin
  if wanted ~ '^[a-z0-9_]{3,24}$'
     and not exists (select 1 from public.profiles p where p.username = wanted) then
    chosen := wanted;
  else
    chosen := 'reader_' || substr(replace(new.id::text, '-', ''), 1, 10);
  end if;

  insert into public.profiles (id, username)
  values (new.id, chosen);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- admin_permissions: who may use the admin dashboard
-- ---------------------------------------------------------------------------
create table public.admin_permissions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.admin_role not null,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now()
);
comment on table public.admin_permissions is 'A row here = admin access. The first owner is added by hand in the SQL editor.';

-- Helper functions used by the security rules. SECURITY DEFINER lets them read
-- admin_permissions even though normal users cannot.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_permissions a where a.user_id = (select auth.uid())
  );
$$;

create function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_permissions a
    where a.user_id = (select auth.uid()) and a.role = 'owner'
  );
$$;

-- ---------------------------------------------------------------------------
-- genres + comics + comic_genres
-- ---------------------------------------------------------------------------
create table public.genres (
  id bigint generated always as identity primary key,
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 40),
  name text not null unique
    check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now()
);

create table public.comics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  title text not null
    check (char_length(title) between 1 and 200),
  alt_titles text[] not null default '{}'
    check (cardinality(alt_titles) <= 20),
  synopsis text not null default ''
    check (char_length(synopsis) <= 5000),
  author text check (char_length(author) <= 120),
  artist text check (char_length(artist) <= 120),
  status public.comic_status not null default 'ongoing',
  type public.comic_type not null default 'manhwa',
  release_year smallint check (release_year between 1900 and 2100),
  cover_key text,                       -- R2 object key, set in Phase 6
  is_published boolean not null default false,
  is_featured boolean not null default false,
  mangaupdates_id bigint unique,        -- set when metadata was imported (Phase 5)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz                -- not null = in the trash
);

create index comics_public_recent_idx
  on public.comics (updated_at desc)
  where is_published and deleted_at is null;

create trigger comics_set_updated_at
  before update on public.comics
  for each row execute function public.set_updated_at();

create table public.comic_genres (
  comic_id uuid not null references public.comics (id) on delete cascade,
  genre_id bigint not null references public.genres (id) on delete cascade,
  primary key (comic_id, genre_id)
);
create index comic_genres_genre_idx on public.comic_genres (genre_id);

-- ---------------------------------------------------------------------------
-- chapters + chapter_images
-- ---------------------------------------------------------------------------
create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  comic_id uuid not null references public.comics (id) on delete cascade,
  number numeric(7, 2) not null check (number >= 0),   -- 10.5 is allowed
  title text check (char_length(title) <= 200),
  status public.chapter_status not null default 'draft',
  published_at timestamptz,             -- in the future = scheduled
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (comic_id, number),
  constraint published_needs_date check (status = 'draft' or published_at is not null)
);

create index chapters_latest_idx
  on public.chapters (published_at desc)
  where status = 'published' and deleted_at is null;

create trigger chapters_set_updated_at
  before update on public.chapters
  for each row execute function public.set_updated_at();

create table public.chapter_images (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  position integer not null check (position >= 0),
  storage_key text not null unique,     -- R2 object key, random and unguessable
  width integer not null check (width between 1 and 20000),
  height integer not null check (height between 1 and 20000),
  bytes integer not null check (bytes > 0),
  created_at timestamptz not null default now(),
  -- deferrable so a reorder can swap positions inside one transaction
  constraint chapter_images_order unique (chapter_id, position) deferrable initially immediate
);

-- ---------------------------------------------------------------------------
-- bookmarks + reading_history (private per user)
-- ---------------------------------------------------------------------------
create table public.bookmarks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  comic_id uuid not null references public.comics (id) on delete cascade,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, comic_id)
);
create index bookmarks_comic_idx on public.bookmarks (comic_id);

create table public.reading_history (
  user_id uuid not null references public.profiles (id) on delete cascade,
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  comic_id uuid not null references public.comics (id) on delete cascade,
  progress real not null default 0 check (progress between 0 and 1),
  last_image_index integer not null default 0 check (last_image_index >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, chapter_id)
);
create index reading_history_recent_idx on public.reading_history (user_id, updated_at desc);

-- comic_id is always copied from the chapter, so it can never point at the
-- wrong comic, whatever the client sends.
create function public.reading_history_set_comic()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select c.comic_id into new.comic_id from public.chapters c where c.id = new.chapter_id;
  new.updated_at = now();
  return new;
end;
$$;

create trigger reading_history_set_comic
  before insert or update on public.reading_history
  for each row execute function public.reading_history_set_comic();
