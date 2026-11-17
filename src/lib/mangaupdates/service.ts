import "server-only";

// Search and fetch MangaUpdates series, with a database cache in front.
//
// Cache: searches are kept 24 hours, series 7 days, in the mangaupdates_cache
// table (admins only). It lives in the database rather than server memory so
// it survives restarts and is shared by every server instance.
//
// Only fields IsfridVerse uses are stored. Cover images are deliberately NOT
// imported: they belong to publishers and artists.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { MangaUpdatesError, mangaUpdatesRequest } from "./client";
import { toPlainText, type MuSeries } from "./map";
import { searchResponseSchema, seriesSchema } from "./schemas";

type Db = SupabaseClient<Database>;

const DAY_MS = 24 * 60 * 60 * 1000;

export type SearchHit = {
  id: number;
  title: string;
  matchedTitle: string | null; // the alternative title that matched, if different
  type: string | null;
  year: string | null;
  genres: string[];
  snippet: string;
};
export type SearchResult = { total: number; hits: SearchHit[]; cached: boolean };

async function readCache<T>(db: Db, key: string): Promise<T | null> {
  const { data } = await db
    .from("mangaupdates_cache")
    .select("payload")
    .eq("cache_key", key)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return (data?.payload as T | undefined) ?? null;
}

async function writeCache(db: Db, key: string, payload: unknown, ttlMs: number): Promise<void> {
  const now = Date.now();
  // A cache write failing is not worth failing the request for.
  await db.from("mangaupdates_cache").upsert({
    cache_key: key,
    payload: payload as Json,
    fetched_at: new Date(now).toISOString(),
    expires_at: new Date(now + ttlMs).toISOString(),
  });
  // Tidy up expired entries now and then.
  if (Math.random() < 0.1) await db.from("mangaupdates_cache").delete().lt("expires_at", new Date(now).toISOString());
}

export async function searchSeries(db: Db, rawQuery: string): Promise<SearchResult> {
  const query = rawQuery.trim().replace(/\s+/g, " ").slice(0, 100);
  if (!query) return { total: 0, hits: [], cached: false };

  const key = `search:v1:${query.toLowerCase()}`;
  const cached = await readCache<Omit<SearchResult, "cached">>(db, key);
  if (cached) return { ...cached, cached: true };

  const raw = await mangaUpdatesRequest("/series/search", { method: "POST", body: { search: query } });
  const parsed = searchResponseSchema.safeParse(raw ?? {});
  if (!parsed.success) throw new MangaUpdatesError("MangaUpdates sent search results in an unexpected format.");

  const result = {
    total: parsed.data.total_hits,
    hits: parsed.data.results.map(({ record, hit_title }) => ({
      id: record.series_id,
      title: record.title,
      matchedTitle: hit_title && hit_title !== record.title ? hit_title : null,
      type: record.type ?? null,
      year: record.year ?? null,
      genres: (record.genres ?? []).map((g) => g.genre).filter(Boolean),
      snippet: toPlainText(record.description ?? "", 220),
    })),
  };
  await writeCache(db, key, result, DAY_MS);
  return { ...result, cached: false };
}

export async function getSeries(db: Db, id: number): Promise<(MuSeries & { cached: boolean }) | null> {
  const key = `series:v1:${id}`;
  const cached = await readCache<MuSeries>(db, key);
  if (cached) return { ...cached, cached: true };

  const raw = await mangaUpdatesRequest(`/series/${id}`);
  if (raw === null) return null;
  const parsed = seriesSchema.safeParse(raw);
  if (!parsed.success) throw new MangaUpdatesError("MangaUpdates sent series details in an unexpected format.");

  const s = parsed.data;
  const series: MuSeries = {
    id: s.series_id,
    title: s.title,
    url: s.url ?? null,
    associated: (s.associated ?? []).map((a) => a.title),
    description: s.description ?? "",
    type: s.type ?? null,
    year: s.year ?? null,
    status: s.status ?? null,
    completed: s.completed ?? null,
    genres: (s.genres ?? []).map((g) => g.genre),
    authors: s.authors ?? [],
  };
  await writeCache(db, key, series, 7 * DAY_MS);
  return { ...series, cached: false };
}
