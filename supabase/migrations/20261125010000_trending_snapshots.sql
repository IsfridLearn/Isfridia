-- Isfridia: "Trending This Week" (weekly follower growth from MangaDex).
--
-- MangaDex's statistics API only gives today's totals (follows, rating), with
-- no history. So once a day the collector (src/lib/mangadex/stats.ts, run by
-- the Vercel cron job or `npm run mangadex:stats`) stores a snapshot per title,
-- and trending is the GROWTH between snapshots, never the cumulative total.

create table public.mangadex_stat_snapshots (
  comic_id uuid not null references public.comics (id) on delete cascade,
  taken_on date not null,
  follows integer not null check (follows >= 0),
  rating numeric(6, 4) check (rating >= 0 and rating <= 10),
  primary key (comic_id, taken_on)
);

create index mangadex_stat_snapshots_taken_on_idx on public.mangadex_stat_snapshots (taken_on);

alter table public.mangadex_stat_snapshots enable row level security;

-- Follower counts are public MangaDex data; visitors may read the snapshots of
-- comics they can see (the comics policies decide that). Nobody gets insert,
-- update or delete: only the server's secret key writes here.
create policy "Snapshots of visible comics are readable"
  on public.mangadex_stat_snapshots
  for select
  to anon, authenticated
  using (exists (select 1 from public.comics c where c.id = comic_id));

revoke insert, update, delete, truncate on public.mangadex_stat_snapshots from anon, authenticated;

-- Top manhwa by followers gained.
--   mode 'week'     : growth over (at least) the last 7 days, with last week's
--                     rank for the up/down arrows when two weeks exist.
--   mode 'partial'  : less than a week of snapshots yet; growth since the first one.
--   mode 'starting' : only one day of snapshots; most-followed manhwa as a
--                     starting point (the page says so, it is not called growth).
create or replace function public.trending_this_week(p_limit integer default 10)
returns table (
  comic_id uuid,
  rank integer,
  follows integer,
  gain integer,
  previous_rank integer,
  has_previous boolean,
  mode text,
  window_start date,
  window_end date
)
language sql
stable
security invoker
set search_path = public
as $$
  with
  pool as (
    select cc.id, cc.external_popularity
    from public.comic_cards cc
    where cc.type = 'manhwa' and cc.source = 'mangadex'
  ),
  snaps as (
    select s.comic_id, s.taken_on, s.follows, s.rating
    from public.mangadex_stat_snapshots s
    join pool p on p.id = s.comic_id
  ),
  d as (
    select max(taken_on) as d_now from snaps
  ),
  d2 as (
    select
      d.d_now,
      coalesce(
        (select max(s.taken_on) from snaps s where s.taken_on <= d.d_now - 7),
        (select min(s.taken_on) from snaps s where s.taken_on < d.d_now)
      ) as d_base
    from d
  ),
  dates as (
    select
      d2.d_now,
      d2.d_base,
      (select max(s.taken_on) from snaps s where s.taken_on <= d2.d_base - 7) as d_prev,
      case
        when d2.d_base is null then 'starting'
        when d2.d_now - d2.d_base >= 7 then 'week'
        else 'partial'
      end as mode
    from d2
  ),
  growth as (
    select
      n.comic_id,
      n.follows,
      n.follows - b.follows as gain,
      coalesce(n.rating - b.rating, 0) as rating_change
    from dates
    join snaps n on n.taken_on = dates.d_now
    join snaps b on b.comic_id = n.comic_id and b.taken_on = dates.d_base
  ),
  ranked as (
    select
      g.*,
      row_number() over (order by g.gain desc, g.rating_change desc, g.follows desc, g.comic_id)::integer as rnk
    from growth g
    where g.gain > 0
  ),
  previous as (
    select
      b.comic_id,
      row_number() over (
        order by b.follows - p.follows desc, coalesce(b.rating - p.rating, 0) desc, b.follows desc, b.comic_id
      )::integer as rnk
    from dates
    join snaps b on b.taken_on = dates.d_base
    join snaps p on p.comic_id = b.comic_id and p.taken_on = dates.d_prev
    where dates.mode = 'week' and b.follows - p.follows > 0
  ),
  growth_rows as (
    select
      r.comic_id,
      r.rnk as rank,
      r.follows,
      r.gain,
      pr.rnk as previous_rank,
      (dates.mode = 'week' and dates.d_prev is not null) as has_previous,
      dates.mode,
      dates.d_base as window_start,
      dates.d_now as window_end
    from ranked r
    cross join dates
    left join previous pr on pr.comic_id = r.comic_id
    where dates.mode <> 'starting'
    order by r.rnk
    limit greatest(1, least(p_limit, 50))
  ),
  starting_rows as (
    select
      p.id as comic_id,
      row_number() over (order by coalesce(s.follows, p.external_popularity, 0) desc, p.id)::integer as rank,
      coalesce(s.follows, p.external_popularity, 0)::integer as follows,
      null::integer as gain,
      null::integer as previous_rank,
      false as has_previous,
      'starting'::text as mode,
      null::date as window_start,
      dates.d_now as window_end
    from pool p
    cross join dates
    left join snaps s on s.comic_id = p.id and s.taken_on = dates.d_now
    where dates.mode = 'starting'
    order by 2
    limit greatest(1, least(p_limit, 50))
  )
  select * from growth_rows
  union all
  select * from starting_rows
  order by rank;
$$;

grant execute on function public.trending_this_week(integer) to anon, authenticated;
