// Daily MangaDex statistics snapshot, the raw data behind "Trending This Week".
//
// MangaDex's /statistics/manga only returns today's totals (follows, rating),
// so this stores one row per title per day in mangadex_stat_snapshots; the
// database function trending_this_week() turns them into weekly GROWTH.
//
// Run by the daily cron route (src/app/api/cron/mangadex-stats/route.ts) and by
// `npm run mangadex:stats`. Needs the SECRET-key client (writes bypass RLS).
// About 1 request per 100 titles, spaced by the shared polite client.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types.ts";
import { mangadex } from "./api.ts";

type StatsResponse = {
  statistics?: Record<string, { follows?: unknown; rating?: { bayesian?: unknown } | null } | undefined>;
};

export type SnapshotResult = { day: string; titles: number; saved: number; missing: number; pruned: number };

// Snapshots older than this are deleted: two weeks are needed for the arrows,
// the rest is headroom for missed days.
export const KEEP_DAYS = 35;

// Validated numbers from one MangaDex statistics entry, or null when unusable.
export function readStat(entry: { follows?: unknown; rating?: { bayesian?: unknown } | null } | undefined) {
  const follows = entry?.follows;
  if (typeof follows !== "number" || !Number.isInteger(follows) || follows < 0) return null;
  const bayesian = entry?.rating?.bayesian;
  const rating = typeof bayesian === "number" && Number.isFinite(bayesian) && bayesian >= 0 && bayesian <= 10 ? bayesian : null;
  return { follows, rating };
}

export async function collectSnapshots(db: SupabaseClient<Database>, now = new Date()): Promise<SnapshotResult> {
  const day = now.toISOString().slice(0, 10); // UTC date

  // Every published MangaDex title in the catalog.
  const titles: { id: string; mangadex_id: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("comics")
      .select("id, mangadex_id")
      .not("mangadex_id", "is", null)
      .eq("is_published", true)
      .is("deleted_at", null)
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(`Could not list titles: ${error.message}`);
    for (const row of data) if (row.mangadex_id) titles.push({ id: row.id, mangadex_id: row.mangadex_id });
    if (data.length < 1000) break;
  }

  let saved = 0;
  let missing = 0;
  for (let i = 0; i < titles.length; i += 100) {
    const batch = titles.slice(i, i + 100);
    const res = await mangadex<StatsResponse>(
      "/statistics/manga",
      batch.map((t) => ["manga[]", t.mangadex_id]),
      "Isfridia/1.0 (daily statistics)",
    );
    const rows = [];
    for (const t of batch) {
      const stat = readStat(res.statistics?.[t.mangadex_id]);
      if (!stat) {
        missing++;
        continue;
      }
      rows.push({ comic_id: t.id, taken_on: day, follows: stat.follows, rating: stat.rating });
    }
    if (rows.length) {
      // Same day twice (a re-run) just refreshes that day's numbers.
      const { error } = await db.from("mangadex_stat_snapshots").upsert(rows, { onConflict: "comic_id,taken_on" });
      if (error) throw new Error(`Could not save snapshots: ${error.message}`);
      saved += rows.length;
    }
  }

  const cutoff = new Date(now.getTime() - KEEP_DAYS * 86_400_000).toISOString().slice(0, 10);
  const { count, error } = await db.from("mangadex_stat_snapshots").delete({ count: "exact" }).lt("taken_on", cutoff);
  if (error) throw new Error(`Could not prune old snapshots: ${error.message}`);

  return { day, titles: titles.length, saved, missing, pruned: count ?? 0 };
}
