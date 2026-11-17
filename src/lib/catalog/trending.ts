// Pure helpers for "Trending This Week" (no network, no database). Unit-tested
// in trending.test.ts. The ranking itself is the database function
// trending_this_week() (supabase/migrations/20261125010000_trending_snapshots.sql).

export type TrendingMode = "week" | "partial" | "starting";

export type Movement = { kind: "up" | "down"; by: number; from: number } | { kind: "same" } | { kind: "new" } | null;

export function toMode(value: string | null | undefined): TrendingMode {
  return value === "week" || value === "partial" ? value : "starting";
}

// Arrow next to a rank. null = no history to compare with (show nothing).
export function movementOf(rank: number, previousRank: number | null, hasPrevious: boolean): Movement {
  if (!hasPrevious) return null;
  if (previousRank == null) return { kind: "new" };
  if (previousRank === rank) return { kind: "same" };
  return previousRank > rank
    ? { kind: "up", by: previousRank - rank, from: previousRank }
    : { kind: "down", by: rank - previousRank, from: previousRank };
}

const DAY_MS = 86_400_000;

function shortDate(iso: string, plusDays = 0): string {
  const d = new Date(Date.parse(`${iso}T00:00:00Z`) + plusDays * DAY_MS);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

// One honest sentence under the heading saying what the ranking measures.
export function trendingNote(mode: TrendingMode, windowStart: string | null, windowEnd: string | null): string {
  if (mode === "week" && windowStart && windowEnd) {
    return `Manhwa that gained the most MangaDex followers, ${shortDate(windowStart)} – ${shortDate(windowEnd)}.`;
  }
  if (mode === "partial" && windowStart) {
    return `Followers gained on MangaDex since ${shortDate(windowStart)}. A full week of data arrives ${shortDate(windowStart, 7)}.`;
  }
  const starts = windowEnd ? ` Weekly growth ranking starts ${shortDate(windowEnd, 7)}.` : "";
  return `Collecting this week's data. Until then: the most-followed manhwa on MangaDex.${starts}`;
}

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export function formatCount(n: number): string {
  return n < 10_000 ? n.toLocaleString("en-US") : compact.format(n);
}
