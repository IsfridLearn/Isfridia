-- IsfridVerse reader: honest view counting (Phase 8)
--
-- A "view" = one visitor reading one released chapter, at most once per day.
-- Visitors are identified only by a one-way scrambled code made on the server
-- from their network address + a secret + the date (never stored readably,
-- and it changes daily). Browsers cannot call the counting function directly:
-- only the website's server can (service role), after its own checks.

create table public.chapter_view_dedupe (
  visitor_hash text not null check (char_length(visitor_hash) between 16 and 128),
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  day date not null default current_date,
  primary key (visitor_hash, chapter_id, day)
);
create index chapter_view_dedupe_day_idx on public.chapter_view_dedupe (day);

-- RLS on with no policies: nobody but the service role can touch it.
alter table public.chapter_view_dedupe enable row level security;
revoke all on public.chapter_view_dedupe from anon, authenticated;

-- Counts a view if the chapter is publicly released and this visitor hasn't
-- been counted for it today. Returns true when a view was added.
create function public.record_chapter_view(p_chapter_id uuid, p_visitor_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comic uuid;
begin
  select ch.comic_id into v_comic
  from public.chapters ch
  join public.comics c on c.id = ch.comic_id
  where ch.id = p_chapter_id
    and ch.status = 'published'
    and ch.published_at <= now()
    and ch.deleted_at is null
    and c.is_published
    and c.deleted_at is null;
  if v_comic is null then
    return false;
  end if;

  insert into public.chapter_view_dedupe (visitor_hash, chapter_id)
  values (p_visitor_hash, p_chapter_id)
  on conflict do nothing;
  if not found then
    return false; -- already counted today
  end if;

  insert into public.comic_views_daily (comic_id, day, views)
  values (v_comic, current_date, 1)
  on conflict (comic_id, day) do update set views = public.comic_views_daily.views + 1;

  -- Yesterday's and older visitor codes are no longer needed.
  if random() < 0.01 then
    delete from public.chapter_view_dedupe where day < current_date - 1;
  end if;
  return true;
end;
$$;

revoke execute on function public.record_chapter_view(uuid, text) from public, anon, authenticated;
grant execute on function public.record_chapter_view(uuid, text) to service_role;
