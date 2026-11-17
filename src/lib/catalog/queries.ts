import "server-only";

// Every public read of the comic library goes through this file.
//
// Each function is cached ('use cache') for about a minute and tagged
// "catalog", so pages are fast and shared by all visitors, while new or
// scheduled chapters still appear within a minute or two. The admin dashboard
// (Phase 6) will clear the "catalog" tag right after edits.

import { cacheLife, cacheTag } from "next/cache";
import { chapterNumber, isNew, timeAgo, type ComicStatus, type ComicType } from "@/lib/format";
import { imageUrl } from "@/lib/images/urls";
import { createPublicClient } from "@/lib/supabase/public";
import type { CatalogFilters } from "./filters";

export const PAGE_SIZE = 24;

const CARD_COLUMNS =
  "id, slug, title, status, type, synopsis, cover_key, latest_chapter_number, latest_chapter_at, chapter_count, genre_names, genre_slugs, created_at";

export type GenreRef = { name: string; slug: string };

export type ComicCard = {
  id: string;
  slug: string;
  title: string;
  status: ComicStatus;
  type: ComicType;
  synopsis: string;
  coverKey: string | null;
  latestChapter: string | null;
  latestAgo: string | null;
  chapterCount: number;
  genres: GenreRef[];
};

type CardRow = {
  id: string | null;
  slug: string | null;
  title: string | null;
  status: ComicStatus | null;
  type: ComicType | null;
  synopsis: string | null;
  cover_key: string | null;
  latest_chapter_number: number | null;
  latest_chapter_at: string | null;
  chapter_count: number | null;
  genre_names: string[] | null;
  genre_slugs: string[] | null;
};

function toCard(row: CardRow, now: number): ComicCard {
  const names = row.genre_names ?? [];
  const slugs = row.genre_slugs ?? [];
  return {
    id: row.id ?? "",
    slug: row.slug ?? "",
    title: row.title ?? "",
    status: row.status ?? "ongoing",
    type: row.type ?? "manhwa",
    synopsis: row.synopsis ?? "",
    coverKey: row.cover_key,
    latestChapter: chapterNumber(row.latest_chapter_number),
    latestAgo: timeAgo(row.latest_chapter_at, now),
    chapterCount: row.chapter_count ?? 0,
    genres: names.map((name, i) => ({ name, slug: slugs[i] ?? "" })),
  };
}

function fail(what: string, message: string): never {
  throw new Error(`Could not load ${what}: ${message}`);
}

