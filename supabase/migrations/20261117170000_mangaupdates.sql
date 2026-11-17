-- IsfridVerse MangaUpdates integration (Phase 5)

-- Link back to the MangaUpdates series page, shown as a credit on comics whose
-- details were imported (their Acceptable Use Policy requires crediting them).
alter table public.comics
  add column mangaupdates_url text
  check (mangaupdates_url ~ '^https://(www\.)?mangaupdates\.com/');

-- ---------------------------------------------------------------------------
-- Cache of MangaUpdates answers so the same search or series is never fetched
-- twice in a short time (searches: 24 hours, series: 7 days). Only admins use
-- the import tool, so only admins can read or write the cache.
-- ---------------------------------------------------------------------------
create table public.mangaupdates_cache (
  cache_key text primary key check (char_length(cache_key) <= 300),
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index mangaupdates_cache_expires_idx on public.mangaupdates_cache (expires_at);

alter table public.mangaupdates_cache enable row level security;
revoke all on public.mangaupdates_cache from anon, authenticated;
grant select, insert, update, delete on public.mangaupdates_cache to authenticated;

create policy "Admins use the metadata cache"
  on public.mangaupdates_cache for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- comic_cards gains mangaupdates_url (new columns must go at the end).
-- ---------------------------------------------------------------------------
create or replace view public.comic_cards
with (security_invoker = true)
as
select
  c.id,
  c.slug,
  c.title,
  c.alt_titles,
  c.synopsis,
  c.author,
  c.artist,
  c.status,
  c.type,
  c.release_year,
  c.cover_key,
  c.is_featured,
  c.created_at,
  c.updated_at,
  c.search_text,
  ch.latest_chapter_number,
  ch.latest_chapter_at,
  coalesce(ch.chapter_count, 0) as chapter_count,
  coalesce(gn.names, '{}') as genre_names,
  coalesce(gn.slugs, '{}') as genre_slugs,
  coalesce(v.views_7d, 0) as views_7d,
  coalesce(v.views_30d, 0) as views_30d,
  coalesce(v.views_total, 0) as views_total,
  c.mangaupdates_url
from public.comics c
left join lateral (
  select
    max(x.number) as latest_chapter_number,
    max(x.published_at) as latest_chapter_at,
    count(*) as chapter_count
  from public.chapters x
  where x.comic_id = c.id
    and x.status = 'published'
    and x.published_at <= now()
    and x.deleted_at is null
) ch on true
left join lateral (
  select
    array_agg(g.name order by g.name) as names,
    array_agg(g.slug order by g.name) as slugs
  from public.comic_genres cg
  join public.genres g on g.id = cg.genre_id
  where cg.comic_id = c.id
) gn on true
left join lateral (
  select
    sum(d.views) filter (where d.day > current_date - 7) as views_7d,
    sum(d.views) filter (where d.day > current_date - 30) as views_30d,
    sum(d.views) as views_total
  from public.comic_views_daily d
  where d.comic_id = c.id
) v on true
where c.is_published and c.deleted_at is null;
