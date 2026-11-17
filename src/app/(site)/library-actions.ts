"use server";

// Reader actions: bookmarks, favorites, history. They run as the logged-in
// reader, so the database only lets them change their OWN rows (RLS).
// Logged-out callers get { error: "login" } and nothing happens.

import { refresh } from "next/cache";
import { z } from "zod";
import { userForAction } from "@/lib/auth/require-user";

const uuid = z.uuid();
export type LibraryResult = { error?: "login" | "failed"; bookmarked?: boolean; favorite?: boolean };

// on = true: bookmark it. on = false: remove the bookmark (and its favorite).
export async function setBookmark(comicId: string, on: boolean): Promise<LibraryResult> {
  if (!uuid.safeParse(comicId).success) return { error: "failed" };
  const user = await userForAction();
  if (!user) return { error: "login" };

  const { error } = on
    ? await user.supabase.from("bookmarks").upsert({ user_id: user.userId, comic_id: comicId }, { onConflict: "user_id,comic_id", ignoreDuplicates: true })
    : await user.supabase.from("bookmarks").delete().eq("user_id", user.userId).eq("comic_id", comicId);
  if (error) return { error: "failed" };
  refresh();
  return on ? { bookmarked: true } : { bookmarked: false, favorite: false };
}

// Favoriting also bookmarks; un-favoriting keeps the bookmark.
export async function setFavorite(comicId: string, on: boolean): Promise<LibraryResult> {
  if (!uuid.safeParse(comicId).success) return { error: "failed" };
  const user = await userForAction();
  if (!user) return { error: "login" };

  const { error } = await user.supabase
    .from("bookmarks")
    .upsert({ user_id: user.userId, comic_id: comicId, is_favorite: on === true }, { onConflict: "user_id,comic_id" });
  if (error) return { error: "failed" };
  refresh();
  return { bookmarked: true, favorite: on === true };
}

// For the Remove button on the Bookmarks page (a plain form).
export async function removeBookmark(comicId: string): Promise<void> {
  await setBookmark(comicId, false);
}

export async function removeFromHistory(comicId: string): Promise<void> {
  if (!uuid.safeParse(comicId).success) return;
  const user = await userForAction();
  if (!user) return;
  await user.supabase.from("reading_history").delete().eq("user_id", user.userId).eq("comic_id", comicId);
  refresh();
}

export async function clearHistory(): Promise<void> {
  const user = await userForAction();
  if (!user) return;
  await user.supabase.from("reading_history").delete().eq("user_id", user.userId);
  refresh();
}