// Escapes % and _ so a search for "100%" means the text "100%", not a wildcard.
function likePattern(q: string): string {
  return `%${q.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

// ---------------------------------------------------------------------------
// Homepage
// ---------------------------------------------------------------------------

export type ChapterUpdate = { number: string; ago: string | null; isNew: boolean };
export type LatestUpdate = ComicCard & { chapters: ChapterUpdate[] };
export type RankedLists = { week: ComicCard[]; month: ComicCard[]; all: ComicCard[] };

export async function getHomeData() {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");

  const db = createPublicClient();
  const now = Date.now();
  const cards = () => db.from("comic_cards").select(CARD_COLUMNS);

  const [featured, latest, recent, week, month, all] = await Promise.all([
    cards().eq("is_featured", true).order("latest_chapter_at", { ascending: false, nullsFirst: false }).limit(5),
    cards().not("latest_chapter_at", "is", null).order("latest_chapter_at", { ascending: false }).limit(6),
    cards().order("created_at", { ascending: false }).limit(6),
    // Ranked by views on Isfrid, then by MangaDex follows (so the lists aren't empty on a new site).
    cards().order("views_7d", { ascending: false }).order("external_popularity", { ascending: false }).limit(8),
    cards().order("views_30d", { ascending: false }).order("external_popularity", { ascending: false }).limit(12),
    cards().order("views_total", { ascending: false }).order("external_popularity", { ascending: false }).limit(8),
  ]);
  for (const [name, res] of Object.entries({ featured, latest, recent, week, month, all })) {
    if (res.error) fail(`homepage (${name})`, res.error.message);
  }

  // The two newest chapters of each "latest update" comic.
  const latestRows = latest.data ?? [];
  const ids = latestRows.map((r) => r.id).filter((id): id is string => Boolean(id));
  const byComic = new Map<string, ChapterUpdate[]>();
  if (ids.length) {
    const { data: chapters, error } = await db
      .from("chapters")
      .select("comic_id, number, published_at")
      .in("comic_id", ids)
      .order("published_at", { ascending: false })
      .limit(ids.length * 4);
    if (error) fail("latest chapters", error.message);
    for (const ch of chapters ?? []) {
      const list = byComic.get(ch.comic_id) ?? [];
      if (list.length < 2) {
        list.push({
          number: chapterNumber(ch.number) ?? "",
          ago: timeAgo(ch.published_at, now),
          isNew: isNew(ch.published_at, now),
        });
        byComic.set(ch.comic_id, list);
      }
    }
  }

  const map = (rows: CardRow[] | null) => (rows ?? []).map((r) => toCard(r, now));
  return {
    featured: map(featured.data),
    latest: latestRows.map((r) => ({ ...toCard(r, now), chapters: byComic.get(r.id ?? "") ?? [] })),
    recent: map(recent.data),
    trending: { week: map(week.data), month: map(month.data).slice(0, 8), all: map(all.data) } satisfies RankedLists,
    popular: map(month.data),
  };
}

// ---------------------------------------------------------------------------
// Browse / search / genre pages
// ---------------------------------------------------------------------------

export type BrowseResult = { items: ComicCard[]; total: number; page: number; pageCount: number };

export async function browseComics(filters: CatalogFilters): Promise<BrowseResult> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");

  const db = createPublicClient();
  let query = db.from("comic_cards").select(CARD_COLUMNS, { count: "exact" });

  if (filters.q) query = query.ilike("search_text", likePattern(filters.q));
  if (filters.genre) query = query.contains("genre_slugs", [filters.genre]);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.type) query = query.eq("type", filters.type);

  switch (filters.sort) {
    case "popular":
      query = query.order("views_30d", { ascending: false }).order("external_popularity", { ascending: false });
      break;
    case "new":
      query = query.order("created_at", { ascending: false });
      break;
    case "title":
      query = query.order("title", { ascending: true });
      break;
    default:
      query = query.order("latest_chapter_at", { ascending: false, nullsFirst: false });
  }
  query = query.order("id", { ascending: true }); // stable order across pages

  const from = (filters.page - 1) * PAGE_SIZE;
  const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1);

  // Asking for a page past the end is not an error: it's just empty.
  if (error && error.code !== "PGRST103") fail("comics", error.message);

  const total = count ?? 0;
  const now = Date.now();
  return {
    items: (data ?? []).map((r) => toCard(r, now)),
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export type RankPeriod = "week" | "month" | "all";

export async function getRankedComics(period: RankPeriod, limit = 24): Promise<ComicCard[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");

  const column = period === "week" ? "views_7d" : period === "month" ? "views_30d" : "views_total";
  const db = createPublicClient();
  const { data, error } = await db
    .from("comic_cards")
    .select(CARD_COLUMNS)
    .order(column, { ascending: false })
    .order("external_popularity", { ascending: false })
    .limit(limit);
  if (error) fail("popular comics", error.message);
  const now = Date.now();
  return (data ?? []).map((r) => toCard(r, now));
}

// ---------------------------------------------------------------------------
// Genres
// ---------------------------------------------------------------------------

export type GenreWithCount = GenreRef & { count: number };

export async function getGenres(): Promise<GenreWithCount[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");

  const db = createPublicClient();
  const [genres, cards] = await Promise.all([
    db.from("genres").select("name, slug").order("name"),
    db.from("comic_cards").select("genre_slugs").limit(5000),
  ]);
  if (genres.error) fail("genres", genres.error.message);
  if (cards.error) fail("genre counts", cards.error.message);

  const counts = new Map<string, number>();
  for (const row of cards.data ?? []) {
    for (const slug of row.genre_slugs ?? []) counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  return (genres.data ?? []).map((g) => ({ ...g, count: counts.get(g.slug) ?? 0 }));
}

// ---------------------------------------------------------------------------
// Latest chapter updates (the /latest page)
// ---------------------------------------------------------------------------

export type ChapterFeedItem = {
  id: string;
  number: string;
  title: string | null;
  ago: string | null;
  isNew: boolean;
  comic: { slug: string; title: string; status: ComicStatus; cover_key: string | null };
};

export async function getLatestChapters(page: number) {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");

  const db = createPublicClient();
  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await db
    .from("chapters")
    .select("id, number, title, published_at, comics!inner(slug, title, status, cover_key)", { count: "exact" })
    .order("published_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, from + PAGE_SIZE - 1);
  if (error && error.code !== "PGRST103") fail("latest chapters", error.message);

  const now = Date.now();
  const items: ChapterFeedItem[] = (data ?? []).map((ch) => ({
    id: ch.id,
    number: chapterNumber(ch.number) ?? "",
    title: ch.title,
    ago: timeAgo(ch.published_at, now),
    isNew: isNew(ch.published_at, now),
    comic: ch.comics,
  }));
  const total = count ?? 0;
  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

// ---------------------------------------------------------------------------
// Reader
// ---------------------------------------------------------------------------

export type ChapterLink = { number: string; title: string | null };
export type ReaderData = {
  comic: { id: string; slug: string; title: string };
  // externalUrl: an official chapter hosted by its publisher (from MangaDex);
  // the reader then links there instead of showing pages.
  chapter: { id: string; number: string; title: string | null; externalUrl: string | null; groupName: string | null };
  pages: { url: string; width: number; height: number }[];
  chapters: ChapterLink[]; // all released chapters, newest first (for the picker)
  prev: ChapterLink | null;
  next: ChapterLink | null;
};

// Everything the reader needs for one released chapter, or null if the comic
// or chapter isn't public (unpublished, scheduled, removed, or doesn't exist).
export async function getReaderData(comicSlug: string, number: number): Promise<ReaderData | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");

  const db = createPublicClient();
  const { data: comic, error } = await db.from("comic_cards").select("id, slug, title").eq("slug", comicSlug).maybeSingle();
  if (error) fail("comic", error.message);
  if (!comic?.id || !comic.slug || !comic.title) return null;

  const { data: chapters, error: chErr } = await db
    .from("chapters")
    .select("id, number, title, external_url, group_name")
    .eq("comic_id", comic.id)
    .order("number", { ascending: false });
  if (chErr) fail("chapters", chErr.message);

  const list = chapters ?? [];
  const index = list.findIndex((c) => Number(c.number) === number);
  if (index === -1) return null;
  const current = list[index];

  const { data: pages, error: pgErr } = current.external_url
    ? { data: [], error: null }
    : await db.from("chapter_images").select("storage_key, width, height").eq("chapter_id", current.id).order("position");
  if (pgErr) fail("pages", pgErr.message);

  const link = (c: { number: number; title: string | null } | undefined): ChapterLink | null =>
    c ? { number: chapterNumber(c.number) ?? "", title: c.title } : null;
  return {
    comic: { id: comic.id, slug: comic.slug, title: comic.title },
    chapter: {
      id: current.id,
      number: chapterNumber(current.number) ?? "",
      title: current.title,
      externalUrl: current.external_url,
      groupName: current.group_name,
    },
    pages: (pages ?? []).map((p) => ({ url: imageUrl(p.storage_key), width: p.width, height: p.height })),
    chapters: list.map((c) => ({ number: chapterNumber(c.number) ?? "", title: c.title })),
    // The list is newest first: "next" is the one before it in the list.
    next: link(list[index - 1]),
    prev: link(list[index + 1]),
  };
}

// ---------------------------------------------------------------------------
// Comic details page
// ---------------------------------------------------------------------------

export type OfficialLink = { label: string; url: string };

export type ComicDetail = ComicCard & {
  mangaupdatesUrl: string | null;
  mangadexId: string | null;
  officialLinks: OfficialLink[];
  altTitles: string[];
  author: string | null;
  artist: string | null;
  releaseYear: number | null;
  chapters: {
    id: string;
    number: string;
    title: string | null;
    ago: string | null;
    isNew: boolean;
    externalUrl: string | null;
    groupName: string | null;
  }[];
  similar: ComicCard[];
};

export async function getComic(slug: string): Promise<ComicDetail | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");

  const db = createPublicClient();
  const { data: row, error } = await db
    .from("comic_cards")
    .select(`${CARD_COLUMNS}, alt_titles, author, artist, release_year, mangaupdates_url, mangadex_id, official_links`)
    .eq("slug", slug)
    .maybeSingle();
  if (error) fail("comic", error.message);
  if (!row?.id) return null;

  const firstGenre = row.genre_slugs?.[0];
  const [chapters, similar] = await Promise.all([
    db
      .from("chapters")
      .select("id, number, title, published_at, external_url, group_name")
      .eq("comic_id", row.id)
      .order("number", { ascending: false }),
    firstGenre
      ? db.from("comic_cards").select(CARD_COLUMNS).contains("genre_slugs", [firstGenre]).neq("id", row.id).limit(6)
      : Promise.resolve({ data: [] as CardRow[], error: null }),
  ]);
  if (chapters.error) fail("chapters", chapters.error.message);
  if (similar.error) fail("similar comics", similar.error.message);

  const now = Date.now();
  return {
    ...toCard(row, now),
    mangaupdatesUrl: row.mangaupdates_url,
    mangadexId: row.mangadex_id,
    officialLinks: Object.values((row.official_links ?? {}) as Record<string, OfficialLink>).filter(
      (l) => typeof l?.url === "string" && l.url.startsWith("https://") && typeof l.label === "string",
    ),
    altTitles: row.alt_titles ?? [],
    author: row.author,
    artist: row.artist,
    releaseYear: row.release_year,
    chapters: (chapters.data ?? []).map((ch) => ({
      id: ch.id,
      number: chapterNumber(ch.number) ?? "",
      title: ch.title,
      ago: timeAgo(ch.published_at, now),
      isNew: isNew(ch.published_at, now),
      externalUrl: ch.external_url,
      groupName: ch.group_name,
    })),
    similar: (similar.data ?? []).map((r) => toCard(r, now)),
  };
}
