// Small display helpers shared by pages and components.

import type { Database } from "@/lib/supabase/database.types";

export type ComicStatus = Database["public"]["Enums"]["comic_status"];
export type ComicType = Database["public"]["Enums"]["comic_type"];

export const STATUS_LABEL: Record<ComicStatus, string> = {
  ongoing: "Ongoing",
  completed: "Completed",
  hiatus: "Hiatus",
  cancelled: "Cancelled",
};

export const TYPE_LABEL: Record<ComicType, string> = {
  manhwa: "Manhwa",
  manga: "Manga",
  manhua: "Manhua",
  webcomic: "Webcomic",
};

// 48 -> "48", 10.5 -> "10.5"
export function chapterNumber(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return String(Number(value));
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// "just now", "5m ago", "2h ago", "3 days ago", "2 weeks ago", then a date.
export function timeAgo(iso: string | null, now: number): string | null {
  if (!iso) return null;
  const diff = now - new Date(iso).getTime();
  if (diff < MINUTE) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  const days = Math.floor(diff / DAY);
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  if (days < 28) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  }
  return formatDate(iso);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

// A chapter counts as "new" for 3 days after release.
export function isNew(iso: string | null, now: number): boolean {
  return Boolean(iso) && now - new Date(iso as string).getTime() < 3 * DAY;
}
