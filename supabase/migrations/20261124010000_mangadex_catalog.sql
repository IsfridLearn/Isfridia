-- IsfridVerse: MangaDex catalog (titles, covers, official chapter links)
--
-- MangaDex titles are stored as normal comics (source = 'mangadex') so every
-- existing page (browse, genres, search, comic page, latest, popular) works
-- with them. Their chapters are the OFFICIAL ones only: chapters MangaDex lists
-- with an external URL to the publisher. Fan scanlations are never stored.
-- A sync script (scripts/mangadex-sync.mjs) keeps them up to date and removes
-- anything MangaDex removes.

alter table public.comics
  add column source text not null default 'isfrid' check (source in ('isfrid', 'mangadex')),
  add column mangadex_id uuid unique,
  add column external_popularity integer not null default 0 check (external_popularity >= 0),
  add column official_links jsonb not null default '{}'::jsonb,
  add column external_synced_at timestamptz;

alter table public.chapters
  add column mangadex_id uuid unique,
  add column external_url text check (external_url ~ '^https://'),
  add column group_name text check (char_length(group_name) <= 200),
  add column translated_language text check (char_length(translated_language) <= 12);

create index comics_source_idx on public.comics (source);

-- ---------------------------------------------------------------------------
-- Audit log: keep recording every admin change, but skip the sync script's
-- automatic writes to MangaDex rows (no logged-in user) so thousands of
-- imports don't flood the log or the database.
-- ---------------------------------------------------------------------------
create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  if auth.uid() is null
     and (row_data ? 'mangadex_id' and row_data ->> 'mangadex_id' is not null
          or (tg_table_name = 'comic_genres'
              and exists (select 1 from public.comics c
                          where c.id = (row_data ->> 'comic_id')::uuid and c.source = 'mangadex'))) then
    return coalesce(new, old);
  end if;

  insert into public.audit_log (actor_id, action, table_name, row_id, old_data, new_data)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce(row_data ->> 'id', row_data ->> 'comic_id', ''),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

-- ---------------------------------------------------------------------------
-- comic_cards gains source, mangadex_id, external_popularity, official_links
-- (new columns at the end).
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
  c.mangaupdates_url,
  c.source,
  c.mangadex_id,
  c.external_popularity,
  c.official_links
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
