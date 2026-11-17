import "server-only";

// A reader's own bookmarks and reading history. Always called with that
// reader's session client, so Row Level Security returns only their rows.
// Not cached: it's personal and changes as they read.

import type { SupabaseClient } from "@supabase/supabase-js";
import { chapterNumber, timeAgo } from "@/lib/format";
import type { Database } from "@/lib/supabase/database.types";

type Db = SupabaseClient<Database>;

export type HistoryEntry = {
  comicId: string;
  slug: string;
  title: string;
  coverKey: string | null;
  chapterNumber: string;
  progress: number;
  readAgo: string | null;
};

// One entry per comic: the chapter read most recently.
export async function getRecentlyRead(db: Db, limit = 50, now = Date.now()): Promise<HistoryEntry[]> {
  const { data } = await db
    .from("reading_history")
    .select("comic_id, progress, updated_at, chapters!inner(number, deleted_at), comics!inner(slug, title, cover_key)")
    .is("chapters.deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(500);

  const seen = new Set<string>();
  const entries: HistoryEntry[] = [];
  for (const row of data ?? []) {
    if (seen.has(row.comic_id)) continue;
    seen.add(row.comic_id);
    entries.push({
      comicId: row.comic_id,
      slug: row.comics.slug,
      title: row.comics.title,
      coverKey: row.comics.cover_key,
      chapterNumber: chapterNumber(row.chapters.number) ?? "",
      progress: row.progress,
      readAgo: timeAgo(row.updated_at, now),
    });
    if (entries.length >= limit) break;
  }
  return entries;
}

export type BookmarkState = { bookmarked: boolean; favorite: boolean };

export async function getBookmarkState(db: Db, comicId: string): Promise<BookmarkState> {
  const { data } = await db.from("bookmarks").select("is_favorite").eq("comic_id", comicId).maybeSingle();
  return { bookmarked: Boolean(data), favorite: Boolean(data?.is_favorite) };
}
