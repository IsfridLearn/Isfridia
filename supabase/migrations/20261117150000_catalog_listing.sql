-- IsfridVerse catalog listing (Phase 4)
-- Search text, daily view counts, and one read-only view (comic_cards) that
-- every list page uses: homepage sections, browse, genres, search, popular.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Search: one lower-case text column per comic, kept up to date by a trigger,
-- with a trigram index so "contains" searches stay fast as the library grows.
-- ---------------------------------------------------------------------------
alter table public.comics add column search_text text not null default '';

create function public.comics_set_search_text()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_text := lower(concat_ws(' ', new.title, array_to_string(new.alt_titles, ' '), new.author, new.artist));
  return new;
end;
$$;

create trigger comics_set_search_text
  before insert or update of title, alt_titles, author, artist on public.comics
  for each row execute function public.comics_set_search_text();

update public.comics
set search_text = lower(concat_ws(' ', title, array_to_string(alt_titles, ' '), author, artist));

create index comics_search_text_trgm_idx
  on public.comics using gin (search_text extensions.gin_trgm_ops);

revoke execute on function public.comics_set_search_text() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Daily view counts, used to rank Popular (30 days) and Trending (7 days).
-- Readable by everyone for visible comics. Nothing writes to it yet: the
-- reader (Phase 8) records views through a rate-limited function.
-- ---------------------------------------------------------------------------
create table public.comic_views_daily (
  comic_id uuid not null references public.comics (id) on delete cascade,
  day date not null default current_date,
  views integer not null default 0 check (views >= 0),
  primary key (comic_id, day)
);
create index comic_views_daily_day_idx on public.comic_views_daily (day);

alter table public.comic_views_daily enable row level security;
revoke all on public.comic_views_daily from anon, authenticated;
grant select on public.comic_views_daily to anon, authenticated;

create policy "View counts follow comic visibility"
  on public.comic_views_daily for select
  to anon, authenticated
  using (exists (select 1 from public.comics c where c.id = comic_views_daily.comic_id));

-- ---------------------------------------------------------------------------
-- comic_cards: one row per PUBLIC comic with everything a card needs.
-- security_invoker = true: the caller's own permissions and RLS apply, so a
-- visitor can never see more through the view than through the tables.
-- The explicit filters keep it public-only even for admins.
-- ---------------------------------------------------------------------------
create view public.comic_cards
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
  coalesce(v.views_total, 0) as views_total
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

grant select on public.comic_cards to anon, authenticated;
